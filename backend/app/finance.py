"""Deterministic financial metrics with explicit missing/undefined outcomes."""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Literal

from pydantic import BaseModel

from .schemas import FinancialInput, LoanTerms

ZERO = Decimal("0")


class Metric(BaseModel):
    value: str | None
    unit: str
    formula: str
    status: Literal["ok", "insufficient_data", "undefined"]
    missingFields: list[str] = []
    reason: str | None = None


def result(value: Decimal, unit: str, formula: str) -> Metric:
    places = Decimal("0.01") if unit == "THB" else Decimal("0.0001")
    rounded = value.quantize(places, rounding=ROUND_HALF_UP)
    if rounded == 0:
        rounded = abs(rounded)
    return Metric(value=format(rounded, "f"), unit=unit, formula=formula, status="ok")


def unavailable(unit: str, formula: str, missing: list[str] | None = None, reason: str | None = None) -> Metric:
    return Metric(value=None, unit=unit, formula=formula,
                  status="insufficient_data" if missing else "undefined",
                  missingFields=missing or [], reason=reason)


def calculate_pmt(loan: LoanTerms) -> Decimal:
    """Positive installment; nominal annual rate; no fees or balloon payment."""
    with localcontext() as context:
        context.prec = 50
        rate = loan.annual_interest_rate / loan.payments_per_year
        if rate == 0:
            return loan.principal / loan.periods
        # Discounted form avoids large positive powers for long loan terms.
        discount = (1 + rate) ** -loan.periods
        payment = loan.principal * rate / (1 - discount)
        return payment / (1 + rate) if loan.timing == "beginning" else payment


def calculate_financials(data: FinancialInput) -> dict:
    with localcontext() as context:
        context.prec = 50
        metrics: dict[str, Metric] = {}

        def missing_for(fields: list[str], unit: str, formula: str) -> bool:
            missing = [field for field in fields if getattr(data, field) is None]
            if missing:
                metrics[name] = unavailable(unit, formula, missing=missing)
                return True
            return False

        name = "fcf"
        formula = "operating_cash_flow - capital_expenditure"
        if not missing_for(["operating_cash_flow", "capital_expenditure"], "THB", formula):
            metrics[name] = result(data.operating_cash_flow - data.capital_expenditure, "THB", formula)

        name = "net_cash_flow"
        fields = ["operating_cash_flow", "investing_cash_flow", "financing_cash_flow"]
        formula = "operating_cash_flow + investing_cash_flow + financing_cash_flow"
        if not missing_for(fields, "THB", formula):
            metrics[name] = result(sum((getattr(data, field) for field in fields), ZERO), "THB", formula)

        for name, opening, closing in [("roa", "opening_assets", "assets"), ("roe", "opening_equity", "equity")]:
            formula = f"net_income / (({opening} + {closing}) / 2) * 100"
            if not missing_for(["net_income", opening, closing], "%", formula):
                average = (getattr(data, opening) + getattr(data, closing)) / 2
                metrics[name] = (unavailable("%", formula, reason=f"Average {closing} must be positive")
                                 if average <= 0 else result(data.net_income / average * 100, "%", formula))

        name = "liquidity"
        formula = "current_assets / current_liabilities"
        if not missing_for(["current_assets", "current_liabilities"], "ratio", formula):
            metrics[name] = (unavailable("ratio", formula, reason="current_liabilities is zero")
                             if data.current_liabilities == 0 else
                             result(data.current_assets / data.current_liabilities, "ratio", formula))

        name = "funding_gap"
        fields = ["working_capital_needed", "cash_balance", "minimum_cash_reserve", "buyer_deposit", "committed_funding"]
        formula = "max(0, working_capital_needed - max(0, cash_balance - minimum_cash_reserve) - buyer_deposit - committed_funding)"
        if not missing_for(fields, "THB", formula):
            usable_cash = max(ZERO, data.cash_balance - data.minimum_cash_reserve)
            metrics[name] = result(max(ZERO, data.working_capital_needed - usable_cash - data.buyer_deposit - data.committed_funding), "THB", formula)

        name = "dscr"
        fields = ["cash_available_for_debt_service", "debt_principal_due", "debt_interest_due"]
        formula = "cash_available_for_debt_service / (debt_principal_due + debt_interest_due)"
        if not missing_for(fields, "ratio", formula):
            debt_service = data.debt_principal_due + data.debt_interest_due
            metrics[name] = (unavailable("ratio", formula, reason="Debt service is zero") if debt_service == 0
                             else result(data.cash_available_for_debt_service / debt_service, "ratio", formula))

        name = "pmt"
        formula = "principal * r / (1 - (1 + r)^(-periods)); r = annual_interest_rate / payments_per_year"
        if data.loan is None:
            metrics[name] = unavailable("THB", formula, missing=["loan"])
        else:
            if data.loan.timing == "beginning":
                formula += "; divide by (1 + r) for beginning payments"
            metrics[name] = result(calculate_pmt(data.loan), "THB", formula)

        missing = sorted({field for metric in metrics.values() for field in metric.missingFields})
        now = datetime.now(timezone.utc).isoformat()
        return {
            "data": {name: metric.model_dump() for name, metric in metrics.items()},
            "kind": data.kind,
            "status": "insufficient_data" if any(metric.status != "ok" for metric in metrics.values()) else "ok",
            "missing": missing,
            "asOf": data.period_end.isoformat(),
            "analyzedAt": now,
            "period": f"{data.period_start.isoformat()}/{data.period_end.isoformat()}",
            "unit": data.currency,
        }
