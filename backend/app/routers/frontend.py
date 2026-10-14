"""GET adapters for the frontend's existing /api/v1 contracts.

These five routes are what the deployed UI already calls; before this they all
returned 404, which is why the client could not leave mock mode. Nothing here
changes a component, a style or a contract shape - it serves the shapes the
frontend already declares.

Data source, in order:
  1. ?sme_id=<uuid> and DATABASE_URL set - the SME's latest stored statement,
     plus the one before it so a period-on-period difference is real.
  2. otherwise - the labelled demo dataset in examples/analysis_input.json.

Every response says which one it used in `source`, so a demo number is never
mistaken for a live one.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from .. import adapters
from ..analysis import build_analysis
from ..db import DB_ENABLED, session_scope
from ..finance import calculate_business_metrics, calculate_financials
from ..repository import load_active_swarm_proposal, load_recent_records, load_sme_name, parse_uuid
from ..schemas import FinancialInput

DEMO_DATASET = Path(__file__).resolve().parents[2] / "examples" / "analysis_input.json"

router = APIRouter(tags=["frontend-contracts"])


class Resolved:
    """The statement a request is answered from, and where it came from."""

    def __init__(self, data: FinancialInput, previous: dict | None, shop_name: str | None, source: str):
        self.data = data
        self.previous = previous
        self.shop_name = shop_name
        self.source = source

    @property
    def payload(self) -> dict:
        return self.data.model_dump(mode="json")

    @property
    def as_of(self) -> str:
        return self.data.period_end.isoformat()


async def resolve(sme_id: str | None) -> Resolved:
    owner = parse_uuid(sme_id)
    if owner is not None:
        if not DB_ENABLED:
            raise HTTPException(status_code=503, detail="sme_id requires DATABASE_URL")
        async with session_scope() as session:
            records = await load_recent_records(session, owner, limit=2)
            shop_name = await load_sme_name(session, owner)
        if not records:
            raise HTTPException(status_code=404, detail="No stored statement for this sme_id")
        data = FinancialInput.model_validate(records[0]["payload"])
        previous = records[1] if len(records) > 1 else None
        return Resolved(data, previous, shop_name, "stored_record")

    payload = json.loads(DEMO_DATASET.read_text(encoding="utf-8"))
    return Resolved(FinancialInput.model_validate(payload), None, None, "demo_dataset")


@router.get("/overview")
async def overview(sme_id: str | None = Query(default=None)) -> dict:
    resolved = await resolve(sme_id)
    metrics = (await run_in_threadpool(calculate_financials, resolved.data))["data"]
    business = await run_in_threadpool(calculate_business_metrics, resolved.data)
    analysis = await run_in_threadpool(build_analysis, resolved.data)

    data, missing = adapters.business_overview(
        resolved.payload, metrics, business, resolved.shop_name,
        resolved.previous, analysis["data"]["findings"],
    )
    return adapters.envelope(
        data, resolved.data.kind, missing, resolved.as_of, source=resolved.source
    )


@router.get("/health/indicators")
async def health_indicators(sme_id: str | None = Query(default=None)) -> dict:
    resolved = await resolve(sme_id)
    analysis = await run_in_threadpool(build_analysis, resolved.data)
    indicators = analysis["data"]["indicators"]

    # The input contract carries one period, so no indicator has a history.
    missing = list(analysis["missing"])
    if any(not indicator["trend"] for indicator in indicators):
        missing.append("indicator_history")

    return adapters.envelope(
        indicators, resolved.data.kind, missing, resolved.as_of,
        source=resolved.source,
        evidenceRefs=[ref for indicator in indicators for ref in indicator.get("evidenceRefs", [])],
    )


@router.get("/ai/explain")
async def ai_explain(
    page: str = Query(default="overview"),
    sme_id: str | None = Query(default=None),
) -> dict:
    resolved = await resolve(sme_id)
    analysis = await run_in_threadpool(build_analysis, resolved.data)
    explanation = dict(analysis["data"]["explanation"])
    explanation["pageId"] = page
    if analysis["data"].get("aiWarning"):
        explanation["staleWarning"] = analysis["data"]["aiWarning"]

    return adapters.envelope(
        explanation, resolved.data.kind, list(analysis["missing"]), resolved.as_of,
        source=resolved.source,
        # "rules" means no model was called; the UI should not imply otherwise.
        aiMode=analysis["data"]["aiMode"],
    )


@router.get("/cost/breakdown")
async def cost_breakdown(sme_id: str | None = Query(default=None)) -> dict:
    resolved = await resolve(sme_id)
    business = await run_in_threadpool(calculate_business_metrics, resolved.data)
    data, missing = adapters.cost_breakdown(resolved.payload, business)
    return adapters.envelope(
        data, resolved.data.kind, missing, resolved.as_of, source=resolved.source
    )


@router.get("/swarm/proposal")
async def swarm_proposal() -> dict:
    """The active proposal, meaning the most recently updated stored project.

    This is a different question from GET /api/swarm/{order_ref}, which looks up
    one known order.
    """
    stored = None
    if DB_ENABLED:
        async with session_scope() as session:
            stored = await load_active_swarm_proposal(session)

    if stored is None:
        empty = {
            "orderId": "", "shops": [], "totalCapacityAssigned": 0, "targetCapacity": 0,
            "deficitBoxesPerDay": 0, "totalCost": 0, "totalRevenue": 0, "totalProfit": 0,
            "totalFundingGap": 0, "status": "incomplete", "stuckReasons": [], "version": "v1",
        }
        reason = "no_stored_swarm_project" if DB_ENABLED else "database_disabled"
        return adapters.envelope(empty, "forecast", [reason], "", source="none")

    data, missing = adapters.swarm_proposal(stored)
    return adapters.envelope(
        data, "forecast", missing, stored["project"]["updatedAt"] or "", source="stored_record"
    )
