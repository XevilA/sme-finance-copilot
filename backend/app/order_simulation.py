"""Order-only comparisons. Never infer a business cash forecast from totals."""

from decimal import Decimal, localcontext

from pydantic import Field

from .order_cash import finite_order_schedule, peak_cash_deficit
from .schemas import PositiveMoney, Rate, StrictModel
from .swarm import SwarmRequest, allocate, money


class OrderScenario(StrictModel):
    unit_price: PositiveMoney
    cost_per_unit: PositiveMoney | None = None
    deposit_ratio: Rate
    payment_terms_days: int = Field(strict=True, ge=0, le=365)


class OrderSimulationRequest(StrictModel):
    baseline: SwarmRequest
    scenario: OrderScenario
    persist: bool = False
    context_missing: list[str] = Field(default_factory=list, max_length=200)


def order_plan(request: SwarmRequest) -> dict:
    result = allocate(request)
    by_id = {shop.shop_id: shop for shop in request.shops}
    # Show the worst individual shop balance: one shop's surplus cannot fund
    # another without an explicit transfer. No outside cash flows are assumed.
    balances = []
    for allocation in result["data"]["shops"]:
        shop = by_id[allocation["shopId"]]
        share = Decimal(str(allocation["shareBoxesPerDay"]))
        movements = finite_order_schedule(
            daily_cost=share * shop.cost_per_unit,
            revenue=share * request.duration_days * request.unit_price,
            duration_days=request.duration_days,
            payment_terms_days=request.payment_terms_days,
            deposit_ratio=request.deposit_ratio,
            start_date=request.production_start,
            collections=None if request.collection_schedule is None else
                [(row.day_index, row.fraction) for row in request.collection_schedule],
        )
        balances.append(shop.cash_balance - peak_cash_deficit(movements))
    result["data"]["minimumShopCash"] = None if not balances else format(money(min(balances)), "f")
    return result


def simulate_order(request: OrderSimulationRequest) -> dict:
    with localcontext() as context:
        context.prec = 50
        payload = request.baseline.model_dump(mode="json")
        changes = request.scenario.model_dump(mode="json")
        payload.update({key: changes[key] for key in ("unit_price", "deposit_ratio", "payment_terms_days")})
        if changes["cost_per_unit"] is not None:
            for shop in payload["shops"]:
                shop["cost_per_unit"] = changes["cost_per_unit"]
        scenario = SwarmRequest.model_validate(payload)
        plan_a, plan_b = order_plan(request.baseline), order_plan(scenario)
    missing = sorted(set(request.context_missing + plan_a["missing"] + plan_b["missing"] +
                         [f"resources:{shop.shop_id}" for shop in request.baseline.shops if shop.resources is None] +
                         (["assigned_shops"] if plan_b["data"]["minimumShopCash"] is None else [])))
    return {
        "data": {"planA": plan_a["data"], "planB": plan_b["data"],
                 "auditA": plan_a["audit"], "auditB": plan_b["audit"],
                 "scenario": changes, "scope": "order_only",
                 "assumptions": ["Only this order's production costs, deposit and collections are modeled.",
                                 "Minimum cash is the lowest individual assigned shop balance; no inter-shop transfers.",
                                 "A cost override applies to every candidate shop; allocation is recomputed."]},
        "kind": "simulated", "source": "supplied_input", "missing": missing,
        "status": "insufficient_data" if missing else plan_b["status"],
        "asOf": plan_b["asOf"], "analyzedAt": plan_b["analyzedAt"], "unit": "THB",
    }
