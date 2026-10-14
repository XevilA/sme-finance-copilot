"""What-If scenario engine (Module 6).

Takes a validated baseline statement, applies scenario levers, and returns
Plan A (baseline) against Plan B (scenario) with a field-by-field delta.
Pure Decimal math, no I/O, no RNG: the same request always yields the same
comparison.

Every derived adjustment is listed in the response's `assumptions`, because a
sales shock that left operating cash and CFADS untouched would leave DSCR - and
therefore 35% of the grade - frozen, which would make the simulator useless.
Nothing is adjusted silently.
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Annotated

from pydantic import BeforeValidator, Field

from .finance import calculate_business_metrics, calculate_financials
from .grading import grade_financials
from .schemas import FinancialInput, LoanTerms, PositiveMoney, StrictModel, parse_decimal
from .swarm import ShopCapacity, SwarmRequest, allocate, money

ZERO = Decimal("0")
ONE = Decimal("1")

# -100% to +1000%, signed: a scenario may halve sales or grow them tenfold.
Pct = Annotated[Decimal, BeforeValidator(parse_decimal), Field(ge=-1, le=10, max_digits=12, decimal_places=6)]

CASH_FIELDS = ("cash_balance", "operating_cash_flow", "cash_available_for_debt_service")


class Scenario(StrictModel):
    label: str = "Plan B"

    # Revenue side
    revenue_change_pct: Pct | None = None
    units_sold_change_pct: Pct | None = None
    unit_price_change_pct: Pct | None = None

    # Cost side. cost_change_pct is the blanket shock; a specific lever wins
    # over it for its own field.
    cost_change_pct: Pct | None = None
    cogs_change_pct: Pct | None = None
    operating_expenses_change_pct: Pct | None = None
    fixed_costs_change_pct: Pct | None = None
    variable_cost_change_pct: Pct | None = None

    # Cash timing and funding
    collection_delay_days: int = Field(default=0, strict=True, ge=-365, le=365)
    extra_funding: PositiveMoney = Decimal("0")

    # Debt
    loan: LoanTerms | None = None
    drop_loan: bool = False

    # Swarm composition
    remove_shops: list[str] = Field(default_factory=list, max_length=200)
    add_shops: list[ShopCapacity] = Field(default_factory=list, max_length=200)


class SimulateRequest(StrictModel):
    sme_id: str | None = None
    persist: bool = True
    scenario_key: str = "what_if"
    input: FinancialInput
    scenario: Scenario
    swarm: SwarmRequest | None = None


def scaled(value: Decimal | None, pct: Decimal | None) -> Decimal | None:
    if value is None or pct is None:
        return value
    return money(value * (ONE + pct))


def net_profit_of(payload: dict) -> Decimal | None:
    """Recomputes profit from the P&L so the scaled lines stay self-consistent."""
    revenue = payload.get("revenue")
    if revenue is None:
        return None
    if payload.get("total_expenses") is not None:
        return money(revenue - payload["total_expenses"])
    parts = ("cost_of_goods_sold", "operating_expenses", "interest_expense", "tax_expense")
    if any(payload.get(field) is None for field in parts):
        return None
    return money(revenue - sum(payload[field] for field in parts))


def apply_scenario(data: FinancialInput, scenario: Scenario) -> tuple[FinancialInput, list[str], list[str]]:
    """Returns the Plan B statement plus the assumptions and notes behind it."""
    with localcontext() as context:
        context.prec = 50
        payload = data.model_dump()
        assumptions: list[str] = []
        notes: list[str] = []
        blanket = scenario.cost_change_pct

        def cost_pct(specific: Decimal | None) -> Decimal | None:
            return specific if specific is not None else blanket

        baseline_profit = net_profit_of(payload)

        payload["revenue"] = scaled(payload["revenue"], scenario.revenue_change_pct)
        payload["unit_price"] = scaled(payload["unit_price"], scenario.unit_price_change_pct)
        if payload["units_sold"] is not None and scenario.units_sold_change_pct is not None:
            units = Decimal(payload["units_sold"]) * (ONE + scenario.units_sold_change_pct)
            payload["units_sold"] = int(units.to_integral_value(rounding=ROUND_HALF_UP))

        for field, specific in (
            ("cost_of_goods_sold", scenario.cogs_change_pct),
            ("operating_expenses", scenario.operating_expenses_change_pct),
            ("fixed_costs", scenario.fixed_costs_change_pct),
            ("variable_cost_per_unit", scenario.variable_cost_change_pct),
            ("total_expenses", None),
            ("operating_cash_outflow", None),
        ):
            payload[field] = scaled(payload[field], cost_pct(specific))
        if blanket is not None:
            assumptions.append(
                "cost_change_pct scales cost_of_goods_sold, operating_expenses, fixed_costs, "
                "variable_cost_per_unit, total_expenses and operating_cash_outflow unless a "
                "specific lever overrides that field"
            )

        # Profit follows the scaled P&L, and the profit delta flows into
        # operating cash and CFADS so DSCR and the grade actually move.
        scenario_profit = net_profit_of(payload)
        if baseline_profit is not None and scenario_profit is not None:
            profit_delta = scenario_profit - baseline_profit
            if payload["net_income"] is not None:
                payload["net_income"] = money(payload["net_income"] + profit_delta)
            else:
                payload["net_income"] = scenario_profit
            assumptions.append("net_income moves by the recomputed profit delta from the scaled P&L lines")
            if profit_delta != 0:
                for field in ("operating_cash_flow", "cash_available_for_debt_service", "cash_balance"):
                    if payload[field] is not None:
                        payload[field] = money(payload[field] + profit_delta)
                assumptions.append(
                    "the profit delta is treated as cash in the same period, so it also moves "
                    "operating_cash_flow, cash_available_for_debt_service and cash_balance"
                )

        period_days = Decimal((data.period_end - data.period_start).days + 1)
        if scenario.collection_delay_days and payload["revenue"] is not None:
            deferred = money(payload["revenue"] * Decimal(scenario.collection_delay_days) / period_days)
            for field in CASH_FIELDS:
                if payload[field] is not None:
                    payload[field] = money(payload[field] - deferred)
            assumptions.append(
                f"collection_delay_days defers revenue * {scenario.collection_delay_days}/{period_days} "
                f"= THB {deferred} out of cash for the period"
            )

        if scenario.extra_funding > 0:
            amount = scenario.extra_funding
            payload["assets"] = money(payload["assets"] + amount)
            payload["liabilities"] = money(payload["liabilities"] + amount)
            for field in ("current_assets", "cash_balance", "committed_funding"):
                if payload[field] is not None:
                    payload[field] = money(payload[field] + amount)
            assumptions.append(
                "extra_funding is drawn as debt: it raises assets and liabilities together, "
                "so the accounting identity still holds"
            )

        if payload["cash_balance"] is not None and payload["cash_balance"] < 0:
            notes.append(
                f"cash_balance fell to THB {payload['cash_balance']} and was floored at 0; "
                "the shortfall is the real funding need"
            )
            payload["cash_balance"] = ZERO

        if scenario.drop_loan:
            payload["loan"] = None
        elif scenario.loan is not None:
            payload["loan"] = scenario.loan.model_dump()

        payload["kind"] = "simulated"
        return FinancialInput.model_validate(payload), assumptions, notes


def scenario_swarm(request: SwarmRequest, scenario: Scenario) -> SwarmRequest:
    removed = set(scenario.remove_shops)
    shops = [shop for shop in request.shops if shop.shop_id not in removed]
    existing = {shop.shop_id for shop in shops}
    shops += [shop for shop in scenario.add_shops if shop.shop_id not in existing]
    return request.model_copy(update={"shops": shops})


def build_plan(label: str, data: FinancialInput, swarm: SwarmRequest | None) -> dict:
    plan = {
        "label": label,
        "input": data.model_dump(mode="json"),
        "metrics": calculate_financials(data)["data"],
        "businessMetrics": calculate_business_metrics(data),
        "grading": grade_financials(data),
    }
    if swarm is not None:
        plan["swarm"] = allocate(swarm)["data"]
    return plan


def metric_delta(before: dict | None, after: dict | None) -> dict:
    if not isinstance(before, dict) or not isinstance(after, dict):
        return {"status": "unavailable", "reason": "metric missing from one plan"}
    if before.get("status") != "ok" or after.get("status") != "ok":
        return {
            "status": "unavailable",
            "reason": "metric is not available in both plans",
            "planAStatus": before.get("status"),
            "planBStatus": after.get("status"),
        }
    with localcontext() as context:
        context.prec = 50
        start = Decimal(before["value"])
        end = Decimal(after["value"])
        change = end - start
        pct = None if start == 0 else change / start * 100
        return {
            "status": "ok",
            "unit": before.get("unit"),
            "planA": before["value"],
            "planB": after["value"],
            "change": format(money(change) if before.get("unit") == "THB" else
                             change.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP), "f"),
            "changePct": None if pct is None else format(pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f"),
            "direction": "flat" if change == 0 else "up" if change > 0 else "down",
        }


def number_delta(before: float | int, after: float | int) -> dict:
    start = Decimal(str(before))
    end = Decimal(str(after))
    change = end - start
    pct = None if start == 0 else change / start * 100
    return {
        "status": "ok",
        "planA": float(money(start)),
        "planB": float(money(end)),
        "change": float(money(change)),
        "changePct": None if pct is None else float(pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "direction": "flat" if change == 0 else "up" if change > 0 else "down",
    }


SWARM_TOTALS = (
    "totalCapacityAssigned", "deficitBoxesPerDay", "totalCost",
    "totalRevenue", "totalProfit", "totalFundingGap",
)
# Metrics where a rise is bad news for the SME.
LOWER_IS_BETTER = {"funding_gap", "total_cost", "cost_per_unit", "breakeven_units", "debt_ratio", "pmt"}


def compare(plan_a: dict, plan_b: dict) -> dict:
    delta: dict = {"metrics": {}, "businessMetrics": {}}
    improved: list[str] = []
    worsened: list[str] = []

    for group in ("metrics", "businessMetrics"):
        for name in sorted(set(plan_a[group]) | set(plan_b[group])):
            item = metric_delta(plan_a[group].get(name), plan_b[group].get(name))
            delta[group][name] = item
            if item["status"] != "ok" or item["direction"] == "flat":
                continue
            better = item["direction"] == ("down" if name in LOWER_IS_BETTER else "up")
            (improved if better else worsened).append(name)

    grade_a = plan_a["grading"]
    grade_b = plan_b["grading"]
    delta["grading"] = {
        "planA": {"grade": grade_a["grade"], "score": grade_a["score"], "status": grade_a["status"]},
        "planB": {"grade": grade_b["grade"], "score": grade_b["score"], "status": grade_b["status"]},
        "gradeChanged": grade_a["grade"] != grade_b["grade"],
        "policyVersion": grade_b["policyVersion"],
    }
    if grade_a["score"] is not None and grade_b["score"] is not None:
        score_change = Decimal(grade_b["score"]) - Decimal(grade_a["score"])
        delta["grading"]["scoreChange"] = format(score_change.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f")
        if score_change != 0:
            (improved if score_change > 0 else worsened).append("grade_score")

    if "swarm" in plan_a and "swarm" in plan_b:
        swarm_delta = {name: number_delta(plan_a["swarm"][name], plan_b["swarm"][name]) for name in SWARM_TOTALS}
        swarm_delta["status"] = {"planA": plan_a["swarm"]["status"], "planB": plan_b["swarm"]["status"]}
        swarm_delta["shopsAssigned"] = number_delta(len(plan_a["swarm"]["shops"]), len(plan_b["swarm"]["shops"]))
        delta["swarm"] = swarm_delta
        for name in ("totalFundingGap", "deficitBoxesPerDay", "totalProfit"):
            item = swarm_delta[name]
            if item["direction"] == "flat":
                continue
            better = item["direction"] == ("up" if name == "totalProfit" else "down")
            (improved if better else worsened).append(f"swarm.{name}")

    delta["summary"] = {
        "improved": sorted(improved),
        "worsened": sorted(worsened),
        "verdict": "better" if improved and not worsened else
                   "worse" if worsened and not improved else
                   "mixed" if improved and worsened else "unchanged",
    }
    return delta


def simulate(request: SimulateRequest) -> dict:
    baseline = request.input
    scenario_input, assumptions, notes = apply_scenario(baseline, request.scenario)

    swarm_a = request.swarm
    swarm_b = None if swarm_a is None else scenario_swarm(swarm_a, request.scenario)

    plan_a = build_plan("Plan A (baseline)", baseline, swarm_a)
    plan_b = build_plan(request.scenario.label, scenario_input, swarm_b)
    delta = compare(plan_a, plan_b)

    now = datetime.now(timezone.utc).isoformat()
    return {
        "data": {
            "scenarioKey": request.scenario_key,
            "scenario": request.scenario.model_dump(mode="json"),
            "planA": plan_a,
            "planB": plan_b,
            "delta": delta,
            "assumptions": assumptions,
            "notes": notes,
        },
        "kind": "simulated",
        "status": "ok" if plan_b["grading"]["status"] == "ok" else "insufficient_data",
        "missing": plan_b["grading"]["missingFields"],
        "asOf": baseline.period_end.isoformat(),
        "analyzedAt": now,
        "unit": baseline.currency,
        "engine": "what-if-simulator/v1",
    }
