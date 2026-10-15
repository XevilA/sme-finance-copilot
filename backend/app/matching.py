"""Pure, versioned numeric screening and ranking; never a financing approval."""

from calendar import monthrange
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, BeforeValidator, ConfigDict, Field, TypeAdapter

from .finance import calculate_pmt
from .schemas import FinancialInput, LoanTerms, PositiveMoney, Rate, parse_decimal

NOTICE = "Demo ranking of supplied numerical criteria only; not credit approval or an investment offer. Verify documents and provider conditions."
POLICY_VERSION = "funding-match-demo-v1"
_REQUEST = TypeAdapter(Annotated[PositiveMoney, Field(gt=0)])
_RATIO = Annotated[Decimal, BeforeValidator(parse_decimal), Field(ge=0, max_digits=20, decimal_places=10)]
_GRADE_ORDER = {"A": 4, "B": 3, "C": 2, "D": 1}


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str = Field(min_length=1, max_length=128)
    type: Literal["term_loan", "invoice_financing", "po_financing", "grant", "revolving"]
    min_amount: PositiveMoney = Field(validation_alias=AliasChoices("minAmount", "min_amount"))
    max_amount: PositiveMoney = Field(validation_alias=AliasChoices("maxAmount", "max_amount"))
    annual_rate: Rate = Field(validation_alias=AliasChoices("interestRateAnnual", "interest_rate_annual"))
    term_months: int = Field(strict=True, gt=0, le=1200, validation_alias=AliasChoices("termMonths", "term_months"))
    disbursement_days: int = Field(strict=True, ge=0, le=3650, validation_alias=AliasChoices("disbursementDays", "disbursement_days"))
    min_dscr: _RATIO | None = Field(default=None, validation_alias=AliasChoices("minDscr", "min_dscr"))
    active: bool = Field(default=True, strict=True)


class Investor(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str = Field(min_length=1, max_length=128)
    ticket_min: PositiveMoney = Field(validation_alias=AliasChoices("ticketMin", "ticket_min"))
    ticket_max: PositiveMoney = Field(validation_alias=AliasChoices("ticketMax", "ticket_max"))
    target_sectors: list[str] = Field(default_factory=list, validation_alias=AliasChoices("targetSectors", "target_sectors"))
    min_grade: Literal["A", "B", "C", "D"] | None = Field(default=None, validation_alias=AliasChoices("minGrade", "min_grade"))
    min_dscr: _RATIO | None = Field(default=None, validation_alias=AliasChoices("minDscr", "min_dscr"))
    risk_appetite: Literal["low", "medium", "high"] = Field(validation_alias=AliasChoices("riskAppetite", "risk_appetite"))
    horizon_months: int | None = Field(default=None, strict=True, gt=0, le=1200, validation_alias=AliasChoices("horizonMonths", "horizon_months"))
    active: bool = Field(default=True, strict=True)


class Grade(BaseModel):
    model_config = ConfigDict(extra="ignore")
    grade: Literal["A", "B", "C", "D"] | None = None
    score: Annotated[Decimal, BeforeValidator(parse_decimal), Field(ge=0, le=100)] | None = None


def _period_months(data: FinancialInput) -> Decimal:
    """Calendar-month exposure: full months plus actual fractions at the edges."""
    start, end = data.period_start, data.period_end
    if (start.year, start.month) == (end.year, end.month):
        return Decimal((end - start).days + 1) / monthrange(start.year, start.month)[1]
    full_months = (end.year - start.year) * 12 + end.month - start.month - 1
    first_days = monthrange(start.year, start.month)[1]
    return Decimal(full_months) + Decimal(first_days - start.day + 1) / first_days + Decimal(end.day) / monthrange(end.year, end.month)[1]


def _coverage(data: FinancialInput, new_service: Decimal) -> tuple[Decimal | None, list[str]]:
    fields = ("cash_available_for_debt_service", "debt_principal_due", "debt_interest_due")
    missing = [name for name in fields if getattr(data, name) is None]
    if missing:
        return None, missing
    service = data.debt_principal_due + data.debt_interest_due + new_service
    return (None if service == 0 else data.cash_available_for_debt_service / service), []


def _score(value: Decimal) -> int:
    return int(max(Decimal(0), min(Decimal(100), value)).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _status(rejections: list[str], missing: list[str]) -> str:
    return "not_eligible" if rejections else "requires_info" if missing else "eligible"


def _sort(rows: list[dict], identifier: str) -> list[dict]:
    order = {"eligible": 0, "requires_info": 1, "not_eligible": 2}
    return sorted(rows, key=lambda row: (order[row["status"]], -row["match_score"], row[identifier]))


def _validate_rows(rows: list[dict], model):
    if len(rows) > 500:
        raise ValueError("At most 500 candidates are supported")
    validated = [model.model_validate(row) for row in rows]
    if len({row.id for row in validated}) != len(validated):
        raise ValueError("Duplicate candidate ids are not allowed")
    return validated


def match_funding(data: FinancialInput, grade: dict, requested_amount: Decimal, products: list[dict]) -> list[dict]:
    """Rank catalog rows without DB access or changing existing adapter contracts.

    Debt is stressed using calendar-month-equivalent installments in the same
    input reporting period, capped at the tenor. This is a disclosed demo stress
    model, not a dated lender payment schedule. Grants have no debt repayment.
    """
    amount = _REQUEST.validate_python(requested_amount)
    health = Grade.model_validate(grade)
    candidates = _validate_rows(products, Product)
    results = []
    with localcontext() as context:
        context.prec = 50
        months = _period_months(data)
        for product in candidates:
            rejected, missing = [], []
            if product.max_amount < product.min_amount:
                raise ValueError(f"Product {product.id}: max_amount is below min_amount")
            if not product.active:
                rejected.append("active: product is inactive")
            if not product.min_amount <= amount <= product.max_amount:
                rejected.append("amount_range: requested_amount is outside min_amount/max_amount")
            if health.grade is None or health.score is None:
                missing.append("financial_grade")
            grant = product.type == "grant"
            if grant and product.annual_rate != 0:
                rejected.append("grant_terms: a non-repayable grant cannot carry a loan interest rate")
            payment = Decimal(0) if grant else calculate_pmt(LoanTerms(
                principal=amount, annual_interest_rate=product.annual_rate,
                periods=product.term_months, payments_per_year=12,
            )).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            installments = Decimal(0) if grant else min(months, Decimal(product.term_months))
            new_service = payment * installments
            dscr, coverage_missing = _coverage(data, new_service)
            floor = product.min_dscr if grant else max(product.min_dscr or Decimal(0), Decimal(1))
            if not grant or product.min_dscr is not None:
                missing += coverage_missing
                if dscr is None and not coverage_missing:
                    # Explicitly debt-free, nonnegative CFADS satisfies a grant screen.
                    if not (grant and data.cash_available_for_debt_service >= 0):
                        missing.append("defined_dscr")
                elif dscr is not None and floor is not None and dscr < floor:
                    rejected.append(f"post_funding_dscr: {dscr:.4f} is below required {floor}")
            grade_points = (health.score or Decimal(0)) * Decimal("0.25")
            coverage_points = Decimal(45) if grant else (Decimal(0) if dscr is None else min(Decimal(1), max(Decimal(0), dscr / max(floor, Decimal("1.5")))) * 45)
            exact_payment = Decimal(0) if grant else calculate_pmt(LoanTerms(principal=amount, annual_interest_rate=product.annual_rate, periods=product.term_months, payments_per_year=12))
            financing_cost = max(Decimal(0), exact_payment * product.term_months - amount) if not grant else Decimal(0)
            cost_points = max(Decimal(0), 1 - financing_cost / amount) * 20
            speed_points = max(Decimal(0), 1 - Decimal(product.disbursement_days) / 30) * 10
            status = _status(rejected, missing)
            score = 0 if rejected else _score(grade_points + coverage_points + cost_points + speed_points)
            reasons = rejected + (["Missing: " + ", ".join(sorted(set(missing)))] if missing else [])
            if not reasons:
                reasons = ["Meets supplied numerical screening criteria; verify documents and provider conditions"]
            results.append({"product_id": product.id, "match_score": score, "match_reason": "; ".join(reasons),
                            "status": status, "monthly_payment": format(payment, ".2f"),
                            "period_installments": format(installments, "f"), "additional_period_debt_service": format(new_service, "f"),
                            "post_funding_dscr": None if dscr is None else format(dscr.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP), "f"),
                            "missing": sorted(set(missing)), "notice": NOTICE, "policy_version": POLICY_VERSION,
                            "assumptions": ["Calendar-month-equivalent debt service in the supplied reporting period; capped at tenor",
                                            "Fixed monthly amortizing debt, no fees or balloon; non-repayable grants have zero installment",
                                            "Ranking weights: coverage 45%, grade 25%, financing cost 20%, disbursement speed 10%"]})
    return _sort(results, "product_id")


def match_investors(data: FinancialInput, grade: dict, requested_amount: Decimal, investors: list[dict], *,
                    sector: str | None = None, investment_horizon_months: int | None = None) -> list[dict]:
    """Equity mandate matching; no new loan or PMT is attributed to investment."""
    amount = _REQUEST.validate_python(requested_amount)
    health = Grade.model_validate(grade)
    if investment_horizon_months is not None and (isinstance(investment_horizon_months, bool) or not isinstance(investment_horizon_months, int) or not 1 <= investment_horizon_months <= 1200):
        raise ValueError("investment_horizon_months must be an integer from 1 to 1200")
    results = []
    with localcontext() as context:
        context.prec = 50
        for investor in _validate_rows(investors, Investor):
            rejected, missing = [], []
            if investor.ticket_max < investor.ticket_min:
                raise ValueError(f"Investor {investor.id}: ticket_max is below ticket_min")
            if not investor.active:
                rejected.append("active: investor is inactive")
            if not investor.ticket_min <= amount <= investor.ticket_max:
                rejected.append("ticket_range: requested_amount is outside ticket_min/ticket_max")
            if health.grade is None or health.score is None:
                missing.append("financial_grade")
            else:
                required_grade = max(_GRADE_ORDER[investor.min_grade] if investor.min_grade else 0,
                                     {"low": 3, "medium": 2, "high": 1}[investor.risk_appetite])
                if _GRADE_ORDER[health.grade] < required_grade:
                    rejected.append("grade_or_risk_appetite: SME grade is below the declared minimum or demo risk policy")
            if investor.target_sectors:
                if sector is None or not sector.strip():
                    missing.append("sector")
                elif sector.strip().casefold() not in {value.strip().casefold() for value in investor.target_sectors}:
                    rejected.append("sector: business is outside target_sectors")
            if investor.horizon_months is not None and investment_horizon_months is None:
                missing.append("investment_horizon_months")
            if investor.min_dscr is not None:
                dscr, coverage_missing = _coverage(data, Decimal(0))
                missing += coverage_missing
                if dscr is None and not coverage_missing:
                    missing.append("defined_existing_dscr")
                elif dscr is not None and dscr < investor.min_dscr:
                    rejected.append("existing_dscr: SME coverage is below investor min_dscr")
            horizon_points = Decimal(20)
            if investor.horizon_months is not None:
                horizon_points = Decimal(0) if investment_horizon_months is None else Decimal(min(investor.horizon_months, investment_horizon_months)) / max(investor.horizon_months, investment_horizon_months) * 20
            sector_points = Decimal(25) if "sector" not in missing and not any(reason.startswith("sector:") for reason in rejected) else Decimal(0)
            score = 0 if rejected else _score((health.score or Decimal(0)) * Decimal("0.55") + sector_points + horizon_points)
            reasons = rejected + (["Missing: " + ", ".join(sorted(set(missing)))] if missing else [])
            results.append({"investor_id": investor.id, "match_score": score,
                            "match_reason": "; ".join(reasons) if reasons else "Matches supplied ticket, sector, grade and investor mandate; negotiate terms separately",
                            "status": _status(rejected, missing), "missing": sorted(set(missing)),
                            "notice": NOTICE, "policy_version": POLICY_VERSION,
                            "assumptions": ["Equity adds no loan installment; existing DSCR is used only when the investor requires it",
                                            "Demo risk appetite minimums: low=B, medium=C, high=D; stricter min_grade wins",
                                            "Ranking weights: grade 55%, sector 25%, preferred-horizon fit 20%; valuation and dilution are not inferred"]})
    return _sort(results, "investor_id")
