"""Read-only evaluations of an explicit imported statement. No seed fallback."""

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from .. import adapters, adapters_catalog, catalog
from ..context import StatementRequest, metadata, scoped_evidence, verify_identity
from ..db import DB_ENABLED, session_scope
from ..finance import calculate_financials
from ..grading import grade_financials
from ..matching import match_funding, match_investors
from ..schemas import PositiveMoney

router = APIRouter(tags=["contextual-evaluation"])


class FundingEvaluation(StatementRequest):
    amount: PositiveMoney | None = None
    sector: str | None = None


@router.post("/funding/evaluate")
async def funding_evaluate(request: FundingEvaluation) -> dict:
    await verify_identity(request)
    if not DB_ENABLED:
        raise HTTPException(503, "Funding catalogue requires DATABASE_URL")
    async with session_scope() as session:
        products = await catalog.load_funding_products(session)
        investors = await catalog.load_investor_profiles(session)
    calculated = await run_in_threadpool(calculate_financials, request.input)
    gap = calculated["data"]["funding_gap"]
    amount = request.amount
    if amount is None and gap["status"] == "ok":
        from decimal import Decimal
        amount = Decimal(gap["value"])
    grade = await run_in_threadpool(grade_financials, request.input)
    missing = [] if amount is not None else ["requested_amount"]
    funding, equity, options = [], [], []
    if amount is not None and amount > 0:
        funding = await run_in_threadpool(match_funding, request.input, grade, amount, products)
        equity = await run_in_threadpool(lambda: match_investors(request.input, grade, amount, investors, sector=request.sector))
        options, gaps = adapters_catalog.funding_options(products, funding, float(amount))
        missing += gaps
        missing += [f"funding:{row['product_id']}:{gap}" for row in funding for gap in row.get("missing", [])]
        missing += [f"investor:{row['investor_id']}:{gap}" for row in equity for gap in row.get("missing", [])]
    if not products:
        missing.append("funding_catalogue")
    return adapters.envelope(
        {"requestedAmount": None if amount is None else format(amount, "f"),
         "notRequired": amount == 0 if amount is not None else None,
         "grade": grade.get("grade"), "gradeScore": grade.get("score"),
         "funding": funding, "investors": equity, "options": options},
        request.input.kind, sorted(set(missing)), request.input.period_end.isoformat(),
        source="supplied_input", persisted=False,
        **metadata(request),
    )


@router.post("/forecast/preview")
async def forecast_preview(request: StatementRequest) -> dict:
    forecast, _ = await scoped_evidence(request)
    return adapters.envelope(
        forecast, "forecast", forecast["missing"] if forecast else ["cash_forecast"],
        request.input.period_end.isoformat(), source="supplied_input", persisted=False,
        **metadata(request, evidence={"forecast": forecast}),
    )


@router.get("/capabilities")
def capabilities() -> dict:
    return {"data": {
        "fundingApplication": {"available": False, "reason": "business_contract_required"},
        "agreementSignature": {"available": False, "reason": "business_contract_required"},
        "funderInfoRequest": {"available": False, "reason": "business_contract_required"},
        "reportExport": {"available": False, "reason": "export_contract_required"},
        "resourceReservation": {"available": False, "reason": "quantity_and_time_contract_required"},
        "orderPreview": {"available": True, "endpoint": "/api/v1/simulate/order"},
    }, "source": "runtime_contract", "status": "ok", "missing": []}
