"""Persistence helpers. Every function is a no-op returning None when the
session is None (DATABASE_URL unset), so routes work with or without Postgres."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import FinancialRecord, Simulation, SmeProfile, SwarmAllocation, SwarmProject, UploadEvent


def parse_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


async def save_financial_record(
    session: AsyncSession | None,
    sme_id: uuid.UUID | None,
    payload: dict,
    computed: dict,
    source: str,
) -> uuid.UUID | None:
    if session is None or sme_id is None:
        return None
    exists = await session.get(SmeProfile, sme_id)
    if exists is None:
        return None
    record = FinancialRecord(
        sme_id=sme_id,
        currency=payload["currency"],
        kind=payload["kind"],
        source=source,
        period_start=date.fromisoformat(payload["period_start"]),
        period_end=date.fromisoformat(payload["period_end"]),
        payload=payload,
        computed=computed,
        status=computed.get("status", "ok"),
    )
    session.add(record)
    await session.flush()
    return record.id


async def save_swarm_proposal(
    session: AsyncSession | None,
    request_payload: dict,
    proposal: dict,
) -> uuid.UUID | None:
    """Upserts the project by order_ref and replaces its allocation set."""
    if session is None:
        return None

    shop_ids = {shop["shopId"]: parse_uuid(shop["shopId"]) for shop in proposal["shops"]}
    if not shop_ids or any(value is None for value in shop_ids.values()):
        return None  # Demo shop slugs are not persistable rows; compute-only.

    known = set(
        (await session.scalars(select(SmeProfile.id).where(SmeProfile.id.in_(list(shop_ids.values()))))).all()
    )
    if not known:
        return None

    project = await session.scalar(select(SwarmProject).where(SwarmProject.order_ref == request_payload["order_ref"]))
    if project is None:
        project = SwarmProject(order_ref=request_payload["order_ref"])
        session.add(project)

    project.buyer_name = request_payload["buyer_name"]
    project.target_capacity = Decimal(str(request_payload["target_capacity"]))
    project.unit = request_payload.get("unit", "box")
    project.unit_price = Decimal(str(request_payload["unit_price"]))
    project.duration_days = int(request_payload["duration_days"])
    project.payment_terms_days = int(request_payload["payment_terms_days"])
    project.deposit_ratio = Decimal(str(request_payload["deposit_ratio"]))
    project.status = proposal["status"]
    await session.flush()

    await session.execute(delete(SwarmAllocation).where(SwarmAllocation.project_id == project.id))
    await session.flush()

    for shop in proposal["shops"]:
        sme_id = shop_ids[shop["shopId"]]
        if sme_id not in known:
            continue
        session.add(SwarmAllocation(
            project_id=project.id,
            sme_id=sme_id,
            assigned_role=shop["assignedRole"],
            share_per_day=Decimal(str(shop["shareBoxesPerDay"])),
            working_capital_needed=Decimal(str(shop["workingCapitalNeeded"])),
            current_cash=Decimal(str(shop["currentCash"])),
            funding_gap=Decimal(str(shop["fundingGap"])),
            status=shop["status"],
            version=proposal["version"],
        ))
    return project.id


async def load_swarm_project(session: AsyncSession | None, order_ref: str) -> dict | None:
    if session is None:
        return None
    project = await session.scalar(
        select(SwarmProject)
        .where(SwarmProject.order_ref == order_ref)
        .options(selectinload(SwarmProject.allocations))
    )
    if project is None:
        return None
    return {
        "orderId": project.order_ref,
        "buyerName": project.buyer_name,
        "targetCapacity": float(project.target_capacity),
        "status": project.status,
        "shops": [
            {
                "shopId": str(allocation.sme_id),
                "shareBoxesPerDay": float(allocation.share_per_day),
                "workingCapitalNeeded": float(allocation.working_capital_needed),
                "currentCash": float(allocation.current_cash),
                "fundingGap": float(allocation.funding_gap),
                "status": allocation.status,
                "assignedRole": allocation.assigned_role,
            }
            for allocation in project.allocations
        ],
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
    }


async def load_shop_capacities(session: AsyncSession | None, sme_ids: list[uuid.UUID]) -> list[dict]:
    if session is None or not sme_ids:
        return []
    rows = (await session.scalars(select(SmeProfile).where(SmeProfile.id.in_(sme_ids)))).all()
    return [
        {
            "shop_id": str(row.id),
            "name": row.name,
            "capacity_total": row.capacity_total,
            "capacity_used": row.capacity_used,
            "cost_per_unit": row.cost_per_unit,
            "cash_balance": row.cash_balance,
            "minimum_cash_reserve": row.minimum_cash_reserve,
        }
        for row in rows
    ]


async def save_upload_event(
    session: AsyncSession | None,
    sme_id: uuid.UUID | None,
    record_id: uuid.UUID | None,
    filename: str,
    byte_size: int,
    content_sha256: str,
    status: str,
    reject_reason: str | None = None,
) -> uuid.UUID | None:
    """Records that a workbook was seen. The file bytes are never stored."""
    if session is None:
        return None
    event = UploadEvent(
        sme_id=sme_id,
        record_id=record_id,
        filename=filename[:255],
        byte_size=byte_size,
        content_sha256=content_sha256,
        status=status,
        reject_reason=None if reject_reason is None else reject_reason[:2000],
    )
    session.add(event)
    await session.flush()
    return event.id


async def save_simulation(
    session: AsyncSession | None,
    sme_id: uuid.UUID | None,
    scenario_key: str,
    params: dict,
    results: dict,
    project_id: uuid.UUID | None = None,
    base_record_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    if session is None:
        return None
    if sme_id is not None and await session.get(SmeProfile, sme_id) is None:
        return None
    simulation = Simulation(
        sme_id=sme_id,
        project_id=project_id,
        base_record_id=base_record_id,
        scenario_key=scenario_key,
        params=params,
        results=results,
    )
    session.add(simulation)
    await session.flush()
    return simulation.id
