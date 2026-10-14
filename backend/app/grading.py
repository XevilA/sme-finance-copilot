"""Versioned hackathon grading policy, not a lender underwriting decision."""

from decimal import Decimal, ROUND_HALF_UP, localcontext

from .schemas import FinancialInput

POLICY_VERSION = "demo-v1"
WEIGHTS = {"dscr": Decimal("0.35"), "cash_flow": Decimal("0.30"),
           "debt_burden": Decimal("0.20"), "cash_reserve": Decimal("0.15")}
FORMULAS = {
    "dscr": "clamp(100 * DSCR / 1.5, 0, 100); explicit zero debt service and nonnegative CFADS = 100",
    "cash_flow": "clamp(100 * (operating_cash_flow / revenue) / 0.20, 0, 100)",
    "debt_burden": "clamp(100 * (1 - liabilities / assets), 0, 100)",
    "cash_reserve": "clamp(100 * (cash_balance / (operating_cash_outflow * 30 / period_days)) / 3, 0, 100)",
}
REQUIRED = {
    "dscr": ["cash_available_for_debt_service", "debt_principal_due", "debt_interest_due"],
    "cash_flow": ["operating_cash_flow", "revenue"],
    "debt_burden": ["liabilities", "assets"],
    "cash_reserve": ["cash_balance", "operating_cash_outflow"],
}


def grade_financials(data: FinancialInput) -> dict:
    with localcontext() as context:
        context.prec = 50
        components = {}
        raw_scores = {}
        for name, fields in REQUIRED.items():
            missing = [field for field in fields if getattr(data, field) is None]
            reason = None
            raw = None
            if not missing:
                if name == "dscr":
                    service = data.debt_principal_due + data.debt_interest_due
                    if service == 0:
                        if data.cash_available_for_debt_service >= 0:
                            raw = Decimal("1.5")
                        else:
                            reason = "Negative cash available with zero debt service"
                    else:
                        raw = data.cash_available_for_debt_service / service
                    score = None if raw is None else raw / Decimal("1.5") * 100
                elif name == "cash_flow":
                    reason = "revenue is zero" if data.revenue == 0 else None
                    raw = None if reason else data.operating_cash_flow / data.revenue
                    score = None if raw is None else raw / Decimal("0.20") * 100
                elif name == "debt_burden":
                    reason = "assets is zero" if data.assets == 0 else None
                    raw = None if reason else data.liabilities / data.assets
                    score = None if raw is None else (1 - raw) * 100
                else:
                    reason = "operating_cash_outflow is zero" if data.operating_cash_outflow == 0 else None
                    days = Decimal((data.period_end - data.period_start).days + 1)
                    raw = None if reason else data.cash_balance / (data.operating_cash_outflow * 30 / days)
                    score = None if raw is None else raw / 3 * 100
                if score is not None:
                    raw_scores[name] = max(Decimal(0), min(Decimal(100), score))
            component = {
                "weight": str(WEIGHTS[name]), "formula": FORMULAS[name],
                "rawValue": None if raw is None else format(raw, "f"),
                "score": None if name not in raw_scores else format(raw_scores[name].quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP), "f"),
                "status": "insufficient_data" if missing else "undefined" if reason else "ok",
                "missingFields": missing, "reason": reason,
            }
            if name == "dscr" and not missing and data.debt_principal_due + data.debt_interest_due == 0:
                component["rawValue"] = None
            components[name] = component
        score = None
        grade = None
        if len(raw_scores) == 4:
            score = sum((raw_scores[name] * WEIGHTS[name] for name in WEIGHTS), Decimal(0))
            score = score.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            grade = "A" if score >= 80 else "B" if score >= 65 else "C" if score >= 50 else "D"
        return {
            "score": None if score is None else format(score, "f"), "grade": grade,
            "status": "ok" if score is not None else "insufficient_data",
            "missingFields": sorted({field for item in components.values() for field in item["missingFields"]}),
            "components": components, "policyVersion": POLICY_VERSION,
            "formula": "G = 0.35 * dscr_score + 0.30 * cash_flow_score + 0.20 * debt_burden_score + 0.15 * cash_reserve_score",
            "thresholds": {"A": 80, "B": 65, "C": 50, "D": 0},
            "notice": "Demo policy; scores are not credit approval or a probability of default.",
        }
