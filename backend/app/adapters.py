"""Adapters from engine output to the frontend's existing contract shapes.

The shapes here are fixed by src/api/contracts/types.ts, which belongs to the
frontend owner and is not edited. These functions only reshape values that the
engines already computed.

Rule followed throughout: nothing is invented. A series we do not have (weekly
trend, indicator sparkline, investment NPV/IRR) comes back empty and its name is
added to the envelope's `missing`, so the UI's own insufficient-data state is
what renders - rather than a plausible-looking number nobody can defend.
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

# The app's existing chart palette, taken from the frontend seed data so a
# served category cannot clash with the styling already built around it.
CATEGORY_COLORS = ["#6C4CF1", "#16C1B0", "#F59A23", "#3B82F6", "#EC4899"]

COST_CATEGORIES = [
    ("cost_of_goods_sold", "ต้นทุนขาย (COGS)"),
    ("operating_expenses", "ค่าใช้จ่ายดำเนินงาน"),
    ("interest_expense", "ดอกเบี้ยจ่าย"),
    ("tax_expense", "ภาษี"),
]

FINDING_TO_ITEM_TYPE = {
    "risk": "deficit_warning",
    "weakness": "expense_review",
    "strength": "pending_plan",
    "opportunity": "pending_plan",
}

SEVERITY_TO_PRIORITY = {"high": "high", "medium": "medium", "low": "low"}


def to_number(value: str | None) -> float | None:
    """Metric values travel as decimal strings; charts need JSON numbers."""
    if value is None:
        return None
    return float(Decimal(value))


def metric_number(metrics: dict, name: str) -> float | None:
    metric = metrics.get(name)
    if not isinstance(metric, dict) or metric.get("status") != "ok":
        return None
    return to_number(metric.get("value"))


def input_number(payload: dict, field: str) -> float | None:
    value = payload.get(field)
    return None if value is None else float(Decimal(str(value)))


def thb(value: float | None) -> str:
    return "-" if value is None else f"{value:,.0f}"


def envelope(data, kind: str, missing: list[str], as_of: str, **extra) -> dict:
    """Frontend Envelope<T>. status follows `missing`, never a fixed 'ok'."""
    return {
        "data": data,
        "kind": kind,
        "status": "insufficient_data" if missing else "ok",
        "missing": missing,
        "asOf": as_of,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "unit": "THB",
        **extra,
    }


def context_gaps(analysis: dict, forecast: dict | None) -> list[str]:
    """Names the context build_analysis could not use, for the envelope's `missing`.

    build_analysis keeps its own `missing` to the statement's own fields, and
    reports the state of the two optional inputs inside `data` instead:
    `data.expenseComparison.status` can say insufficient_data while `missing` is
    empty. Here status follows missing, so a response would otherwise read `ok`
    while the comparison inside it says the data is not there.

    The forecast's own `missing` list is lifted under one prefix rather than
    reworded, so `schedule_complete_through` stays the forecaster's own term.
    An absent `expenseComparison` means the history was never queried, which is
    a different fact from a history that was queried and came back empty.
    """
    gaps: list[str] = []
    if forecast is None:
        gaps.append("cash_forecast")
    else:
        gaps += [f"forecast_{name}" for name in forecast.get("missing", [])]
    comparison = analysis.get("data", {}).get("expenseComparison")
    if comparison is None:
        gaps.append("expense_history")
    elif comparison.get("status") != "ok":
        gaps.append(f"expense_comparison_{comparison['status']}")
    return gaps


def with_context_gaps(analysis: dict, forecast: dict | None) -> dict:
    """The analysis envelope with its sub-statuses lifted into `missing`.

    Only ever downgrades `status`: build_analysis can report insufficient_data
    with an empty `missing` when a metric is undefined, and lifting a gap must
    not undo that.
    """
    gaps = [gap for gap in context_gaps(analysis, forecast) if gap not in analysis["missing"]]
    if not gaps:
        return analysis
    return {**analysis, "missing": [*analysis["missing"], *gaps], "status": "insufficient_data"}


def business_overview(
    payload: dict,
    metrics: dict,
    business_metrics: dict,
    shop_name: str | None,
    previous: dict | None,
    findings: list[dict] | None = None,
) -> tuple[dict, list[str]]:
    missing: list[str] = []

    revenue = input_number(payload, "revenue")
    expense = metric_number(business_metrics, "total_cost")
    net_profit = metric_number(business_metrics, "net_profit")
    cash = input_number(payload, "cash_balance")
    reserve = input_number(payload, "minimum_cash_reserve") or 0.0
    net_cash_flow = metric_number(metrics, "net_cash_flow")

    for name, value in (("revenue", revenue), ("total_cost", expense), ("net_profit", net_profit)):
        if value is None:
            missing.append(name)

    usable = None if cash is None else cash - reserve

    # Period-on-period difference only when a previous statement exists.
    if previous is None:
        last_period_diff = {"revenue": 0, "expense": 0, "netProfit": 0, "cashBalance": 0}
        missing.append("previous_period_statement")
    else:
        prior = previous["payload"]
        prior_computed = (previous.get("computed") or {}).get("businessMetrics") or {}
        prior_revenue = input_number(prior, "revenue")
        prior_expense = metric_number(prior_computed, "total_cost")
        prior_profit = metric_number(prior_computed, "net_profit")
        prior_cash = input_number(prior, "cash_balance")
        last_period_diff = {
            "revenue": 0 if None in (revenue, prior_revenue) else round(revenue - prior_revenue, 2),
            "expense": 0 if None in (expense, prior_expense) else round(expense - prior_expense, 2),
            "netProfit": 0 if None in (net_profit, prior_profit) else round(net_profit - prior_profit, 2),
            "cashBalance": 0 if None in (cash, prior_cash) else round(cash - prior_cash, 2),
        }

    # Stated as a comparison of two computed figures, with no causal claim -
    # the backend cannot see why cash and profit diverged.
    if net_profit is None or net_cash_flow is None:
        insight = "ข้อมูลไม่พอสำหรับเทียบกำไรกับกระแสเงินสดในงวดนี้"
    else:
        gap = net_profit - net_cash_flow
        reserve_note = (
            f"ต่ำกว่าเงินสำรอง {thb(reserve)} บาท"
            if cash is not None and cash < reserve
            else f"สูงกว่าเงินสำรอง {thb(reserve)} บาท"
        )
        insight = (
            f"กำไรสุทธิตามบัญชี {thb(net_profit)} บาท แต่กระแสเงินสดสุทธิ {thb(net_cash_flow)} บาท "
            f"ต่างกัน {thb(abs(gap))} บาท เงินสดคงเหลือ {thb(cash)} บาท ({reserve_note}) "
            "ตัวเลขนี้เทียบจากงบที่ส่งเข้ามา ไม่ได้ระบุสาเหตุของส่วนต่าง"
        )

    # No dated weekly movements exist in the input contract, so this stays empty
    # rather than being interpolated from a period total.
    missing.append("weekly_cash_movements")

    overview = {
        "shopName": shop_name or "ชุดข้อมูลตัวอย่าง (ยังไม่ผูกกับร้านจริง)",
        "revenue": revenue or 0,
        "expense": expense or 0,
        "netProfit": net_profit or 0,
        "cashBalance": cash or 0,
        "usableCashAfterReserve": usable or 0,
        "reserveThreshold": reserve,
        "period": f"{payload['period_start']} – {payload['period_end']}",
        "lastPeriodDiff": last_period_diff,
        "cashVsProfitInsight": insight,
        "actionableItems": actionable_items(findings),
        "weeklyTrend": [],
    }
    return overview, missing


def actionable_items(findings: list[dict] | None = None) -> list[dict]:
    """Turns evidence-backed findings into the UI's action list."""
    items = []
    for index, finding in enumerate(findings or [], start=1):
        action = finding.get("action") or {}
        items.append({
            "id": f"act-{finding.get('id', index)}",
            "type": FINDING_TO_ITEM_TYPE.get(finding.get("category"), "pending_plan"),
            "title": finding.get("text", ""),
            "description": action.get("text", ""),
            "priority": SEVERITY_TO_PRIORITY.get(finding.get("severity"), "medium"),
            "actionText": action.get("text", "ดูรายละเอียด"),
            "targetPage": action.get("targetPage", "overview"),
        })
    return items


def cost_breakdown(payload: dict, business_metrics: dict) -> tuple[dict, list[str]]:
    missing: list[str] = []

    amounts = []
    for field, label in COST_CATEGORIES:
        amount = input_number(payload, field)
        if amount is not None and amount > 0:
            amounts.append((label, amount))

    total = sum(amount for _, amount in amounts)
    categories = [
        {
            "name": label,
            "amount": round(amount, 2),
            "percentage": 0.0 if total == 0 else float(
                (Decimal(str(amount)) / Decimal(str(total)) * 100).quantize(
                    Decimal("0.1"), rounding=ROUND_HALF_UP
                )
            ),
            "color": CATEGORY_COLORS[index % len(CATEGORY_COLORS)],
        }
        for index, (label, amount) in enumerate(amounts)
    ]
    if not categories:
        missing.append("cost_lines")

    cost_per_unit = metric_number(business_metrics, "cost_per_unit")
    profit_per_unit = metric_number(business_metrics, "contribution_per_unit")
    breakeven = metric_number(business_metrics, "breakeven_units")
    for name, value in (("cost_per_unit", cost_per_unit),
                        ("contribution_per_unit", profit_per_unit),
                        ("breakeven_units", breakeven)):
        if value is None:
            missing.append(name)

    period_days = period_length(payload)
    fixed = input_number(payload, "fixed_costs")
    variable_per_unit = input_number(payload, "variable_cost_per_unit")
    units = payload.get("units_sold")

    monthly_fixed = None if fixed is None else normalise_monthly(fixed, period_days)
    monthly_variable = (
        None if variable_per_unit is None or units is None
        else normalise_monthly(variable_per_unit * units, period_days)
    )
    if monthly_fixed is None:
        missing.append("fixed_costs")
    if monthly_variable is None:
        missing.append("variable_cost_per_unit")

    # NPV, IRR and payback need a dated investment cash schedule, which the
    # input contract does not carry. Served empty instead of guessed.
    missing.append("investment_cash_schedule")

    return {
        "categories": categories,
        "costPerUnit": cost_per_unit or 0,
        "profitPerUnit": profit_per_unit or 0,
        "breakevenUnits": int(breakeven) if breakeven is not None else 0,
        "currentMonthlyFixedCost": monthly_fixed or 0,
        "currentMonthlyVariableCost": monthly_variable or 0,
        "investmentPlans": [],
    }, missing


def period_length(payload: dict) -> int:
    start = datetime.fromisoformat(str(payload["period_start"])).date()
    end = datetime.fromisoformat(str(payload["period_end"])).date()
    return (end - start).days + 1


def normalise_monthly(amount: float, period_days: int) -> float:
    """Scales a period figure to 30 days so monthly tiles compare like for like."""
    if period_days <= 0:
        return 0.0
    scaled = Decimal(str(amount)) * 30 / Decimal(period_days)
    return float(scaled.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def swarm_proposal(stored: dict) -> tuple[dict, list[str]]:
    """Rebuilds the UI's SwarmProposal from stored allocations."""
    project = stored["project"]
    allocations = stored["allocations"]

    shops = [
        {
            "shopId": allocation["shopId"],
            "shareBoxesPerDay": allocation["sharePerDay"],
            "workingCapitalNeeded": allocation["workingCapitalNeeded"],
            "currentCash": allocation["currentCash"],
            "fundingGap": allocation["fundingGap"],
            "status": allocation["status"],
            "assignedRole": allocation["assignedRole"],
        }
        for allocation in allocations
    ]
    assigned = sum(shop["shareBoxesPerDay"] for shop in shops)
    target = project["targetCapacity"]
    duration = Decimal(str(project["durationDays"]))
    revenue = float(Decimal(str(assigned)) * duration * Decimal(str(project["unitPrice"])))
    gap = sum(shop["fundingGap"] for shop in shops)

    # Cost from each shop's stored unit cost. If any shop is missing one, the
    # total is left at zero and said so, rather than being part-counted.
    missing: list[str] = []
    unit_costs = [allocation.get("costPerUnit") for allocation in allocations]
    if any(cost is None for cost in unit_costs):
        cost = 0.0
        profit = 0.0
        missing.append("shop_unit_cost")
    else:
        cost = float(sum(
            Decimal(str(allocation["sharePerDay"])) * duration * Decimal(str(allocation["costPerUnit"]))
            for allocation in allocations
        ))
        profit = float(Decimal(str(revenue)) - Decimal(str(cost)))

    stuck = [
        {
            "type": "funding",
            "shopId": shop["shopId"],
            "title": "ร้านนี้ยังขาดเงินทุนสำหรับส่วนที่รับไป",
            "message": f"ขาด {thb(shop['fundingGap'])} บาท จากเงินทุนหมุนเวียนที่ต้องใช้ {thb(shop['workingCapitalNeeded'])} บาท",
            "actionLabel": "จับคู่แหล่งทุน",
            "actionTarget": "funding",
        }
        for shop in shops if shop["status"] == "blocked"
    ]
    deficit = max(0.0, target - assigned)
    if deficit > 0:
        stuck.append({
            "type": "capacity",
            "title": "กำลังผลิตรวมยังไม่ถึงเป้าของออเดอร์",
            "message": f"ยังขาด {thb(deficit)} {project['unit']}/วัน จากเป้า {thb(target)}",
            "actionLabel": "ชวนร้านเพิ่ม",
            "actionTarget": "swarm",
        })

    proposal = {
        "orderId": project["orderRef"],
        "shops": shops,
        "totalCapacityAssigned": assigned,
        "targetCapacity": target,
        "deficitBoxesPerDay": deficit,
        "totalCost": cost,
        "totalRevenue": revenue,
        "totalProfit": profit,
        "totalFundingGap": gap,
        "status": "incomplete" if deficit > 0 else "has_issues" if gap > 0 else "ready",
        "stuckReasons": stuck,
        "version": allocations[0]["version"] if allocations else "v1",
    }
    return proposal, missing
