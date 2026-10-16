"""Persistence helpers. Every function is a no-op returning None when the
session is None (DATABASE_URL unset), so routes work with or without Postgres."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import case, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import AllocationResource, FinancialRecord, Simulation, SmeProfile, SwarmAllocation, SwarmProject, UploadEvent


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
    """Upsert allocations without deleting dependencies of retained shops."""
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
    if "production_start" in request_payload.get("_provided", []):
        project.start_date = request_payload.get("production_start")
    constraint_keys = {"required_business_types", "buyer_coordinates", "max_distance_km", "collection_schedule"}
    supplied = constraint_keys.intersection(request_payload.get("_provided", []))
    if supplied:
        from fastapi.encoders import jsonable_encoder
        project.constraints = {**(project.constraints or {}), **{
            key: jsonable_encoder(request_payload[key]) for key in supplied
        }}
    project.status = proposal["status"]
    await session.flush()

    retained = {shop_ids[shop["shopId"]] for shop in proposal["shops"] if shop_ids[shop["shopId"]] in known}
    await session.execute(delete(SwarmAllocation).where(
        SwarmAllocation.project_id == project.id, SwarmAllocation.sme_id.not_in(retained),
    ))
    existing = {row.sme_id: row for row in (await session.scalars(
        select(SwarmAllocation).where(SwarmAllocation.project_id == project.id)
    )).all()}
    request_shops = {row["shop_id"]: row for row in request_payload["shops"]}

    for shop in proposal["shops"]:
        sme_id = shop_ids[shop["shopId"]]
        if sme_id not in known:
            continue
        row = existing.get(sme_id)
        if row is None:
            row = SwarmAllocation(project_id=project.id, sme_id=sme_id)
            session.add(row)
        for key, value in {
            "assigned_role": shop["assignedRole"], "share_per_day": Decimal(str(shop["shareBoxesPerDay"])),
            "working_capital_needed": Decimal(str(shop["workingCapitalNeeded"])),
            "current_cash": Decimal(str(shop["currentCash"])), "funding_gap": Decimal(str(shop["fundingGap"])),
            "status": shop["status"], "version": proposal["version"],
        }.items():
            setattr(row, key, value)
        dependencies = request_shops[shop["shopId"]].get("resources")
        if dependencies is not None:
            row.resources_known = True
            await session.flush()
            await session.execute(delete(AllocationResource).where(AllocationResource.allocation_id == row.id))
            for dependency in dependencies:
                session.add(AllocationResource(
                    allocation_id=row.id, resource_id=parse_uuid(dependency["resource_id"]),
                    required=dependency["required"], note=dependency.get("note"),
                ))
    return project.id


async def load_project_id(session: AsyncSession | None, order_ref: str) -> uuid.UUID | None:
    """The stored project for one buyer order, or None when the order is new.

    Resource dependencies are recorded per allocation, so loading them needs the
    project being allocated. A new order has none recorded, which stays unknown
    rather than becoming "depends on nothing".
    """
    if session is None:
        return None
    return await session.scalar(
        select(SwarmProject.id).where(SwarmProject.order_ref == order_ref)
    )


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
        "constraints": project.constraints,
        "productionStart": project.start_date.isoformat() if project.start_date else None,
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
            # business_type falls back to sector; the matcher compares these
            # case-insensitively. Coordinates stay absent when unknown so the
            # distance filter excludes the shop instead of guessing a position.
            "business_type": row.business_type or row.sector,
            "coordinates": (
                None if row.latitude is None or row.longitude is None
                else {"latitude": row.latitude, "longitude": row.longitude}
            ),
        }
        for row in rows
    ]


async def load_recent_records(
    session: AsyncSession | None, sme_id: uuid.UUID | None, limit: int = 2
) -> list[dict]:
    """Latest statements for one SME, newest period first, one row per period.

    The frontend overview needs two: the current period and the one before it,
    so a period-on-period difference can be computed instead of invented.

    Rows are deduplicated by period, keeping the most recently created one. An
    SME can legitimately hold several statements for the same period - a revised
    upload, or a forecast beside an actual - and returning two of those as
    "current" and "previous" would produce a difference of zero that looks
    verified instead of declaring the previous period missing.
    """
    if session is None or sme_id is None:
        return []
    # Within one period an `actual` statement is the authoritative record and a
    # `simulated` one is only a scenario, so kind decides before recency does.
    # Without this, storing a what-if after the real statement would silently
    # make the scenario the basis for grading and funding decisions.
    kind_rank = case(
        (FinancialRecord.kind == "actual", 0),
        (FinancialRecord.kind == "forecast", 1),
        else_=2,
    )
    rows = (
        await session.scalars(
            select(FinancialRecord)
            .where(FinancialRecord.sme_id == sme_id)
            .order_by(
                FinancialRecord.period_end.desc(),
                kind_rank,
                FinancialRecord.created_at.desc(),
            )
        )
    ).all()

    seen: set[tuple] = set()
    unique = []
    for row in rows:
        period = (row.period_start, row.period_end)
        if period in seen:
            continue
        seen.add(period)
        unique.append(row)
        if len(unique) >= limit:
            break
    rows = unique

    return [
        {
            "recordId": str(row.id),
            "payload": row.payload,
            "computed": row.computed,
            "periodStart": row.period_start.isoformat(),
            "periodEnd": row.period_end.isoformat(),
            "kind": row.kind,
            "source": row.source,
        }
        for row in rows
    ]


async def load_sme_name(session: AsyncSession | None, sme_id: uuid.UUID | None) -> str | None:
    if session is None or sme_id is None:
        return None
    profile = await session.get(SmeProfile, sme_id)
    return None if profile is None else profile.name


async def load_active_swarm_proposal(session: AsyncSession | None) -> dict | None:
    """The most recently updated project, which is what the UI calls active."""
    if session is None:
        return None
    project = await session.scalar(
        select(SwarmProject)
        # Same rule as catalog.ACTIVE_PROJECT_ORDER: a declared start_date means
        # a committed engagement, so a draft written by a test does not become
        # "the active proposal".
        .order_by(
            SwarmProject.start_date.desc().nullslast(),
            SwarmProject.updated_at.desc(),
            SwarmProject.created_at.desc(),
        )
        # The shop profile comes along so cost and profit are computed from the
        # stored unit cost instead of being reported as zero.
        .options(selectinload(SwarmProject.allocations).selectinload(SwarmAllocation.sme))
        .limit(1)
    )
    if project is None or not project.allocations:
        return None
    return {
        "project": {
            "orderRef": project.order_ref,
            "buyerName": project.buyer_name,
            "targetCapacity": float(project.target_capacity),
            "unit": project.unit,
            "unitPrice": float(project.unit_price),
            "durationDays": project.duration_days,
            "paymentTermsDays": project.payment_terms_days,
            "depositRatio": float(project.deposit_ratio),
            "status": project.status,
            "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
        },
        "allocations": [
            {
                "shopId": str(allocation.sme_id),
                "shopName": allocation.sme.name if allocation.sme else None,
                "costPerUnit": float(allocation.sme.cost_per_unit) if allocation.sme else None,
                "assignedRole": allocation.assigned_role,
                "sharePerDay": float(allocation.share_per_day),
                "workingCapitalNeeded": float(allocation.working_capital_needed),
                "currentCash": float(allocation.current_cash),
                "fundingGap": float(allocation.funding_gap),
                "status": allocation.status,
                "version": allocation.version,
            }
            for allocation in project.allocations
        ],
    }


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
    replay_version: str | None = None,
    context: dict | None = None,
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
        replay_version=replay_version,
        context=context,
    )
    session.add(simulation)
    await session.flush()
    return simulation.id
