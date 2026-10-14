"""Decimal financial functions; ratios return None when undefined."""

from collections.abc import Mapping
from decimal import Decimal, localcontext
from typing import Any

from pydantic import TypeAdapter

from app.grading import grade_financials
from app.schemas import FinancialInput, LoanTerms, Money, PositiveMoney

_MONEY = TypeAdapter(Money)
_NONNEGATIVE = TypeAdapter(PositiveMoney)


def calculate_net_profit(revenue: object, total_expenses: object) -> Decimal:
    with localcontext() as context:
        context.prec = 50
        return _NONNEGATIVE.validate_python(revenue) - _NONNEGATIVE.validate_python(total_expenses)


def calculate_fcf(operating_cash_flow: object, capital_expenditure: object) -> Decimal:
    with localcontext() as context:
        context.prec = 50
        return _MONEY.validate_python(operating_cash_flow) - _NONNEGATIVE.validate_python(capital_expenditure)


def calculate_dscr(cash_available: object, principal_due: object, interest_due: object) -> Decimal | None:
    with localcontext() as context:
        context.prec = 50
        cash = _MONEY.validate_python(cash_available)
        service = _NONNEGATIVE.validate_python(principal_due) + _NONNEGATIVE.validate_python(interest_due)
        return None if service == 0 else cash / service


def _return_on_balance(net_profit: object, opening: object, closing: object, *, signed: bool) -> Decimal | None:
    with localcontext() as context:
        context.prec = 50
        profit = _MONEY.validate_python(net_profit)
        adapter = _MONEY if signed else _NONNEGATIVE
        average = (adapter.validate_python(opening) + adapter.validate_python(closing)) / 2
        return None if average <= 0 else profit / average * 100


def calculate_roa(net_profit: object, opening_assets: object, closing_assets: object) -> Decimal | None:
    return _return_on_balance(net_profit, opening_assets, closing_assets, signed=False)


def calculate_roe(net_profit: object, opening_equity: object, closing_equity: object) -> Decimal | None:
    return _return_on_balance(net_profit, opening_equity, closing_equity, signed=True)


def calculate_liquidity(current_assets: object, current_liabilities: object) -> Decimal | None:
    with localcontext() as context:
        context.prec = 50
        assets = _NONNEGATIVE.validate_python(current_assets)
        liabilities = _NONNEGATIVE.validate_python(current_liabilities)
        return None if liabilities == 0 else assets / liabilities


def calculate_pmt(loan: LoanTerms | Mapping[str, Any]) -> Decimal:
    """Positive periodic payment, nominal annual rate, zero terminal balance."""
    terms = loan if isinstance(loan, LoanTerms) else LoanTerms.model_validate(loan)
    with localcontext() as context:
        context.prec = 50
        rate = terms.annual_interest_rate / terms.payments_per_year
        if rate == 0:
            return terms.principal / terms.periods
        discount = (1 + rate) ** -terms.periods
        payment = terms.principal * rate / (1 - discount)
        return payment / (1 + rate) if terms.timing == "beginning" else payment


def calculate_grade(data: FinancialInput | Mapping[str, Any]) -> dict:
    """Reuse the versioned 35/30/20/15 normalized A-D policy."""
    validated = data if isinstance(data, FinancialInput) else FinancialInput.model_validate(data)
    return grade_financials(validated)


def calculate_statement(data: FinancialInput | Mapping[str, Any]) -> dict:
    """JSON-safe metrics and grading for the API layer to consume."""
    from app.finance import calculate_business_metrics, calculate_financials

    validated = data if isinstance(data, FinancialInput) else FinancialInput.model_validate(data)
    response = calculate_financials(validated)
    response["data"].update(calculate_business_metrics(validated))
    response["grading"] = calculate_grade(validated)
    response["missing"] = sorted({field for metric in response["data"].values() for field in metric["missingFields"]}
                                 | set(response["grading"]["missingFields"]))
    response["status"] = "ok" if response["grading"]["status"] == "ok" and all(
        metric["status"] == "ok" for metric in response["data"].values()
    ) else "insufficient_data"
    return response
