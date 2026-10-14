"""Validated input contract. Money and rates use Decimal, never binary floats."""

from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator


def parse_decimal(value: object) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError("Expected a finite numeric value, not a boolean")
    try:
        number = Decimal(str(value).strip())
    except InvalidOperation as exc:
        raise ValueError("Expected a numeric value without currency symbols or separators") from exc
    if not number.is_finite():
        raise ValueError("NaN and infinity are not allowed")
    return number


Money = Annotated[Decimal, BeforeValidator(parse_decimal), Field(max_digits=20, decimal_places=2)]
PositiveMoney = Annotated[Money, Field(ge=0)]
Rate = Annotated[Decimal, BeforeValidator(parse_decimal), Field(ge=0, le=1, max_digits=12, decimal_places=10)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoanTerms(StrictModel):
    principal: PositiveMoney
    annual_interest_rate: Rate
    periods: int = Field(strict=True, gt=0, le=1200)
    payments_per_year: int = Field(strict=True, gt=0, le=365)
    timing: Literal["end", "beginning"] = "end"


class FinancialInput(StrictModel):
    currency: Literal["THB"]
    kind: Literal["actual", "forecast", "simulated"]
    period_start: date
    period_end: date
    assets: PositiveMoney
    liabilities: PositiveMoney
    equity: Money
    opening_assets: PositiveMoney | None = None
    opening_equity: Money | None = None
    current_assets: PositiveMoney | None = None
    current_liabilities: PositiveMoney | None = None
    cash_balance: PositiveMoney | None = None
    net_income: Money | None = None
    operating_cash_flow: Money | None = None
    investing_cash_flow: Money | None = None
    financing_cash_flow: Money | None = None
    capital_expenditure: PositiveMoney | None = None
    cash_available_for_debt_service: Money | None = None
    debt_principal_due: PositiveMoney | None = None
    debt_interest_due: PositiveMoney | None = None
    working_capital_needed: PositiveMoney | None = None
    minimum_cash_reserve: PositiveMoney | None = None
    buyer_deposit: PositiveMoney | None = None
    committed_funding: PositiveMoney | None = None
    revenue: PositiveMoney | None = None
    total_expenses: PositiveMoney | None = None
    cost_of_goods_sold: PositiveMoney | None = None
    operating_expenses: PositiveMoney | None = None
    interest_expense: PositiveMoney | None = None
    tax_expense: PositiveMoney | None = None
    operating_cash_outflow: PositiveMoney | None = None
    units_sold: int | None = Field(default=None, strict=True, ge=0, le=1_000_000_000)
    unit_price: PositiveMoney | None = None
    variable_cost_per_unit: PositiveMoney | None = None
    fixed_costs: PositiveMoney | None = None
    initial_investment: PositiveMoney | None = None
    investment_net_gain: Money | None = None
    loan: LoanTerms | None = None

    @model_validator(mode="after")
    def validate_financials(self) -> "FinancialInput":
        if self.period_end < self.period_start:
            raise ValueError("period_end must be on or after period_start")
        with localcontext() as context:
            context.prec = 50
            difference = self.assets - self.liabilities - self.equity
        if abs(difference) > Decimal("0.01"):
            raise ValueError(f"Balance sheet mismatch: assets - liabilities - equity = {difference}")
        with localcontext() as context:
            context.prec = 50
            expenses = [self.cost_of_goods_sold, self.operating_expenses, self.interest_expense, self.tax_expense]
            if self.total_expenses is not None:
                known_expenses = sum((value for value in expenses if value is not None), Decimal(0))
                if known_expenses - self.total_expenses > Decimal("0.01"):
                    raise ValueError("Known expense categories cannot exceed total_expenses")
                if all(value is not None for value in expenses) and abs(known_expenses - self.total_expenses) > Decimal("0.01"):
                    raise ValueError("total_expenses must reconcile with supplied expense categories within THB 0.01")
                if self.revenue is not None:
                    profit = self.revenue - self.total_expenses
                    if self.net_income is None:
                        self.net_income = profit
                    elif abs(profit - self.net_income) > Decimal("0.01"):
                        raise ValueError("net_income must reconcile with revenue - total_expenses within THB 0.01")
        profit_fields = [self.revenue, self.cost_of_goods_sold, self.operating_expenses,
                         self.interest_expense, self.tax_expense, self.net_income]
        if all(value is not None for value in profit_fields):
            with localcontext() as context:
                context.prec = 50
                profit = self.revenue - self.cost_of_goods_sold - self.operating_expenses - self.interest_expense - self.tax_expense
                if abs(profit - self.net_income) > Decimal("0.01"):
                    raise ValueError("net_income must reconcile with revenue and supplied expenses within THB 0.01")
        if self.current_assets is not None and self.current_assets > self.assets:
            raise ValueError("current_assets cannot exceed assets")
        if self.current_liabilities is not None and self.current_liabilities > self.liabilities:
            raise ValueError("current_liabilities cannot exceed liabilities")
        if self.cash_balance is not None:
            cash_limit = self.current_assets if self.current_assets is not None else self.assets
            if self.cash_balance > cash_limit:
                raise ValueError("cash_balance cannot exceed current_assets or assets")
        return self
