"""Evidence-backed business analysis assembled from deterministic results."""

import hashlib
import json
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP, localcontext

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator

from .finance import calculate_business_metrics, calculate_financials
from .grading import grade_financials
from .schemas import FinancialInput, Money, PositiveMoney

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


def build_analysis(data: FinancialInput, *, forecast: dict | None = None,
                   expense_history: list[dict] | None = None) -> dict:
    with localcontext() as context:
        context.prec = 50
        return _build_analysis(data, forecast=forecast, expense_history=expense_history)


def _build_analysis(data: FinancialInput, *, forecast: dict | None, expense_history: list[dict] | None) -> dict:
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
            add("liquidity_shortfall", "risk", "high", "สินทรัพย์หมุนเวียนต่ำกว่าหนี้สินหมุนเวียน (liquidity < 1)", ["liquidity"],
                "ตรวจสอบวันรับเงินและวันจ่ายเงินก่อนผูกพันการใช้เงินสดเพิ่ม", "cashflow")
        else:
            add("liquidity_coverage", "strength", "low", "สินทรัพย์หมุนเวียนครอบคลุมหนี้สินหมุนเวียน แต่ยังต้องตรวจสอบว่าเปลี่ยนเป็นเงินสดได้ทันกำหนดจ่ายหรือไม่",
                ["liquidity"], "จัดทำตารางรับจ่ายเงินสดที่ระบุวันที่เพื่อยืนยันความพร้อมชำระเงิน", "cashflow")
    if values["dscr"] is not None:
        if data.cash_available_for_debt_service < data.debt_principal_due + data.debt_interest_due:
            add("debt_service_shortfall", "risk", "high", "เงินสดก่อนชำระหนี้ต่ำกว่าเงินต้นและดอกเบี้ยที่ถึงกำหนด (DSCR < 1)",
                ["dscr"], "ทบทวนกำหนดชำระหนี้และประเมินความสามารถชำระหนี้เพิ่มก่อนขอสินเชื่อใหม่", "funding")
        else:
            add("debt_service_coverage", "strength", "low", "เงินสดก่อนชำระหนี้ครอบคลุมยอดชำระตามกำหนดที่ระบุในข้อมูล",
                ["dscr"], "คำนวณ DSCR อีกครั้งโดยรวมค่างวดสินเชื่อใหม่ที่กำลังพิจารณา", "funding")
    if values["fcf"] is not None and values["fcf"] < 0:
        add("capex_cash_pressure", "weakness", "medium", "กระแสเงินสดจากการดำเนินงานไม่ครอบคลุมรายจ่ายลงทุนในงวดนี้ (FCF < 0)",
            ["fcf"], "ทบทวนความจำเป็นและช่วงเวลาของรายจ่ายลงทุน", "cashflow")
    if values["net_cash_flow"] is not None and values["net_cash_flow"] < 0:
        add("cash_decrease", "risk", "high", "กระแสเงินสดรวมจากการดำเนินงาน การลงทุน และการจัดหาเงินทำให้เงินสดลดลงในงวดที่ระบุ (net_cash_flow < 0)",
            ["net_cash_flow"], "ตรวจสอบกระแสเงินสดแต่ละประเภทพร้อมวันที่รับเงินและจ่ายเงินจริง", "cashflow")
    if values["funding_gap"] is not None and values["funding_gap"] > 0:
        add("unfunded_working_capital", "risk", "high", "เงินสดที่ใช้ได้ มัดจำจากผู้ซื้อ และเงินทุนที่ยืนยันแล้วไม่ครอบคลุมเงินทุนหมุนเวียนที่ต้องใช้ (funding_gap > 0)",
            ["funding_gap"], "ยืนยันวันจ่ายเงินและวันที่เงินทุนพร้อมใช้ก่อนเริ่มผลิตตามออเดอร์", "funding")
    if values["cash_reserve_months"] is not None and Decimal(grading["components"]["cash_reserve"]["rawValue"]) < 1:
        add("thin_cash_reserve", "weakness", "medium", "เงินสดสำรองครอบคลุมรายจ่ายดำเนินงานได้น้อยกว่า 1 งวดมาตรฐาน 30 วัน (cash_reserve_months < 1)",
            ["cash_reserve_months"], "ทบทวนเป้าหมายเงินสำรองและจัดลำดับรายจ่ายเงินสดที่จำเป็นก่อน", "cashflow")
    if values["debt_ratio"] is not None and data.liabilities > data.assets:
        add("negative_equity", "risk", "critical", "หนี้สินสูงกว่าสินทรัพย์และส่วนของเจ้าของติดลบ คะแนนรวมยังไม่สามารถหักล้างความเสี่ยงนี้ได้",
            ["debt_ratio"], "ตรวจสอบความสามารถชำระหนี้จากเอกสารบัญชีก่อนรับภาระผูกพันใหม่", "health")
    if values["net_profit"] is not None:
        if values["net_profit"] > 0:
            add("period_profit", "strength", "low", "งบกำไรขาดทุนที่ตรวจสอบยอดแล้วแสดงกำไรสุทธิเป็นบวกในงวดนี้ (net_profit > 0)",
                ["net_profit"], "ติดตามว่ากำไรที่รับรู้เปลี่ยนเป็นเงินสดรับจริงเมื่อใด", "cashflow")
        elif values["net_profit"] < 0:
            add("period_loss", "weakness", "high", "รายได้ที่ระบุต่ำกว่าผลรวมต้นทุน ค่าใช้จ่ายดำเนินงาน ดอกเบี้ย และภาษี (net_profit < 0)",
                ["net_profit", "total_cost"], "ตรวจสอบต้นทุนแต่ละประเภทและอัตรากำไรจากการขายโดยใช้รายการธุรกรรมจริง", "health")
    if values["contribution_per_unit"] is not None and values["contribution_per_unit"] <= 0:
        add("nonpositive_unit_margin", "risk", "high", "ราคาขายต่อหน่วยไม่สูงกว่าต้นทุนผันแปรต่อหน่วย การขายเพิ่มจึงยังไม่ช่วยชดเชยต้นทุนคงที่ (contribution_per_unit <= 0)",
            ["contribution_per_unit"], "ทบทวนราคาขายหรือต้นทุนผันแปรต่อหน่วยก่อนเพิ่มกำลังผลิต", "health")

    missing = sorted({field for item in metrics.values() for field in item["missingFields"]} | set(grading["missingFields"]))
    unknowns = [f"Missing input: {field}" for field in missing]
    unknowns += [f"{name}: {item['reason']}" for name, item in metrics.items() if item["status"] == "undefined"]
    unknowns += [f"Grading {name}: {item['reason']}" for name, item in grading["components"].items() if item["status"] == "undefined"]
    if forecast is None:
        unknowns.append("No dated cash events supplied to build_analysis: use forecast_cashflow with a dated cash snapshot and complete schedule for 30/60/90-day projections.")
    if expense_history is None:
        unknowns.append("No expense transaction history or comparable prior period: unusual expenses cannot be confirmed.")
    status = "ok" if not missing and grading["status"] == "ok" and all(item["status"] == "ok" for item in metrics.values()) else "insufficient_data"
    input_json = data.model_dump(mode="json")
    input_hash = hashlib.sha256(json.dumps(input_json, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    result = {
        **{key: financials[key] for key in ["kind", "asOf", "analyzedAt", "period", "unit"]},
        "status": status, "missing": missing, "inputHash": input_hash, "schemaVersion": "analysis-v1",
        "data": {"input": input_json, "metrics": metrics, "grading": grading, "indicators": indicators,
                 "findings": findings, "explanation": {}, "aiMode": "rules", "aiWarning": None},
    }
    if forecast is not None or expense_history is not None:
        result["data"]["contextEvidence"] = {}
    if forecast is not None:
        _add_forecast(result, forecast, evidence, unknowns)
    if expense_history is not None:
        _add_expenses(result, expense_history, evidence, unknowns)
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda finding: (severity_order[finding["severity"]], finding["id"]))
    compose_explanation(result, findings, evidence, unknowns)
    return result


def _context_fact(result, evidence, identifier, label, value, *, unit, details, status="warning"):
    target = f"health-{identifier}"
    result["data"]["contextEvidence"][identifier] = {
        "id": identifier, "value": value, "unit": unit, **details,
    }
    evidence.append({"id": identifier, "refNum": len(evidence) + 1, "label": label,
                     "value": f"{value} {unit}", "targetElementId": target})
    result["data"]["indicators"].append({
        "id": target, "category": "liquidity" if identifier.startswith("forecast_") else "efficiency",
        "name": label, "nameEn": label, "value": float(Decimal(value)), "unit": unit,
        "benchmark": details["policy"], "status": status, "trend": [],
        "formula": details["formula"], "interpretation": details["interpretation"], "missingFields": [],
        "evidenceRefs": [{"id": identifier, "label": label, "targetId": target}],
    })


def _context_finding(result, identifier, category, severity, text, refs, action, page="cashflow"):
    if not refs or any(ref not in result["data"]["contextEvidence"] for ref in refs):
        raise ValueError("Context findings require available evidence")
    result["data"]["findings"].append({"id": identifier, "category": category, "severity": severity,
        "text": text, "evidenceIds": refs, "action": {"text": action, "targetPage": page}})


def _add_forecast(result, forecast, evidence, unknowns):
    if not isinstance(forecast, dict) or forecast.get("unit") != "THB" or forecast.get("status") not in {"ok", "insufficient_data"}:
        raise ValueError("Expected a THB forecast_cashflow result")
    as_of = TypeAdapter(date).validate_python(forecast["as_of"])
    complete = forecast.get("schedule_complete_through")
    complete = None if complete is None else TypeAdapter(date).validate_python(complete)
    reserve = forecast.get("minimum_cash_reserve")
    reserve = Decimal(0) if reserve is None else TypeAdapter(PositiveMoney).validate_python(reserve)
    details = {"source": "forecast_cashflow", "as_of": as_of.isoformat(),
        "schedule_complete_through": None if complete is None else complete.isoformat(),
        "kind": forecast.get("kind", "forecast"), "policy": "Supplied confirmed-coverage forecast only; conditional outputs excluded",
        "formula": "Taken from supplied forecast_cashflow result; not recomputed",
        "interpretation": "ค่าคาดการณ์ตามตารางที่ผู้เรียกยืนยันความครบถ้วน ไม่ใช่ยอดเงินสดที่เกิดขึ้นจริง"}
    refs, balances = [], []
    for days in (30, 60, 90):
        value = forecast.get("period_end_balances", {}).get(str(days))
        if value is None:
            unknowns.append(f"Forecast balance for {days} days is not confirmed; conditional values are not cited.")
            continue
        end = as_of + timedelta(days=days)
        if complete is None or complete < end:
            raise ValueError("Forecast horizon balance requires confirmed schedule coverage")
        value = TypeAdapter(Money).validate_python(value)
        identifier = f"forecast_balance_{days}_days"
        _context_fact(result, evidence, identifier, f"Forecast cash at {days} days", str(value), unit="THB",
                      details={**details, "horizon_days": days, "date": end.isoformat()},
                      status="danger" if value < reserve else "good")
        refs.append(identifier)
        balances.append((days, value))
    if refs:
        risk = any(value < reserve for _, value in balances)
        text = "; ".join(f"{days} วัน: {value:,.2f} THB" for days, value in balances)
        _context_finding(result, "forecast_horizon_balances", "risk" if risk else "strength", "medium" if risk else "low",
                         f"ยอดเงินสดคาดการณ์จากวันที่ {as_of.isoformat()} ตามช่วงที่ยืนยันตารางแล้ว: {text}", refs,
                         "ตรวจสอบรายการรับจ่ายและปรับตารางคาดการณ์เมื่อกำหนดชำระเปลี่ยน")
    if forecast.get("status") != "ok":
        unknowns.append("Forecast coverage is incomplete; the 90-day minimum and first shortfall are not confirmed.")
        return
    if complete is None or complete < as_of + timedelta(days=90):
        raise ValueError("A complete forecast requires 90 days of confirmed coverage")
    minimum = TypeAdapter(Money).validate_python(forecast["minimum_cash"])
    minimum_date = TypeAdapter(date).validate_python(forecast["minimum_cash_date"])
    if not as_of <= minimum_date <= as_of + timedelta(days=90):
        raise ValueError("Forecast minimum date is outside the horizon")
    identifier = "forecast_minimum_cash"
    _context_fact(result, evidence, identifier, "Minimum forecast cash", str(minimum), unit="THB",
                  details={**details, "date": minimum_date.isoformat(), "minimum_cash_reserve": forecast.get("minimum_cash_reserve")},
                  status="danger" if minimum < reserve else "good")
    risk = minimum < reserve
    _context_finding(result, identifier, "risk" if risk else "strength", "medium" if risk else "low",
                     f"เงินสดคาดการณ์ต่ำสุดในช่วง 90 วันคือ {minimum:,.2f} THB วันที่ {minimum_date.isoformat()}",
                     [identifier], "เตรียมเงินสดสำรองโดยตรวจรายการรับจ่ายก่อนวันที่ยอดเงินสดต่ำสุด")
    first = forecast.get("first_shortfall_date")
    if first is not None:
        first = TypeAdapter(date).validate_python(first)
        if not as_of <= first <= minimum_date or minimum >= reserve:
            raise ValueError("Forecast shortfall is inconsistent with its minimum or date")
        result["data"]["contextEvidence"][identifier]["first_shortfall_date"] = first.isoformat()
        date_id = "forecast_first_shortfall_date"
        result["data"]["contextEvidence"][date_id] = {
            "id": date_id, "value": first.isoformat(), "unit": "date", **details,
            "minimum_cash_reserve": forecast.get("minimum_cash_reserve"),
        }
        evidence.append({"id": date_id, "refNum": len(evidence) + 1, "label": "First forecast shortfall date",
                         "value": first.isoformat(), "targetElementId": f"health-{identifier}"})
        threshold = "ยอดเงินสดต่ำกว่า 0" if forecast.get("minimum_cash_reserve") is None else f"เงินสดต่ำกว่าเงินสำรอง {reserve:,.2f} THB"
        _context_finding(result, "forecast_cash_shortfall", "risk", "high",
                         f"คาดว่าจะเริ่มขาดเงินสดวันที่ {first.isoformat()} โดยเกณฑ์คือ{threshold} ตามตารางที่ยืนยันแล้ว",
                         [date_id, identifier], "เร่งติดตามลูกหนี้หรือจัดเวลาจ่ายเงินก่อนวันเริ่มขาดเงินสด")


class ExpenseRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(min_length=1, max_length=200)
    date: date
    category: str = Field(min_length=1, max_length=200)
    amount: PositiveMoney
    sme_id: str | None = None

    @field_validator("id", "category")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Expense id and category cannot be blank")
        return value.strip()


def _month_start(month: date, offset: int) -> date:
    index = month.year * 12 + month.month - 1 + offset
    year, month_index = divmod(index, 12)
    if year < 1:
        raise ValueError("Expense comparison window exceeds the supported calendar")
    return date(year, month_index + 1, 1)


def _add_expenses(result, history, evidence, unknowns):
    if not isinstance(history, list) or len(history) > 10000:
        raise ValueError("At most 10000 expense transactions are supported")
    seen, scopes = {}, set()
    for raw in history:
        row = ExpenseRecord.model_validate(raw)
        if row.sme_id is not None:
            scopes.add(row.sme_id)
        if row.id in seen and row != seen[row.id]:
            raise ValueError("Conflicting duplicate expense transaction id")
        seen[row.id] = row
    if len(scopes) > 1:
        raise ValueError("Expense histories from different SMEs cannot be combined")
    policy = {"version": "expense-history/v1", "baseline_months": 3, "minimum_observed_months": 2,
              "increase_threshold": "0.50", "rule": "current_total * observed_month_count > baseline_sum * 1.50",
              "scope": "One SME, same category, latest observed calendar month versus up to three preceding months",
              "coverage": "Observed transactions only; absent months are unknown, never zero; latest month may be partial"}
    comparison = {"status": "known_empty" if not seen else "ok", "policy": policy, "as_of": None, "categories": []}
    result["data"]["expenseComparison"] = comparison
    if not seen:
        unknowns.append("Expense history was queried and is empty; no baseline exists to identify unusual expenses.")
        return
    as_of = max(row.date for row in seen.values())
    current = as_of.replace(day=1)
    months = [_month_start(current, offset) for offset in (-3, -2, -1)]
    comparison["as_of"] = as_of.isoformat()
    totals, ids = defaultdict(lambda: defaultdict(Decimal)), defaultdict(lambda: defaultdict(list))
    for row in seen.values():
        month = row.date.replace(day=1)
        if months[0] <= month <= current:
            totals[row.category][month] += row.amount
            ids[row.category][month].append(row.id)
    for category, monthly in sorted(totals.items()):
        observed = [month for month in months if month in monthly]
        baseline_sum = sum((monthly[month] for month in observed), Decimal(0))
        item = {"category": category, "comparison_month": current.isoformat(),
                "baseline_window_start": months[0].isoformat(), "baseline_window_end": (current - timedelta(days=1)).isoformat(),
                "observed_months": [month.isoformat() for month in observed],
                "missing_months": [month.isoformat() for month in months if month not in monthly],
                "monthly_totals": {month.isoformat(): str(value) for month, value in sorted(monthly.items())},
                "source_ids": sorted(identifier for month in monthly for identifier in ids[category][month]),
                "baseline_mean": None, "increase_percent": None, "status": "insufficient_data"}
        comparison["categories"].append(item)
        if item["missing_months"]:
            unknowns.append(f"Expense category {category}: baseline months {', '.join(item['missing_months'])} are unknown, not zero.")
        if current not in monthly or len(observed) < 2 or baseline_sum == 0:
            comparison["status"] = "insufficient_data"
            unknowns.append(f"Expense category {category}: current-month observations and at least two observed baseline months with a positive combined total are required.")
            continue
        mean = baseline_sum / len(observed)
        increase = (monthly[current] * len(observed) / baseline_sum - 1) * 100
        flagged = monthly[current] * len(observed) > baseline_sum * Decimal("1.50")
        item.update(baseline_mean=format(mean.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f"),
                    increase_percent=format(increase.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f"),
                    status="flagged" if flagged else "normal")
        if not flagged:
            continue
        token = hashlib.sha256(category.encode()).hexdigest()[:24]
        refs = []
        for suffix, value in (("current", monthly[current]), ("baseline", mean)):
            identifier = f"expense_{suffix}_{token}"
            _context_fact(result, evidence, identifier, f"Expense {suffix}: {category}",
                          format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f"), unit="THB",
                          details={**item, "policy": policy["rule"], "formula": "Observed monthly category totals; baseline = sum / observed month count",
                                   "interpretation": "คัดกรองจากรายการค่าใช้จ่ายที่มีอยู่ ไม่ยืนยันว่ารายการครบหรือเป็นการทุจริต"})
            refs.append(identifier)
        _context_finding(result, f"unusual_expense_{token}", "weakness", "medium",
                         f"ค่าใช้จ่ายหมวด {category} เดือน {current.strftime('%Y-%m')} ถึงวันที่ {as_of.isoformat()} รวม {monthly[current]:,.2f} THB "
                         f"สูงกว่าค่าเฉลี่ย {len(observed)} เดือนที่มีข้อมูลในช่วง {months[0].isoformat()} ถึง {(current - timedelta(days=1)).isoformat()} "
                         f"ซึ่งเท่ากับ {item['baseline_mean']} THB อยู่ {item['increase_percent']}% และเกินเกณฑ์ 50% จากรายการที่บันทึกไว้",
                         refs, "ตรวจใบแจ้งหนี้ ปริมาณซื้อ และราคาต่อหน่วยก่อนสรุปสาเหตุค่าใช้จ่ายเพิ่ม", "health")


def compose_explanation(result: dict, findings: list[dict], evidence: list[dict], unknowns: list[str]) -> None:
    grading = result["data"]["grading"]
    grade_text = (f"ธุรกิจได้เกรด {grading['grade']} คะแนน {grading['score']} ตามเกณฑ์ {grading['policyVersion']}"
                  if grading["grade"] is not None else "ข้อมูลที่มีอยู่ยังไม่เพียงพอสำหรับจัดเกรดธุรกิจ")
    risk_count = sum(item["category"] == "risk" for item in findings)
    result["data"]["explanation"] = {
        "pageId": "health", "summary": f"{grade_text} พบประเด็นความเสี่ยงที่มีหลักฐานรองรับ {risk_count} รายการ",
        "reasoning": " ".join(item["text"] for item in findings) or "กรุณาเพิ่มข้อมูลทางการเงินก่อนสรุปผลวิเคราะห์",
        "dataUsed": evidence,
        "suggestions": [item["action"] for item in findings], "unknowns": unknowns,
        "mode": result["data"]["aiMode"], "policyVersion": grading["policyVersion"],
        "warning": result["data"]["aiWarning"],
    }
