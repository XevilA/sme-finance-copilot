"""Deterministic swarm allocation engine.

Splits one buyer order across SME shops by capacity, then prices each shop's
working-capital exposure and funding gap. Pure Decimal math, no I/O, no RNG:
the same request always yields the same proposal.
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .schemas import PositiveMoney, Rate

ZERO = Decimal("0")
# A shop is flagged "review" rather than "blocked" while its gap stays within
# this share of its own working-capital need (bridgeable by short-term funding).
REVIEW_GAP_THRESHOLD = Decimal("0.30")

ROLE_LADDER = ["lead_producer", "co_producer", "finisher", "support"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ShopCapacity(StrictModel):
    shop_id: str
    name: str
    capacity_total: PositiveMoney
    capacity_used: PositiveMoney = Decimal("0")
    cost_per_unit: PositiveMoney
    cash_balance: PositiveMoney = Decimal("0")
    minimum_cash_reserve: PositiveMoney = Decimal("0")
    assigned_role: str | None = None


class SwarmRequest(StrictModel):
    order_ref: str
    buyer_name: str
    target_capacity: PositiveMoney = Field(gt=0)
    unit: str = "box"
    unit_price: PositiveMoney
    duration_days: int = Field(strict=True, gt=0, le=3650)
    payment_terms_days: int = Field(strict=True, ge=0, le=365)
    deposit_ratio: Rate = Decimal("0")
    shops: list[ShopCapacity] = Field(min_length=1, max_length=200)


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def as_number(value: Decimal) -> float:
    """JSON number for the UI contract. The audit block keeps exact strings."""
    return float(money(value))


def allocate(request: SwarmRequest) -> dict:
    with localcontext() as context:
        context.prec = 50
        return _allocate(request)


def _allocate(request: SwarmRequest) -> dict:
    cash_cycle_days = Decimal(request.duration_days + request.payment_terms_days)
    duration = Decimal(request.duration_days)

    # Cheapest unit cost first; ties broken by larger free capacity, then shop_id
    # so the ordering is stable regardless of request order.
    candidates = sorted(
        request.shops,
        key=lambda shop: (shop.cost_per_unit, -(shop.capacity_total - shop.capacity_used), shop.shop_id),
    )

    remaining = request.target_capacity
    shops: list[dict] = []
    audit: list[dict] = []
    stuck_reasons: list[dict] = []
    totals = {"capacity": ZERO, "cost": ZERO, "revenue": ZERO, "gap": ZERO, "wc": ZERO}

    for rank, shop in enumerate(candidates):
        available = max(ZERO, shop.capacity_total - shop.capacity_used)
        share = min(available, remaining)
        if share <= 0:
            continue
        remaining -= share

        revenue = share * duration * request.unit_price
        cost = share * duration * shop.cost_per_unit
        # Cash locked up for one full produce-to-payment cycle.
        working_capital = share * shop.cost_per_unit * cash_cycle_days
        deposit = revenue * request.deposit_ratio
        usable_cash = max(ZERO, shop.cash_balance - shop.minimum_cash_reserve)
        funding_gap = max(ZERO, working_capital - usable_cash - deposit)

        if funding_gap == 0:
            status: Literal["ready", "review", "blocked"] = "ready"
        elif working_capital > 0 and funding_gap <= working_capital * REVIEW_GAP_THRESHOLD:
            status = "review"
        else:
            status = "blocked"

        role = shop.assigned_role or ROLE_LADDER[min(rank, len(ROLE_LADDER) - 1)]

        shops.append({
            "shopId": shop.shop_id,
            "shareBoxesPerDay": as_number(share),
            "workingCapitalNeeded": as_number(working_capital),
            "currentCash": as_number(shop.cash_balance),
            "fundingGap": as_number(funding_gap),
            "status": status,
            "assignedRole": role,
        })
        audit.append({
            "shopId": shop.shop_id,
            "name": shop.name,
            "sharePerDay": format(money(share), "f"),
            "revenue": format(money(revenue), "f"),
            "cost": format(money(cost), "f"),
            "grossProfit": format(money(revenue - cost), "f"),
            "workingCapitalNeeded": format(money(working_capital), "f"),
            "usableCash": format(money(usable_cash), "f"),
            "depositApplied": format(money(deposit), "f"),
            "fundingGap": format(money(funding_gap), "f"),
            "formula": "working_capital = share_per_day * cost_per_unit * (duration_days + payment_terms_days); "
                       "funding_gap = max(0, working_capital - max(0, cash_balance - minimum_cash_reserve) - revenue * deposit_ratio)",
        })

        totals["capacity"] += share
        totals["cost"] += cost
        totals["revenue"] += revenue
        totals["gap"] += funding_gap
        totals["wc"] += working_capital

        if status == "blocked":
            stuck_reasons.append({
                "type": "funding",
                "shopId": shop.shop_id,
                "title": f"{shop.name} cannot fund its share",
                "message": f"Funding gap of THB {money(funding_gap)} against a working-capital need of THB {money(working_capital)}.",
                "actionLabel": "Match funding",
                "actionTarget": "/api/match-funding",
            })

        if remaining <= 0:
            break

    deficit = max(ZERO, remaining)
    if deficit > 0:
        stuck_reasons.append({
            "type": "capacity",
            "title": "Swarm capacity is short of the order",
            "message": f"{money(deficit)} {request.unit}/day unassigned out of a target of {money(request.target_capacity)}.",
            "actionLabel": "Invite more shops",
            "actionTarget": "/api/swarm",
        })

    if deficit > 0:
        proposal_status = "incomplete"
    elif stuck_reasons or totals["gap"] > 0:
        proposal_status = "has_issues"
    else:
        proposal_status = "ready"

    now = datetime.now(timezone.utc).isoformat()
    return {
        "data": {
            "orderId": request.order_ref,
            "shops": shops,
            "totalCapacityAssigned": as_number(totals["capacity"]),
            "targetCapacity": as_number(request.target_capacity),
            "deficitBoxesPerDay": as_number(deficit),
            "totalCost": as_number(totals["cost"]),
            "totalRevenue": as_number(totals["revenue"]),
            "totalProfit": as_number(totals["revenue"] - totals["cost"]),
            "totalFundingGap": as_number(totals["gap"]),
            "status": proposal_status,
            "stuckReasons": stuck_reasons,
            "version": "v1",
        },
        "kind": "forecast",
        "status": "ok" if proposal_status == "ready" else "insufficient_data" if proposal_status == "incomplete" else "stale",
        "missing": [],
        "asOf": now,
        "analyzedAt": now,
        "unit": "THB",
        "audit": {
            "engine": "swarm-allocator/v1",
            "rule": "cheapest unit cost first, then largest free capacity",
            "cashCycleDays": int(cash_cycle_days),
            "totalWorkingCapital": format(money(totals["wc"]), "f"),
            "shops": audit,
        },
    }
