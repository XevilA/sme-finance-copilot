"""Loads dated obligations and hands them to the forecaster.

app/forecasting.py never touches the database: it takes obligation DTOs and
returns cash_events rows for this layer to upsert. This module is that seam.

Two rules the forecaster depends on, enforced here:

**An unknown category is not an empty one.** `None` means we do not know whether
obligations of that kind exist; `[]` means we know there are none. Returning `[]`
for a table we never queried would let the forecaster call a schedule complete
when it is merely unseen.

**Only outstanding rows are forecast.** A collected invoice or a paid bill is
already in the cash balance, so projecting it again would double count.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ExpenseTransaction, Payable, Receivable

# Maps the payables `kind` column onto the forecaster's outflow categories.
PAYABLE_CATEGORIES = {
    "supplier": "payables",
    "operating_cost": "operating_costs",
    "debt_installment": "installments",
}


def obligation_dto(identifier, due: date, amount, title: str, partner: str | None) -> dict:
    """The shape app/forecasting.py documents: {id, due_date, amount, title, partner?}."""
    row = {
        "id": str(identifier),
        "due_date": due.isoformat(),
        "amount": str(amount),
        "title": title,
    }
    if partner:
        row["partner"] = partner
    return row


async def load_obligations(session: AsyncSession | None, sme_id: uuid.UUID) -> dict:
    """Returns the four forecaster categories, or None per category if unknown.

    With no session nothing was queried, so every category is unknown rather
    than empty.
    """
    if session is None:
        return {"receivables": None, "payables": None, "operating_costs": None, "installments": None}

    inflows = (
        await session.scalars(
            select(Receivable)
            .where(Receivable.sme_id == sme_id, Receivable.status == "outstanding")
            .order_by(Receivable.due_date)
        )
    ).all()
    outflows = (
        await session.scalars(
            select(Payable)
            .where(Payable.sme_id == sme_id, Payable.status == "outstanding")
            .order_by(Payable.due_date)
        )
    ).all()

    # Every category was queried, so an absent one is genuinely empty.
    result: dict = {"receivables": [], "payables": [], "operating_costs": [], "installments": []}
    for row in inflows:
        result["receivables"].append(
            obligation_dto(row.id, row.due_date, row.amount,
                           f"รับชำระ {row.invoice_ref}", row.counterparty)
        )
    for row in outflows:
        bucket = PAYABLE_CATEGORIES.get(row.kind)
        if bucket is None:
            continue
        label = row.category or row.kind
        result[bucket].append(
            obligation_dto(row.id, row.due_date, row.amount,
                           f"{label} {row.bill_ref}", row.counterparty)
        )
    return result


async def load_expense_history(
    session: AsyncSession | None, sme_id: uuid.UUID, limit: int = 500
) -> list[dict] | None:
    """Dated expenses, newest first. None when nothing was queried."""
    if session is None:
        return None
    rows = (
        await session.scalars(
            select(ExpenseTransaction)
            .where(ExpenseTransaction.sme_id == sme_id)
            .order_by(ExpenseTransaction.transaction_date.desc())
            .limit(limit)
        )
    ).all()
    return [
        {
            "id": str(row.id),
            "date": row.transaction_date.isoformat(),
            "category": row.category,
            "description": row.description,
            "amount": str(row.amount),
            "counterparty": row.counterparty,
        }
        for row in rows
    ]


async def upsert_projected_events(session: AsyncSession | None, events: list[dict]) -> int:
    """Upserts generated cash_events by the forecaster's own stable id.

    The ids are derived from the SME, project, category and source obligation,
    so correcting an amount or a due date updates the same row instead of
    leaving the old projection behind.

    Only rows the forecaster marked `projected` are written. A confirmed event
    is a record of something that happened and is not ours to overwrite.
    """
    if session is None or not events:
        return 0

    stored = 0
    for event in events:
        if event.get("status") != "projected":
            continue
        await session.execute(
            text(
                """
                INSERT INTO cash_events (id, sme_id, project_id, event_date, day_index,
                                         type, title, amount, is_inflow, partner,
                                         status, impact_reason)
                VALUES (:id, :sme_id, :project_id, :event_date, :day_index,
                        :type, :title, :amount, :is_inflow, :partner,
                        :status, :impact_reason)
                ON CONFLICT (id) DO UPDATE SET
                    event_date    = EXCLUDED.event_date,
                    day_index     = EXCLUDED.day_index,
                    type          = EXCLUDED.type,
                    title         = EXCLUDED.title,
                    amount        = EXCLUDED.amount,
                    is_inflow     = EXCLUDED.is_inflow,
                    partner       = EXCLUDED.partner,
                    status        = EXCLUDED.status,
                    impact_reason = EXCLUDED.impact_reason
                WHERE cash_events.status = 'projected'
                """
            ),
            # asyncpg binds by the column type and checks the value before any
            # SQL-side cast runs, so dates, ids and money are converted here
            # rather than passed as the strings the forecaster serialises.
            {
                "id": uuid.UUID(event["id"]),
                "sme_id": uuid.UUID(event["sme_id"]),
                "project_id": uuid.UUID(event["project_id"]) if event.get("project_id") else None,
                "event_date": date.fromisoformat(event["event_date"]),
                "day_index": int(event["day_index"]),
                "type": event["type"],
                "title": event["title"],
                "amount": Decimal(str(event["amount"])),
                "is_inflow": bool(event["is_inflow"]),
                "partner": event.get("partner"),
                "status": event["status"],
                "impact_reason": event.get("impact_reason", ""),
            },
        )
        stored += 1
    await session.flush()
    return stored


async def load_shop_resources(session: AsyncSession | None, sme_ids: list[uuid.UUID]) -> dict:
    """Resources each shop depends on, keyed by shop id as a string.

    Returns `{}` when nothing was queried, and omits a shop with no recorded
    dependency, so the allocator can tell "needs nothing recorded" apart from
    "needs nothing".

    `available` reflects the resource status: a resource still only offered is
    not yet secured, which is what makes a required one a real constraint.
    """
    if session is None or not sme_ids:
        return {}

    rows = (
        await session.execute(
            text(
                """
                SELECT a.sme_id, r.id, r.title, r.category, r.status,
                       ar.required, ar.note, r.owner_sme_id
                FROM allocation_resources ar
                JOIN swarm_allocations a ON a.id = ar.allocation_id
                JOIN shared_resources r ON r.id = ar.resource_id
                WHERE a.sme_id = ANY(:ids)
                ORDER BY a.sme_id, ar.required DESC, r.title
                """
            ),
            {"ids": [str(value) for value in sme_ids]},
        )
    ).all()

    grouped: dict = {}
    for sme_id, resource_id, title, category, status, required, note, owner in rows:
        grouped.setdefault(str(sme_id), []).append({
            "resource_id": str(resource_id),
            "title": title,
            "category": category,
            "status": status,
            # A resource that is merely offered is not secured yet.
            "available": status == "confirmed",
            "required": bool(required),
            "owned_by_shop": str(owner) == str(sme_id) if owner else False,
            "note": note,
        })
    return grouped
