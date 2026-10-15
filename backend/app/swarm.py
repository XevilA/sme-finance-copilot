"""Deterministic swarm allocation engine.

Splits one buyer order across SME shops by capacity, then prices each shop's
working-capital exposure and funding gap. Pure Decimal math, no I/O, no RNG:
the same request always yields the same proposal.
"""

from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, localcontext
from math import atan2, cos, radians, sin, sqrt
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator, model_validator

from .order_cash import finite_order_schedule, peak_cash_deficit
from .schemas import PositiveMoney, Rate, parse_decimal

ZERO = Decimal("0")
# A shop is flagged "review" rather than "blocked" while its gap stays within
# this share of its own working-capital need (bridgeable by short-term funding).
REVIEW_GAP_THRESHOLD = Decimal("0.30")

ROLE_LADDER = ["lead_producer", "co_producer", "finisher", "support"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Coordinates(StrictModel):
    latitude: Annotated[Decimal, BeforeValidator(parse_decimal), Field(ge=-90, le=90, max_digits=12, decimal_places=8)]
    longitude: Annotated[Decimal, BeforeValidator(parse_decimal), Field(ge=-180, le=180, max_digits=12, decimal_places=8)]


class BuyerCollection(StrictModel):
    day_index: int = Field(strict=True, ge=0, le=10000)
    fraction: Rate


class ResourceDependency(StrictModel):
    resource_id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=500)
    category: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=50)
    available: bool = Field(strict=True)
    required: bool = Field(strict=True)
    owned_by_shop: bool = Field(default=False, strict=True)
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("resource_id")
    @classmethod
    def normalize_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("resource_id cannot be blank")
        return value.strip()


class ShopCapacity(StrictModel):
    shop_id: str = Field(min_length=1, max_length=128)
    name: str
    capacity_total: PositiveMoney
    capacity_used: PositiveMoney = Decimal("0")
    cost_per_unit: PositiveMoney
    cash_balance: PositiveMoney = Decimal("0")
    minimum_cash_reserve: PositiveMoney = Decimal("0")
    assigned_role: str | None = None
    business_type: str | None = None
    coordinates: Coordinates | None = None
    resources: list[ResourceDependency] | None = Field(default=None, max_length=200)

    @field_validator("shop_id")
    @classmethod
    def normalize_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("shop_id cannot be blank")
        return value.strip()

    @model_validator(mode="after")
    def validate_capacity(self):
        if self.capacity_used > self.capacity_total:
            raise ValueError("capacity_used cannot exceed capacity_total")
        ids = [row.resource_id for row in self.resources or []]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate resource ids are not allowed for one shop")
        return self


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
    production_start: date | None = None
    collection_schedule: list[BuyerCollection] | None = Field(default=None, max_length=100)
    required_business_types: list[str] = Field(default_factory=list, max_length=30)
    buyer_coordinates: Coordinates | None = None
    max_distance_km: PositiveMoney | None = None

    @model_validator(mode="after")
    def validate_allocation_inputs(self):
        ids = [shop.shop_id for shop in self.shops]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate shop ids are not allowed")
        if self.max_distance_km is not None and self.buyer_coordinates is None:
            raise ValueError("buyer_coordinates are required for a distance limit")
        if self.required_business_types and any(not value.strip() for value in self.required_business_types):
            raise ValueError("required_business_types cannot contain blank values")
        if self.collection_schedule is not None and sum((row.fraction for row in self.collection_schedule), ZERO) != 1:
            raise ValueError("Collection fractions must sum to one for the invoice balance")
        if self.production_start is not None:
            last_day = max([self.duration_days + self.payment_terms_days, *(row.day_index for row in self.collection_schedule or [])])
            if self.production_start.toordinal() + last_day > date.max.toordinal():
                raise ValueError("Cash schedule dates exceed the supported calendar")
        return self


def shop_eligibility(shop: ShopCapacity, request: SwarmRequest) -> dict:
    """Haversine distance in km, not road distance or travel time."""
    reasons = []
    allowed = {value.strip().casefold() for value in request.required_business_types}
    if allowed and (shop.business_type or "").strip().casefold() not in allowed:
        reasons.append("Business type is missing or does not match the order")
    distance = None
    if request.buyer_coordinates is not None and shop.coordinates is not None:
        origin, target = request.buyer_coordinates, shop.coordinates
        lat1, lat2 = radians(float(origin.latitude)), radians(float(target.latitude))
        delta_lon = radians(float(target.longitude - origin.longitude))
        a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
        a = max(0.0, min(1.0, a))
        distance = Decimal(str(6371.0088 * 2 * atan2(sqrt(a), sqrt(1 - a)))).quantize(Decimal("0.000001"))
    if request.max_distance_km is not None:
        if distance is None:
            reasons.append("Shop coordinates are required to verify distance eligibility")
        elif distance > request.max_distance_km:
            reasons.append("Shop exceeds max_distance_km")
    missing_resources, preferences = [], []
    for resource in sorted(shop.resources or [], key=lambda row: row.resource_id):
        if resource.available and resource.status == "confirmed":
            continue
        item = {"resource_id": resource.resource_id, "title": resource.title,
                "category": resource.category, "status": resource.status,
                "required": resource.required, "reason": "Resource must be available and confirmed"}
        if resource.required:
            missing_resources.append(item)
            reasons.append(f"Required resource unavailable: {resource.resource_id} ({resource.title}); status={resource.status}")
        else:
            preferences.append(item)
    return {"eligible": not reasons, "distance_km": None if distance is None else str(distance), "reasons": reasons,
            "resource_status": "unknown" if shop.resources is None else "known_empty" if not shop.resources else "checked",
            "missing_resources": missing_resources, "unavailable_preferences": preferences,
            "resource_unknowns": ["resource_dependencies"] if shop.resources is None else []}


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

    assessments = {shop.shop_id: shop_eligibility(shop, request) for shop in request.shops}
    # Eligibility precedes cost, distance, free capacity, and stable id ranking.
    candidates = sorted(
        [shop for shop in request.shops if assessments[shop.shop_id]["eligible"]],
        key=lambda shop: (shop.cost_per_unit,
                          Decimal(assessments[shop.shop_id]["distance_km"]) if assessments[shop.shop_id]["distance_km"] is not None else Decimal("Infinity"),
                          -(shop.capacity_total - shop.capacity_used), shop.shop_id),
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
        # Business assumption: a finite order, with no production during credit days.
        schedule = finite_order_schedule(
            daily_cost=share * shop.cost_per_unit, revenue=revenue,
            duration_days=request.duration_days, payment_terms_days=request.payment_terms_days,
            deposit_ratio=request.deposit_ratio, start_date=request.production_start,
            collections=None if request.collection_schedule is None else [(row.day_index, row.fraction) for row in request.collection_schedule],
        )
        working_capital = peak_cash_deficit(schedule, include_deposit=False)
        deposit = revenue * request.deposit_ratio
        usable_cash = max(ZERO, shop.cash_balance - shop.minimum_cash_reserve)
        funding_gap = max(ZERO, peak_cash_deficit(schedule) - usable_cash)

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
            "formula": "finite order; working_capital = peak cumulative production-cost deficit after buyer collections, excluding initial deposit; "
                       "funding_gap = max(0, peak cumulative deficit including deposit - max(0, cash_balance - minimum_cash_reserve)); costs precede same-day collections",
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
        exclusions = "; ".join(f"{shop_id}: {', '.join(item['reasons'])}" for shop_id, item in sorted(assessments.items()) if not item["eligible"])
        stuck_reasons.append({
            "type": "capacity",
            "title": "Swarm capacity is short of the order",
            "message": f"{money(deficit)} {request.unit}/day unassigned out of a target of {money(request.target_capacity)}." + (f" Exclusions: {exclusions}" if exclusions else ""),
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
            "version": "v2",
        },
        "kind": "forecast",
        "source": "supplied_input",
        "status": "ok" if proposal_status == "ready" else "insufficient_data" if proposal_status == "incomplete" else "stale",
        "missing": [],
        "asOf": now,
        "analyzedAt": now,
        "unit": "THB",
        "audit": {
            "engine": "swarm-allocator/v2",
            "rule": "finite order; eligible business type, distance and required resources, then cost, distance, free capacity, shop_id",
            "cashCycleDays": int(cash_cycle_days),
            "totalWorkingCapital": format(money(totals["wc"]), "f"),
            "shops": audit,
            "eligibility": {shop_id: assessments[shop_id] for shop_id in sorted(assessments)},
        },
    }
