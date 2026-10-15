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
from ..forecasting import forecast_cashflow
from ..industry import fetch_industry_trends
from ..news_cache import load_cached_articles, upsert_articles
from ..repository import parse_uuid

router = APIRouter(tags=["insights"])


@router.get("/forecast")
async def forecast(
    sme_id: str,
    as_of: date | None = Query(default=None),
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

    async with session_scope() as session:
        events = await catalog.load_cash_events(session, owner)
        shops = await catalog.load_shops(session)

    profile = next((shop for shop in shops if shop["id"] == str(owner)), None)
    if profile is None:
        raise HTTPException(status_code=404, detail="Unknown sme_id")

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
    }


@router.get("/industry/trends")
async def industry_trends(
    sector: str = Query(default="food_processing"),
    force_refresh: bool = Query(default=False),
) -> dict:
    """Industry news and deterministic signals for one sector.

    Cached rows are read from industry_news and handed to the fetcher, which
    decides whether they are fresh, stale or unusable. Whatever comes back is
    upserted by the fetcher's own id, so re-ingesting an article updates it
    instead of duplicating it. No SME data is sent to the provider.
    """
    cached: list[dict] = []
    if DB_ENABLED:
        async with session_scope() as session:
            cached = await load_cached_articles(session, sector)

    as_of = datetime.now(timezone.utc)
    result = await fetch_industry_trends(sector, as_of=as_of, cached_articles=cached, force_refresh=force_refresh)

    stored = 0
    if DB_ENABLED and result.get("articles"):
        async with session_scope() as session:
            stored = await upsert_articles(session, result["articles"])

    return {
        "data": {
            "sector": result.get("sector", sector),
            "articles": result.get("articles", []),
            "findings": result.get("findings", []),
            "sourceStatus": result.get("source_status"),
            "sourceError": result.get("source_error"),
            "retryAfterSeconds": result.get("retry_after_seconds"),
            "notice": result.get("notice"),
            "assumptions": result.get("assumptions", []),
        },
        "kind": "actual",
        # ok | empty | stale | unavailable, straight from the fetcher.
        "status": result.get("status", "unavailable"),
        "missing": result.get("missing", []),
        "asOf": result.get("as_of") or as_of.isoformat(),
        "cachedRowsSupplied": len(cached),
        "rowsStored": stored,
        "source": "stored_record" if cached else "provider",
    }
