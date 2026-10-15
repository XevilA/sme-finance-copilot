"""Persistence for ranked funding and investor matches.

The matcher returns snake_case rows with decimal strings; the tables take
numeric columns. Mapping happens here so neither side has to know about the
other's shape.

A re-run replaces the previous rows for the same SME, product set and project,
rather than appending, so a screen reading the table sees one current answer.
Rows the matcher could not score are skipped rather than stored with a zero,
which would be indistinguishable from a real score of zero.
"""

import uuid
from decimal import Decimal, InvalidOperation

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from .models import FundingMatch, InvestorMatch


def decimal_or_none(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def truncate(text: str | None, limit: int = 2000) -> str:
    return (text or "")[:limit]


async def save_funding_matches(
    session: AsyncSession | None,
    sme_id: uuid.UUID,
    project_id: uuid.UUID | None,
    requested_amount: Decimal,
    rows: list[dict],
    products: list[dict] | None = None,
) -> int:
    if session is None or not rows:
        return 0

    await session.execute(
        delete(FundingMatch).where(
            FundingMatch.sme_id == sme_id,
            FundingMatch.project_id == project_id,
        )
    )
    await session.flush()

    tenors = {p["id"]: p.get("termMonths") for p in (products or [])}

    stored = 0
    for row in rows:
        product_id = _as_uuid(row.get("product_id"))
        if product_id is None:
            continue
        session.add(FundingMatch(
            sme_id=sme_id,
            product_id=product_id,
            project_id=project_id,
            requested_amount=requested_amount,
            monthly_payment=decimal_or_none(row.get("monthly_payment")),
            total_repayment=_total_repayment(row, tenors.get(row.get("product_id"))),
            match_score=int(row["match_score"]),
            match_reason=truncate(row.get("match_reason")),
            status=row["status"],
        ))
        stored += 1
    await session.flush()
    return stored


def _total_repayment(row: dict, term_months: int | None) -> Decimal | None:
    """Total repayment over the facility life.

    Deliberately not the matcher period_installments, which counts installments
    inside the reporting period for its DSCR stress test. Left null when the
    tenor is unknown. A grant repays nothing, so its zero payment yields zero
    rather than being treated as an amortising loan.
    """
    payment = decimal_or_none(row.get("monthly_payment"))
    if payment is None or not term_months:
        return None
    return payment * Decimal(term_months)


async def save_investor_matches(
    session: AsyncSession | None,
    sme_id: uuid.UUID,
    project_id: uuid.UUID | None,
    requested_amount: Decimal,
    sme_grade: str | None,
    rows: list[dict],
) -> int:
    if session is None or not rows:
        return 0

    await session.execute(
        delete(InvestorMatch).where(
            InvestorMatch.sme_id == sme_id,
            InvestorMatch.project_id == project_id,
        )
    )
    await session.flush()

    stored = 0
    for row in rows:
        investor_id = _as_uuid(row.get("investor_id"))
        if investor_id is None:
            continue
        session.add(InvestorMatch(
            investor_id=investor_id,
            sme_id=sme_id,
            project_id=project_id,
            requested_amount=requested_amount,
            sme_grade=sme_grade,
            match_score=int(row["match_score"]),
            match_reason=truncate(row.get("match_reason")),
            status=row["status"],
        ))
        stored += 1
    await session.flush()
    return stored


def _as_uuid(value) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None
