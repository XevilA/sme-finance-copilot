"""The remaining eleven /api/v1 GET contracts the frontend calls.

Together with routers/frontend.py this covers all sixteen paths in
src/api/client.ts, so the client can be switched off mock mode.

Every route is read-only and database-backed. Without DATABASE_URL they return
an empty payload with the reason in `missing`, rather than 404 or invented rows,
so the UI renders its own empty state.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from .. import adapters, adapters_catalog, catalog
from ..db import DB_ENABLED, session_scope
from ..finance import calculate_financials
from ..rbac import Principal, funder_access, resolve_principal
from ..repository import load_recent_records, parse_uuid
from ..schemas import FinancialInput

router = APIRouter(tags=["frontend-contracts"])

DB_OFF = "database_disabled"


def offline(empty):
    """Shared response for every catalogue route when persistence is off."""
    return adapters.envelope(empty, "actual", [DB_OFF], "", source="none")


@router.get("/shops")
async def shops() -> dict:
    if not DB_ENABLED:
        return offline([])
    async with session_scope() as session:
        rows = await catalog.load_shops(session)
    data, missing = adapters_catalog.shops(rows)
    return adapters.envelope(data, "actual", missing, "", source="stored_record")


@router.get("/order")
async def order() -> dict:
    if not DB_ENABLED:
        return offline(None)
    async with session_scope() as session:
        project = await catalog.load_latest_project(session)
    if project is None:
        return adapters.envelope(None, "actual", ["no_stored_swarm_project"], "", source="none")
    data, missing = adapters_catalog.swarm_order(project)
    return adapters.envelope(
        data, "actual", missing, project["updatedAt"] or "", source="stored_record"
    )


@router.get("/shops/{shop_id}/finance")
async def shop_finance(shop_id: str, order_ref: str | None = Query(default=None)) -> dict:
    """Pass order_ref to pin the project; otherwise the latest one is used."""
    owner = parse_uuid(shop_id)
    if owner is None:
        raise HTTPException(status_code=422, detail="shop_id must be a UUID")
    if not DB_ENABLED:
        return offline(None)
    async with session_scope() as session:
        stored = await catalog.load_shop_allocation(session, owner, order_ref)
    if stored is None:
        return adapters.envelope(
            None, "forecast", ["no_allocation_for_shop"], "", source="none"
        )
    data, missing = adapters_catalog.shop_finance(stored)
    return adapters.envelope(
        data, "forecast", missing, stored["project"]["updatedAt"] or "", source="stored_record"
    )


@router.get("/cashflow/timeline")
async def cashflow_timeline(sme_id: str | None = Query(default=None)) -> dict:
    """Built only from dated cash_events rows.

    A period total is never spread across days: without dated rows the series
    shape would be invented, so an empty timeline is returned instead.
    """
    if not DB_ENABLED:
        return offline([])
    owner = parse_uuid(sme_id)
    async with session_scope() as session:
        events = await catalog.load_cash_events(session, owner)
        shops = await catalog.load_shops(session)

    opening = 0.0
    reserve = 0.0
    if owner is not None:
        match = next((shop for shop in shops if shop["id"] == str(owner)), None)
        if match:
            opening = match["currentCash"]
            reserve = match["minimumCashReserve"]
    elif shops:
        opening = shops[0]["currentCash"]
        reserve = shops[0]["minimumCashReserve"]

    data, missing = adapters_catalog.cashflow_timeline(events, opening, reserve)
    if owner is None:
        missing = [*missing, "sme_id_not_supplied_opening_cash_is_first_shop"]
    return adapters.envelope(
        data, "forecast", missing, data[-1]["date"] if data else "",
        source="stored_record" if data else "none",
    )


@router.get("/funding/options")
async def funding_options(
    sme_id: str | None = Query(default=None),
    amount: float | None = Query(default=None),
) -> dict:
    """Eligibility from stored product constraints; ranking is not computed.

    The requested amount comes from `amount`, or from the SME's own funding gap
    in its latest allocation. DSCR comes from the SME's latest statement.
    """
    if not DB_ENABLED:
        return offline([])
    owner = parse_uuid(sme_id)
    async with session_scope() as session:
        products = await catalog.load_funding_products(session)
        shops = await catalog.load_shops(session)
        records = await load_recent_records(session, owner, limit=1)

    requested = amount
    if requested is None and owner is not None:
        match = next((shop for shop in shops if shop["id"] == str(owner)), None)
        requested = (match or {}).get("fundingGap") or 0.0
    requested = requested or 0.0

    dscr = None
    if records:
        data = FinancialInput.model_validate(records[0]["payload"])
        metric = (await run_in_threadpool(calculate_financials, data))["data"].get("dscr", {})
        if metric.get("status") == "ok":
            dscr = float(metric["value"])

    options, missing = adapters_catalog.funding_options(products, requested, dscr)
    return adapters.envelope(
        options, "forecast", missing, "", source="stored_record",
        requestedAmount=requested,
    )


@router.get("/unlock/resources")
async def unlock_resources() -> dict:
    if not DB_ENABLED:
        return offline([])
    async with session_scope() as session:
        rows = await catalog.load_shared_resources(session)
    return adapters.envelope(
        rows, "actual", [] if rows else ["no_shared_resources"], "",
        source="stored_record" if rows else "none",
    )


@router.get("/simulator/chaos")
async def simulator_chaos() -> dict:
    if not DB_ENABLED:
        return offline([])
    async with session_scope() as session:
        rows = await catalog.load_chaos_scenarios(session)
    return adapters.envelope(
        rows, "simulated", [] if rows else ["no_chaos_scenarios"], "",
        source="stored_record" if rows else "none",
    )


@router.get("/sales/products")
async def sales_products(sme_id: str | None = Query(default=None)) -> dict:
    if not DB_ENABLED:
        return offline([])
    async with session_scope() as session:
        rows = await catalog.load_sales_products(session, parse_uuid(sme_id))
    data, missing = adapters_catalog.sales_products(rows)
    if not rows:
        missing = [*missing, "no_sales_products"]
    return adapters.envelope(
        data, "actual", missing, "", source="stored_record" if rows else "none"
    )


@router.get("/sales/channels")
async def sales_channels(sme_id: str | None = Query(default=None)) -> dict:
    if not DB_ENABLED:
        return offline([])
    async with session_scope() as session:
        rows = await catalog.load_sales_channels(session, parse_uuid(sme_id))
    data, missing = adapters_catalog.sales_channels(rows)
    if not rows:
        missing = [*missing, "no_sales_channels"]
    return adapters.envelope(
        data, "actual", missing, "", source="stored_record" if rows else "none"
    )


@router.get("/projects")
async def projects() -> dict:
    if not DB_ENABLED:
        return offline([])
    async with session_scope() as session:
        rows = await catalog.load_projects_with_detail(session)
    data, missing = adapters_catalog.project_records(rows)
    return adapters.envelope(
        data, "actual", missing, "", source="stored_record" if rows else "none"
    )


@router.get("/funder/projects")
async def funder_projects(principal: Principal = Depends(resolve_principal)) -> dict:
    """Funder view.

    The role comes from the resolved principal, never from a query parameter the
    caller chooses. `hasAccessPermission` carries the RBAC decision and
    `rbacEnforced` says whether it was actually checked, so the UI can tell
    "allowed" apart from "not verified".
    """
    rows: list[dict] = []
    missing: list[str] = []
    data: list[dict] = []

    if DB_ENABLED:
        async with session_scope() as session:
            rows = await catalog.load_projects_with_detail(session)
        data, missing = adapters_catalog.funder_projects(rows, funder_access(principal.role))
    else:
        missing = [DB_OFF]

    if not principal.enforced:
        missing = [*missing, "rbac_not_enforced"]

    # The rbac fields are present in both modes, so the UI reads one shape.
    return adapters.envelope(
        data, "forecast", missing, "", source="stored_record" if rows else "none",
        role=principal.role or "unauthenticated",
        rbacEnforced=principal.enforced,
    )
