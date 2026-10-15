"""Catalogue queries behind the frontend list contracts.

Kept separate from repository.py, which holds the write path and the statement
lookups. Everything here is read-only and returns plain dicts, so the adapters
never touch an ORM object outside a session.
"""

import uuid

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import (
    CashEvent,
    FinancialRecord,
    ChaosScenario,
    FundingProduct,
    InvestorProfile,
    SalesChannel,
    SalesProduct,
    SharedResource,
    SmeProfile,
    SwarmAllocation,
    SwarmProject,
)


# A project with a declared start_date is a committed engagement; one created
# through POST /api/swarm without one is a draft proposal. Ordering by start_date
# first means "the active project" is a real engagement rather than whatever was
# written last - including by a test run against the same database.
ACTIVE_PROJECT_ORDER = (
    SwarmProject.start_date.desc().nullslast(),
    SwarmProject.updated_at.desc(),
    SwarmProject.created_at.desc(),
)


def none_or_float(value) -> float | None:
    return None if value is None else float(value)


def project_row(project: SwarmProject) -> dict:
    return {
        "id": str(project.id),
        "orderRef": project.order_ref,
        "code": project.code,
        "title": project.title,
        "buyerName": project.buyer_name,
        "buyerRating": none_or_float(project.buyer_rating),
        "targetCapacity": float(project.target_capacity),
        "unit": project.unit,
        "unitPrice": float(project.unit_price),
        "durationDays": project.duration_days,
        "paymentTermsDays": project.payment_terms_days,
        "paymentTermsText": project.payment_terms_text,
        "depositRatio": float(project.deposit_ratio),
        "deliveryLocation": project.delivery_location,
        "standard": project.standard,
        "startDate": project.start_date.isoformat() if project.start_date else None,
        "deadline": project.deadline.isoformat() if project.deadline else None,
        "status": project.status,
        "progressPercent": project.progress_percent,
        "riskLevel": project.risk_level,
        "roiEstimatePct": none_or_float(project.roi_estimate_pct),
        "durationMonths": project.duration_months,
        "fundPurpose": project.fund_purpose,
        "evidenceLevel": project.evidence_level,
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
    }


def cash_event_row(event: CashEvent) -> dict:
    return {
        "id": str(event.id),
        "date": event.event_date.isoformat(),
        "dayIndex": event.day_index,
        "type": event.type,
        "title": event.title,
        "amount": float(event.amount),
        "isInflow": event.is_inflow,
        "partner": event.partner,
        "status": event.status,
        "impactReason": event.impact_reason,
    }


async def load_shops(session: AsyncSession | None) -> list[dict]:
    """Every SME, with the latest allocation that carries its order exposure.

    workingCapitalNeeded and fundingGap are order-dependent, so a shop with no
    allocation yet gets None rather than a zero that would read as "no gap".
    """
    if session is None:
        return []
    profiles = (await session.scalars(select(SmeProfile).order_by(SmeProfile.name))).all()
    # Newest project first, then keep the first row seen per shop. Done here
    # rather than with DISTINCT ON so the query stays portable.
    allocations = (
        await session.scalars(
            select(SwarmAllocation)
            .join(SwarmProject, SwarmProject.id == SwarmAllocation.project_id)
            .order_by(SwarmProject.updated_at.desc())
        )
    ).all()
    by_sme: dict = {}
    for allocation in allocations:
        by_sme.setdefault(allocation.sme_id, allocation)

    rows = []
    for profile in profiles:
        allocation = by_sme.get(profile.id)
        rows.append({
            "id": str(profile.id),
            "name": profile.name,
            "monogram": profile.monogram,
            "category": profile.category,
            "capacityTotal": float(profile.capacity_total),
            "capacityUsed": float(profile.capacity_used),
            "unit": profile.unit,
            "costPerUnit": float(profile.cost_per_unit),
            "currentCash": float(profile.cash_balance),
            "minimumCashReserve": float(profile.minimum_cash_reserve),
            "location": profile.location or profile.province,
            "tags": profile.tags or [],
            "statusNote": profile.status_note,
            "businessType": profile.business_type or profile.sector,
            "sector": profile.sector,
            "workingCapitalNeeded": None if allocation is None else float(allocation.working_capital_needed),
            "fundingGap": None if allocation is None else float(allocation.funding_gap),
            "allocationStatus": None if allocation is None else allocation.status,
        })
    return rows


async def load_latest_project(session: AsyncSession | None) -> dict | None:
    if session is None:
        return None
    project = await session.scalar(
        select(SwarmProject).order_by(*ACTIVE_PROJECT_ORDER).limit(1)
    )
    return None if project is None else project_row(project)


async def load_projects_with_detail(session: AsyncSession | None) -> list[dict]:
    if session is None:
        return []
    projects = (
        await session.scalars(
            select(SwarmProject)
            .order_by(*ACTIVE_PROJECT_ORDER)
            .options(
                selectinload(SwarmProject.allocations).selectinload(SwarmAllocation.sme),
                selectinload(SwarmProject.deliveries),
                selectinload(SwarmProject.evidence),
            )
        )
    ).all()

    rows = []
    for project in projects:
        row = project_row(project)
        row["allocations"] = [
            {
                "shopId": str(allocation.sme_id),
                "shopName": allocation.sme.name if allocation.sme else None,
                "sharePerDay": float(allocation.share_per_day),
                "fundingGap": float(allocation.funding_gap),
                "status": allocation.status,
            }
            for allocation in project.allocations
        ]
        row["deliveries"] = [
            {
                "day": delivery.day,
                "date": delivery.delivery_date.isoformat(),
                "targetUnits": float(delivery.target_units),
                "deliveredUnits": float(delivery.delivered_units),
                "status": delivery.status,
            }
            for delivery in sorted(project.deliveries, key=lambda item: item.day)
        ]
        row["evidence"] = [
            {
                "title": item.title,
                "verified": item.verified,
                "date": item.document_date.isoformat() if item.document_date else "",
            }
            for item in project.evidence
        ]
        rows.append(row)
    return rows


async def load_shop_allocation(
    session: AsyncSession | None, sme_id: uuid.UUID, order_ref: str | None = None
) -> dict | None:
    """The shop share of one project, plus that project's cash events.

    Without `order_ref` this is the most recently updated project the shop
    appears in, which is whatever was written last - including by a test run
    against the same database. A demo should pass order_ref to be deterministic.
    """
    if session is None:
        return None
    query = (
        select(SwarmAllocation)
        .join(SwarmProject, SwarmProject.id == SwarmAllocation.project_id)
        .where(SwarmAllocation.sme_id == sme_id)
        .order_by(*ACTIVE_PROJECT_ORDER)
        .options(selectinload(SwarmAllocation.sme), selectinload(SwarmAllocation.project))
        .limit(1)
    )
    if order_ref:
        query = query.where(SwarmProject.order_ref == order_ref)
    allocation = await session.scalar(query)
    if allocation is None:
        return None

    events = (
        await session.scalars(
            select(CashEvent)
            .where(CashEvent.project_id == allocation.project_id, CashEvent.sme_id == sme_id)
            .order_by(CashEvent.day_index)
        )
    ).all()

    return {
        "allocation": {
            "shopId": str(allocation.sme_id),
            "assignedRole": allocation.assigned_role,
            "sharePerDay": float(allocation.share_per_day),
            "workingCapitalNeeded": float(allocation.working_capital_needed),
            "currentCash": float(allocation.current_cash),
            "fundingGap": float(allocation.funding_gap),
            "status": allocation.status,
            "sellingPricePerUnit": none_or_float(allocation.selling_price_per_unit),
            "rawMaterialCost": none_or_float(allocation.raw_material_cost),
            "additionalLaborCost": none_or_float(allocation.additional_labor_cost),
            "deliveryCost": none_or_float(allocation.delivery_cost),
            "serviceFee": none_or_float(allocation.service_fee),
            "buyerSigned": allocation.buyer_signed,
            "shopSigned": allocation.shop_signed,
            "logisticsSigned": allocation.logistics_signed,
            "funderSigned": allocation.funder_signed,
        },
        "shop": {
            "name": allocation.sme.name if allocation.sme else None,
            "monogram": allocation.sme.monogram if allocation.sme else None,
            "minimumCashReserve": none_or_float(allocation.sme.minimum_cash_reserve) if allocation.sme else None,
        },
        "project": project_row(allocation.project),
        "events": [cash_event_row(event) for event in events],
    }


async def load_cash_events(session: AsyncSession | None, sme_id: uuid.UUID | None) -> list[dict]:
    if session is None:
        return []
    query = select(CashEvent).order_by(CashEvent.event_date, CashEvent.day_index)
    if sme_id is not None:
        query = query.where(CashEvent.sme_id == sme_id)
    return [cash_event_row(event) for event in (await session.scalars(query)).all()]


async def load_sales_products(session: AsyncSession | None, sme_id: uuid.UUID | None) -> list[dict]:
    if session is None:
        return []
    query = select(SalesProduct).order_by(SalesProduct.revenue.desc())
    if sme_id is not None:
        query = query.where(SalesProduct.sme_id == sme_id)
    return [
        {
            "id": str(row.id),
            "name": row.name,
            "category": row.category,
            "unitsSold": row.units_sold,
            "revenue": float(row.revenue),
            "cost": float(row.cost),
            "turnoverDays": none_or_float(row.turnover_days),
        }
        for row in (await session.scalars(query)).all()
    ]


async def load_sales_channels(session: AsyncSession | None, sme_id: uuid.UUID | None) -> list[dict]:
    if session is None:
        return []
    query = select(SalesChannel).order_by(SalesChannel.gross_sales.desc())
    if sme_id is not None:
        query = query.where(SalesChannel.sme_id == sme_id)
    return [
        {
            "channel": row.channel,
            "grossSales": float(row.gross_sales),
            "commissionFee": float(row.commission_fee),
            "adCost": float(row.ad_cost),
            "deliveryCost": float(row.delivery_cost),
        }
        for row in (await session.scalars(query)).all()
    ]


async def load_shared_resources(session: AsyncSession | None) -> list[dict]:
    if session is None:
        return []
    rows = (
        await session.scalars(
            select(SharedResource)
            .order_by(SharedResource.category, SharedResource.title)
            .options(selectinload(SharedResource.owner))
        )
    ).all()
    return [
        {
            "id": str(row.id),
            "title": row.title,
            "category": row.category,
            "categoryLabel": row.category_label,
            "ownerShop": row.owner.name if row.owner else "",
            "location": row.location,
            "capacityText": row.capacity_text,
            "priceText": row.price_text,
            "unitPrice": float(row.unit_price),
            "availability": row.availability,
            "status": row.status,
            "imageUrl": row.image_url,
            "impactIfDetached": {
                "additionalCost": float(row.impact_additional_cost),
                "delayDays": row.impact_delay_days,
                "bottleneckMessage": row.impact_message,
                "affectedShopIds": row.affected_sme_ids or [],
            },
        }
        for row in rows
    ]


async def load_chaos_scenarios(session: AsyncSession | None) -> list[dict]:
    if session is None:
        return []
    rows = (
        await session.scalars(
            select(ChaosScenario).order_by(ChaosScenario.severity, ChaosScenario.slug)
        )
    ).all()
    return [
        {
            "id": row.slug,
            "title": row.title,
            "category": row.category,
            "severity": row.severity,
            "description": row.description,
            "triggerNodeId": row.trigger_node_id,
            "propagationPath": row.propagation_path or [],
            "cashImpactAmount": float(row.cash_impact_amount),
            "deficitDays": row.deficit_days or [],
            "contingencyOptions": row.contingency_options or [],
            "calculatedResults": {
                "revenueLoss": float(row.revenue_loss),
                "additionalCost": float(row.additional_cost),
                "newDeficitAmount": float(row.new_deficit_amount),
                "deliveryDelayDays": row.delivery_delay_days,
            },
        }
        for row in rows
    ]


async def load_funding_products(session: AsyncSession | None) -> list[dict]:
    if session is None:
        return []
    rows = (
        await session.scalars(
            select(FundingProduct)
            .where(FundingProduct.active.is_(True))
            .order_by(FundingProduct.provider)
        )
    ).all()
    return [
        {
            "id": str(row.id),
            "name": row.name,
            "provider": row.provider,
            "type": row.type,
            "minAmount": float(row.min_amount),
            "maxAmount": float(row.max_amount),
            "interestRateAnnual": float(row.interest_rate_annual),
            "termMonths": row.term_months,
            "disbursementDays": row.disbursement_days,
            "minDscr": none_or_float(row.min_dscr),
            "requiredDocs": row.required_docs or [],
            "eligibility": row.eligibility or [],
        }
        for row in rows
    ]


async def load_investor_profiles(session: AsyncSession | None) -> list[dict]:
    """Active investors in snake_case, which the matcher accepts directly."""
    if session is None:
        return []
    rows = (
        await session.scalars(
            select(InvestorProfile)
            .where(InvestorProfile.active.is_(True))
            .order_by(InvestorProfile.name)
        )
    ).all()
    return [
        {
            # The matcher's Investor model keys on `id`; it returns the match
            # under `investor_id`, which is a different field.
            "id": str(row.id),
            "name": row.name,
            "type": row.type,
            "province": row.province,
            "ticket_min": none_or_float(row.ticket_min),
            "ticket_max": none_or_float(row.ticket_max),
            "target_sectors": row.target_sectors or [],
            "risk_appetite": row.risk_appetite,
            "min_grade": row.min_grade,
            "min_dscr": none_or_float(row.min_dscr),
            "horizon_months": row.horizon_months,
            "contact_email": row.contact_email,
        }
        for row in rows
    ]


async def load_default_statement(session: AsyncSession | None) -> dict | None:
    """The statement to answer with when the caller names no SME.

    The deployed frontend client sends no query parameters, so without this the
    dashboard screens fall back to the example JSON and show a placeholder shop
    name while real seeded data sits unused. Stored data wins over the example.

    Deterministic: an `actual` statement outranks a forecast or a scenario, then
    the most recent period, then the SME name, so the same row is chosen on
    every request.
    """
    if session is None:
        return None
    kind_rank = case(
        (FinancialRecord.kind == "actual", 0),
        (FinancialRecord.kind == "forecast", 1),
        else_=2,
    )
    row = (
        await session.execute(
            select(FinancialRecord, SmeProfile.name)
            .join(SmeProfile, SmeProfile.id == FinancialRecord.sme_id)
            .order_by(kind_rank, FinancialRecord.period_end.desc(), SmeProfile.name)
            .limit(1)
        )
    ).first()
    if row is None:
        return None
    record, shop_name = row
    return {
        "smeId": str(record.sme_id),
        "shopName": shop_name,
        "payload": record.payload,
        "kind": record.kind,
        "periodEnd": record.period_end.isoformat(),
    }
