"""Evidence-backed business analysis assembled from deterministic results."""

import hashlib
import json
from decimal import Decimal, localcontext

from .finance import calculate_business_metrics, calculate_financials
from .grading import grade_financials
from .schemas import FinancialInput

# name, category, benchmark, good threshold, warning threshold, lower-is-better
METRIC_CONFIG = {
    "liquidity": ("Current ratio", "liquidity", "Demo: >=1.5 good; >=1 watch", "1.5", "1", False),
    "fcf": ("Free cash flow", "liquidity", "Nonnegative CFO after capex", "0.01", "0", False),
    "net_cash_flow": ("Net cash flow", "liquidity", "Nonnegative change in cash", "0.01", "0", False),
    "funding_gap": ("Funding gap", "liquidity", "Zero unfunded working capital", "0", "0", True),
    "cash_reserve_months": ("Cash reserve months", "liquidity", "Demo: >=3 good; >=1 watch", "3", "1", False),
    "dscr": ("Debt service coverage", "debt", "Demo: >=1.5 good; >=1 watch", "1.5", "1", False),
    "debt_ratio": ("Liabilities to assets", "debt", "Demo: <=0.5 good; <=0.8 watch", "0.5", "0.8", True),
    "roa": ("Return on assets", "profitability", "Positive period return; no industry benchmark", "0.0001", "0", False),
    "roe": ("Return on equity", "profitability", "Positive period return; no industry benchmark", "0.0001", "0", False),
    "gross_profit": ("Gross profit", "profitability", "Positive period profit", "0.01", "0", False),
    "operating_profit": ("Operating profit", "profitability", "Positive period profit", "0.01", "0", False),
    "net_profit": ("Net profit", "profitability", "Positive period profit", "0.01", "0", False),
    "roi": ("Simple net ROI", "profitability", "Positive supplied-period return; not annualized", "0.0001", "0", False),
    "contribution_per_unit": ("Unit contribution", "efficiency", "Positive price less variable unit cost", "0.01", "0", False),
    "total_cost": ("Total period cost", "efficiency", "Informational: compare with a budget", None, None, False),
    "cost_per_unit": ("Operating cost per unit", "efficiency", "Informational: excludes interest and tax", None, None, False),
    "breakeven_units": ("Break-even units", "efficiency", "Whole units, rounded upward", None, None, False),
    "pmt": ("Loan installment", "debt", "Informational: fixed installment excluding fees", None, None, False),
}


def build_analysis(data: FinancialInput) -> dict:
    with localcontext() as context:
        context.prec = 50
        return _build_analysis(data)


def _build_analysis(data: FinancialInput) -> dict:
    financials = calculate_financials(data)
    metrics = {**financials["data"], **calculate_business_metrics(data)}
    grading = grade_financials(data)
    indicators = []
    evidence = []
    for name, (label, category, benchmark, good, watch, lower) in METRIC_CONFIG.items():
        item = metrics[name]
        value = None if item["value"] is None else Decimal(item["value"])
        decision_value = value
        if name in grading["components"] and grading["components"][name]["rawValue"] is not None:
            decision_value = Decimal(grading["components"][name]["rawValue"])
        if name == "liquidity" and value is not None:
            decision_value = data.current_assets / data.current_liabilities
        if name == "debt_ratio" and value is not None:
            decision_value = data.liabilities / data.assets
        if name == "cash_reserve_months" and value is not None:
            decision_value = Decimal(grading["components"]["cash_reserve"]["rawValue"])
        if value is None:
            status = "insufficient"
        elif good is None:
            status = "warning"
        elif lower:
            status = "good" if decision_value <= Decimal(good) else "warning" if decision_value <= Decimal(watch) else "danger"
        else:
            status = "good" if decision_value >= Decimal(good) else "warning" if decision_value >= Decimal(watch) else "danger"
        target = f"health-{name}"
        ref = {"id": name, "refNum": len(evidence) + 1, "label": label,
               "value": f"{item['value']} {item['unit']}", "targetElementId": target}
        if value is not None:
            evidence.append(ref)
        indicators.append({
            "id": target, "category": category, "name": label, "nameEn": label,
            "value": None if value is None else float(value), "unit": item["unit"],
            "benchmark": benchmark, "status": status, "trend": [], "formula": item["formula"],
            "interpretation": item["reason"] or ("Missing: " + ", ".join(item["missingFields"]) if value is None else
                                                 "Calculated from supplied inputs. " + benchmark),
            "missingFields": item["missingFields"],
            "evidenceRefs": [] if value is None else [{"id": name, "label": label, "targetId": target}],
        })

    findings = []

    def add(identifier, category, severity, text, refs, action, target_page):
        # All statements must refer to at least one available calculated fact.
        if not refs or any(metrics[ref]["value"] is None for ref in refs):
            return
        findings.append({"id": identifier, "category": category, "severity": severity,
                         "text": text, "evidenceIds": refs,
                         "action": {"text": action, "targetPage": target_page}})

    values = {name: None if item["value"] is None else Decimal(item["value"]) for name, item in metrics.items()}
    if values["liquidity"] is not None:
        if data.current_assets < data.current_liabilities:
            add("liquidity_shortfall", "risk", "high", "Current assets are below current liabilities.", ["liquidity"],
                "Review collection and payment dates before committing additional cash.", "cashflow")
        else:
            add("liquidity_coverage", "strength", "low", "Current assets cover current liabilities; this does not ensure immediate cash availability.",
                ["liquidity"], "Keep a dated cash schedule to confirm payment readiness.", "cashflow")
    if values["dscr"] is not None:
        if data.cash_available_for_debt_service < data.debt_principal_due + data.debt_interest_due:
            add("debt_service_shortfall", "risk", "high", "Cash available before debt service is below scheduled principal and interest.",
                ["dscr"], "Review repayment timing and avoid assuming that an additional loan is affordable.", "funding")
        else:
            add("debt_service_coverage", "strength", "low", "Supplied cash before debt service covers the supplied scheduled payments.",
                ["dscr"], "Recheck coverage including any proposed new loan payment.", "funding")
    if values["fcf"] is not None and values["fcf"] < 0:
        add("capex_cash_pressure", "weakness", "medium", "Operating cash flow does not cover capital expenditure in this period.",
            ["fcf"], "Review the timing and necessity of capital expenditure.", "cashflow")
    if values["net_cash_flow"] is not None and values["net_cash_flow"] < 0:
        add("cash_decrease", "risk", "high", "Combined operating, investing and financing flows reduce cash in the supplied period.",
            ["net_cash_flow"], "Inspect each cash-flow category and its dated receipts and payments.", "cashflow")
    if values["funding_gap"] is not None and values["funding_gap"] > 0:
        add("unfunded_working_capital", "risk", "high", "Usable cash, buyer deposit and committed funding do not cover the stated working-capital need.",
            ["funding_gap"], "Confirm expenditure dates and funding availability before starting the order.", "funding")
    if values["cash_reserve_months"] is not None and Decimal(grading["components"]["cash_reserve"]["rawValue"]) < 1:
        add("thin_cash_reserve", "weakness", "medium", "Cash covers less than one normalized 30-day period of cash operating outflow.",
            ["cash_reserve_months"], "Review the reserve target and prioritize essential cash payments.", "cashflow")
    if values["debt_ratio"] is not None and data.liabilities > data.assets:
        add("negative_equity", "risk", "critical", "Liabilities exceed assets; a composite score does not remove the negative-equity risk.",
            ["debt_ratio"], "Review solvency with the accounting records before pursuing new obligations.", "health")
    if values["net_profit"] is not None:
        if values["net_profit"] > 0:
            add("period_profit", "strength", "low", "The reconciled income statement shows positive period net profit.",
                ["net_profit"], "Track whether earned profit converts to cash.", "cashflow")
        elif values["net_profit"] < 0:
            add("period_loss", "weakness", "high", "Supplied revenue is below the combined cost, operating expense, interest and tax amounts.",
                ["net_profit", "total_cost"], "Review cost categories and selling margins using transaction records.", "health")
    if values["contribution_per_unit"] is not None and values["contribution_per_unit"] <= 0:
        add("nonpositive_unit_margin", "risk", "high", "The supplied selling price does not exceed variable cost per unit; fixed costs cannot be recovered by selling more units.",
            ["contribution_per_unit"], "Review price or variable unit costs before scaling production.", "health")

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda finding: (severity_order[finding["severity"]], finding["id"]))
    missing = sorted({field for item in metrics.values() for field in item["missingFields"]} | set(grading["missingFields"]))
    unknowns = [f"Missing input: {field}" for field in missing]
    unknowns += [f"{name}: {item['reason']}" for name, item in metrics.items() if item["status"] == "undefined"]
    unknowns += [f"Grading {name}: {item['reason']}" for name, item in grading["components"].items() if item["status"] == "undefined"]
    unknowns += ["No dated cash events supplied to build_analysis: use forecast_cashflow with a dated cash snapshot and complete schedule for 30/60/90-day projections.",
                 "No expense transaction history or comparable prior period: unusual expenses cannot be confirmed."]
    status = "ok" if not missing and grading["status"] == "ok" and all(item["status"] == "ok" for item in metrics.values()) else "insufficient_data"
    input_json = data.model_dump(mode="json")
    input_hash = hashlib.sha256(json.dumps(input_json, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    result = {
        **{key: financials[key] for key in ["kind", "asOf", "analyzedAt", "period", "unit"]},
        "status": status, "missing": missing, "inputHash": input_hash, "schemaVersion": "analysis-v1",
        "data": {"input": input_json, "metrics": metrics, "grading": grading, "indicators": indicators,
                 "findings": findings, "explanation": {}, "aiMode": "rules", "aiWarning": None},
    }
    compose_explanation(result, findings, evidence, unknowns)
    return result


def compose_explanation(result: dict, findings: list[dict], evidence: list[dict], unknowns: list[str]) -> None:
    grading = result["data"]["grading"]
    grade_text = (f"Grade {grading['grade']} / {grading['score']} under {grading['policyVersion']}."
                  if grading["grade"] is not None else "A business grade cannot be assigned from the available inputs.")
    risk_count = sum(item["category"] == "risk" for item in findings)
    result["data"]["explanation"] = {
        "pageId": "health", "summary": f"{grade_text} {risk_count} evidence-backed risk flags.",
        "reasoning": " ".join(item["text"] for item in findings) or "Supply additional financial inputs before drawing conclusions.",
        "dataUsed": evidence,
        "suggestions": [item["action"] for item in findings], "unknowns": unknowns,
        "mode": result["data"]["aiMode"], "policyVersion": grading["policyVersion"],
        "warning": result["data"]["aiWarning"],
    }
