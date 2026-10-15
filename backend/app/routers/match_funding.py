"""POST /api/match-funding - rank lenders and investors for one SME.

The ranking itself lives in app/matching.py (Codex, module 4). This route only
resolves the SME, loads the catalogue rows, hands them over, and persists the
result. It adds no scoring of its own.

The requested amount comes from `amount`, or from the SME's own funding gap in
its latest allocation. Both the debt and the equity path are returned, scored
separately, because comparing a loan against an investment on one scale would
be meaningless.
"""

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from .. import catalog
from ..db import DB_ENABLED, session_scope
from ..grading import grade_financials
from ..matching import match_funding, match_investors
from ..persist_matches import save_funding_matches, save_investor_matches
from ..repository import load_recent_records, parse_uuid
from ..schemas import FinancialInput

router = APIRouter(tags=["match-funding"])


@router.post("/match-funding")
async def match(
    sme_id: str,
    amount: float | None = Query(default=None),
    project_id: str | None = Query(default=None),
    persist: bool = Query(default=True),
) -> dict:
    owner = parse_uuid(sme_id)
    if owner is None:
        raise HTTPException(status_code=422, detail="sme_id must be a UUID")
    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="Matching reads the catalogue, so DATABASE_URL is required")

    async with session_scope() as session:
        records = await load_recent_records(session, owner, limit=1)
        products = await catalog.load_funding_products(session)
        investors = await catalog.load_investor_profiles(session)
        shops = await catalog.load_shops(session)

    if not records:
        raise HTTPException(status_code=404, detail="No stored statement for this sme_id")

    data = FinancialInput.model_validate(records[0]["payload"])
    grade = await run_in_threadpool(grade_financials, data)

    profile = next((shop for shop in shops if shop["id"] == str(owner)), None)
    requested = amount
    if requested is None:
        requested = (profile or {}).get("fundingGap")
    if not requested or requested <= 0:
        raise HTTPException(
            status_code=422,
            detail="No amount to match: pass ?amount= or give the SME an allocation with a funding gap",
        )
    requested_decimal = Decimal(str(requested))

    sector = (profile or {}).get("businessType") or (profile or {}).get("sector")

    funding = await run_in_threadpool(
        match_funding, data, grade, requested_decimal, products
    )
    equity = await run_in_threadpool(
        lambda: match_investors(
            data, grade, requested_decimal, investors, sector=sector
        )
    )

    persisted = {"funding": 0, "investors": 0}
    if persist:
        async with session_scope() as session:
            persisted["funding"] = await save_funding_matches(
                session, owner, parse_uuid(project_id), requested_decimal, funding, products
            )
            persisted["investors"] = await save_investor_matches(
                session, owner, parse_uuid(project_id), requested_decimal,
                grade.get("grade"), equity,
            )

    return {
        "data": {
            "requestedAmount": float(requested_decimal),
            "grade": grade.get("grade"),
            "gradeScore": grade.get("score"),
            "funding": funding,
            "investors": equity,
        },
        "kind": "forecast",
        "status": "ok" if funding or equity else "insufficient_data",
        "missing": [] if records else ["financial_record"],
        "asOf": data.period_end.isoformat(),
        "unit": data.currency,
        "persisted": persisted,
        "source": "stored_record",
    }
