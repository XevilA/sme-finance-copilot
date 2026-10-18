"""Routes exposing the forecast and industry-trends modules.

Both carry logic owned by app/forecasting.py and app/industry.py. This layer
resolves the SME, supplies stored rows, and persists what comes back. It
computes nothing of its own.
"""

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from .. import catalog
from ..db import DB_ENABLED, session_scope
from ..forecasting import forecast_cashflow, project_cash_events
from .. import fetch_state
from ..fetch_state import Gate
from ..industry import analyze_industry_articles, fetch_industry_trends
from ..news_cache import load_cached_articles, upsert_articles
from ..obligations import load_obligations, upsert_projected_events
from ..repository import parse_uuid

router = APIRouter(tags=["insights"])

# The only external provider today; the gate is keyed per provider.
PROVIDER = "gdelt"


@router.get("/forecast")
async def forecast(
    sme_id: str,
    as_of: date | None = Query(default=None),
    project_obligations: bool = Query(
        default=True,
        description="Generate and store projected events from dated receivables "
                    "and payables before forecasting. Turn off to forecast only "
                    "events already stored.",
    ),
    schedule_complete_through: date | None = Query(
        default=None,
        description="Confirm how far the supplied schedule is complete. Without "
                    "it the 30/60/90 figures stay null and only conditional "
                    "values are returned.",
    ),
) -> dict:
    """Dated 30/60/90-day cash forecast from stored cash_events rows.

    `schedule_complete_through` is the caller's explicit confirmation of
    coverage. It is not inferred from the last event date, because a schedule
    that simply stops is indistinguishable from one that is complete.
    """
    owner = parse_uuid(sme_id)
    if owner is None:
        raise HTTPException(status_code=422, detail="sme_id must be a UUID")
    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="The forecast reads cash_events, so DATABASE_URL is required")

    generated = {"events": 0, "overdue": [], "missing": []}
    async with session_scope() as session:
        shops = await catalog.load_shops(session)
        profile = next((shop for shop in shops if shop["id"] == str(owner)), None)
        if profile is None:
            raise HTTPException(status_code=404, detail="Unknown sme_id")

        if project_obligations:
            # Turn the dated receivables and payables into projected events and
            # store them, so the forecast runs over one set of cash_events
            # rather than a second parallel view of the same obligations.
            obligations = await load_obligations(session, owner)
            produced = await run_in_threadpool(
                lambda: project_cash_events(
                    as_of=as_of or date.today(), sme_id=str(owner), **obligations
                )
            )
            written = await upsert_projected_events(session, produced["events"])
            generated = {
                "events": written,
                # An obligation past due with no rescheduled date is reported,
                # never moved to an invented future day.
                "overdue": produced.get("overdue", []),
                "missing": produced.get("missing", []),
            }

        events = await catalog.load_cash_events(session, owner)

    result = await run_in_threadpool(
        lambda: forecast_cashflow(
            events,
            opening_cash=Decimal(str(profile["currentCash"])),
            as_of=as_of or date.today(),
            minimum_cash_reserve=Decimal(str(profile["minimumCashReserve"])),
            schedule_complete_through=schedule_complete_through,
        )
    )

    return {
        "data": result,
        "kind": "forecast",
        "status": result.get("status", "ok"),
        "missing": result.get("missing", []),
        "asOf": (as_of or date.today()).isoformat(),
        "unit": "THB",
        "source": "stored_record",
        "scheduleCompleteThrough": schedule_complete_through.isoformat() if schedule_complete_through else None,
        "projectedFromObligations": generated,
    }


@router.get("/industry/trends")
async def industry_trends(
    sector: str = Query(default="food_processing"),
    force_refresh: bool = Query(default=False),
) -> dict:
    """Industry news and deterministic signals for one sector.

    Calls to the provider are gated by `provider_fetch_state`, shared across
    workers: a worker that is rate limited or that cannot take the lock serves
    the cache instead of making the call. Without that, several replicas hitting
    the provider together is what produced HTTP 429.

    Whatever comes back is upserted by the fetcher's own id, so re-ingesting an
    article updates it instead of duplicating it. No SME data is sent.
    """
    as_of = datetime.now(timezone.utc)
    cached: list[dict] = []
    if not DB_ENABLED:
        result = await fetch_industry_trends(
            sector, as_of=as_of, cached_articles=cached, force_refresh=force_refresh
        )
        return _trends_response(sector, result, as_of, cached, 0, {"provider": PROVIDER, "coordinated": False})

    # Transaction advisory locks belong to a PostgreSQL connection. Acquisition,
    # network call, state update and release must use the SAME session, both
    # under NullPool and QueuePool. Closing it before fetch drops the lock;
    # Transaction completion releases the lock after the state commits.
    async with session_scope() as session:
        cached = await load_cached_articles(session, sector)
        gate = await fetch_state.acquire(session, PROVIDER, force=force_refresh)
        if not gate.allowed:
            result = analyze_industry_articles(
                cached, sector, as_of=as_of,
                source_status="unavailable", source_error="provider_gate_closed",
            )
            provider_status = await fetch_state.status(session, PROVIDER)
            return _trends_response(sector, result, as_of, cached, 0, provider_status,
                                    gate_reason=gate.reason, retry_after=gate.retry_after_seconds)
        try:
            result = await fetch_industry_trends(
                sector, as_of=as_of, cached_articles=cached, force_refresh=force_refresh
            )
            stored = 0
            retry_after = result.get("retry_after_seconds")
            if result.get("articles"):
                stored = await upsert_articles(session, result["articles"])
            if result.get("source_status") in {"unavailable", "error"}:
                # Return the effective backoff (including the provider's
                # Retry-After) so clients do not immediately repeat a failed
                # upstream request.
                retry_after = await fetch_state.record_failure(
                    session, PROVIDER,
                    str(result.get("source_error") or "unavailable"),
                    retry_after,
                )
            else:
                await fetch_state.record_success(session, PROVIDER)
            provider_status = await fetch_state.status(session, PROVIDER)
            return _trends_response(sector, result, as_of, cached, stored, provider_status,
                                    retry_after=retry_after)
        finally:
            await fetch_state.release(session, PROVIDER)


def _trends_response(
    sector: str,
    result: dict,
    as_of,
    cached: list[dict],
    stored: int,
    provider_status: dict,
    gate_reason: str | None = None,
    retry_after: int | None = None,
) -> dict:
    missing = list(result.get("missing", []))
    if gate_reason and gate_reason != "no_coordination":
        missing = [*missing, f"provider_gate:{gate_reason}"]
    return {
        "data": {
            "sector": result.get("sector", sector),
            "articles": result.get("articles", []),
            "findings": result.get("findings", []),
            "sourceStatus": result.get("source_status"),
            "sourceError": result.get("source_error"),
            "retryAfterSeconds": retry_after or result.get("retry_after_seconds"),
            "notice": result.get("notice"),
            "assumptions": result.get("assumptions", []),
        },
        "kind": "actual",
        "status": result.get("status", "unavailable"),
        "missing": missing,
        "asOf": result.get("as_of") or as_of.isoformat(),
        "cachedRowsSupplied": len(cached),
        "rowsStored": stored,
        "source": "stored_record" if cached else "provider",
        "providerGate": provider_status,
    }
