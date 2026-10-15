from copy import deepcopy
from decimal import Decimal
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.grading import grade_financials
from app.matching import match_funding, match_investors
from app.schemas import FinancialInput


def data(**updates):
    payload = json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text())
    return FinancialInput.model_validate({**payload, **updates})


def product(**updates):
    return {"id": "loan", "type": "term_loan", "minAmount": "1000", "maxAmount": "100000",
            "interestRateAnnual": "0.12", "termMonths": 12, "disbursementDays": 5,
            "minDscr": "1.5", **updates}


def investor(**updates):
    return {"id": "investor", "ticket_min": "1000", "ticket_max": "100000",
            "target_sectors": ["food"], "risk_appetite": "low", "min_grade": "B",
            "min_dscr": "1.5", "horizon_months": 24, **updates}


def funding(products=None, amount="10000", value=None):
    value = value or data()
    return match_funding(value, grade_financials(value), Decimal(amount), products or [product()])


def test_monthly_payment_and_new_dscr_share_one_reporting_month():
    row = funding()[0]
    assert row["status"] == "eligible"
    assert row["monthly_payment"] == "888.49"
    assert row["period_installments"] == "1"
    assert row["additional_period_debt_service"] == "888.49"
    assert Decimal(row["post_funding_dscr"]) == (Decimal(60000) / Decimal("30888.49")).quantize(Decimal("0.0001"))
    assert 0 <= row["match_score"] <= 100
    assert "not credit approval" in row["notice"]


def test_annual_and_partial_month_period_exposure():
    annual = funding(value=data(period_start="2026-01-01", period_end="2026-12-31"))[0]
    assert annual["period_installments"] == "12"
    assert annual["status"] == "not_eligible"
    partial = funding(value=data(period_start="2026-09-01", period_end="2026-09-15"))[0]
    assert Decimal(partial["period_installments"]) == Decimal("0.5")
    short_tenor = funding([product(termMonths=3)], value=data(period_start="2026-01-01", period_end="2026-12-31"))[0]
    assert short_tenor["period_installments"] == "3"


def test_passing_old_dscr_is_not_enough_after_new_installment():
    row = funding(amount="100000", value=data(cash_available_for_debt_service="45000"))[0]
    assert row["status"] == "not_eligible"
    assert row["match_score"] == 0
    assert "post_funding_dscr" in row["match_reason"]


def test_zero_existing_debt_uses_new_loan_service():
    row = funding(value=data(debt_principal_due="0", debt_interest_due="0"))[0]
    assert row["status"] == "eligible"
    assert Decimal(row["post_funding_dscr"]) > 1


def test_unrounded_coverage_controls_eligibility_at_a_display_rounding_boundary():
    below = funding(value=data(cash_available_for_debt_service="46332.73"))[0]
    above = funding(value=data(cash_available_for_debt_service="46332.74"))[0]
    assert below["post_funding_dscr"] == "1.5000"
    assert below["status"] == "not_eligible"
    assert "unrounded" in below["match_reason"]
    assert above["status"] == "eligible"


def test_grants_add_no_loan_payment_and_do_not_require_cfads_without_a_dscr_mandate():
    value = data(cash_available_for_debt_service=None)
    row = match_funding(value, {"grade": "B", "score": "75"}, Decimal(10000),
                        [product(type="grant", interestRateAnnual="0", minDscr=None)])[0]
    assert row["monthly_payment"] == "0.00"
    assert row["additional_period_debt_service"] == "0"
    assert row["status"] == "eligible"
    assert row["post_funding_dscr"] is None


@pytest.mark.parametrize("changes,criterion", [({"minAmount": "20000"}, "amount_range"),
                                               ({"active": False}, "active"),
                                               ({"type": "grant"}, "grant_terms")])
def test_hard_rejection_names_the_failed_criterion(changes, criterion):
    row = funding([product(**changes)])[0]
    assert row["status"] == "not_eligible"
    assert criterion in row["match_reason"]


def test_missing_inputs_are_not_zero_or_eligible():
    row = funding(value=data(cash_available_for_debt_service=None))[0]
    assert row["status"] == "requires_info"
    assert "cash_available_for_debt_service" in row["missing"]
    assert row["post_funding_dscr"] is None


def test_rank_is_stable_and_does_not_mutate_catalog_or_grade():
    rows = [product(id="expensive", interestRateAnnual="0.2", disbursementDays=20),
            product(id="cheap", interestRateAnnual="0", disbursementDays=1)]
    original = deepcopy(rows)
    forward = funding(rows)
    assert forward == funding(list(reversed(rows)))
    assert forward[0]["product_id"] == "cheap"
    assert rows == original


def test_investors_follow_sector_risk_and_ticket_mandates_without_new_debt():
    value = data()
    row = match_investors(value, grade_financials(value), Decimal(10000), [investor()],
                          sector="FOOD", investment_horizon_months=24)[0]
    assert row["status"] == "eligible"
    assert "monthly_payment" not in row
    assert "post_funding_dscr" not in row
    assert "not credit approval" in row["notice"]
    rejected = match_investors(value, {"grade": "D", "score": "10"}, Decimal(10000), [investor()],
                               sector="packing", investment_horizon_months=24)[0]
    assert rejected["status"] == "not_eligible"
    assert "sector" in rejected["match_reason"]
    assert "grade_or_risk_appetite" in rejected["match_reason"]


def test_investor_unknown_sector_and_horizon_need_information():
    value = data()
    row = match_investors(value, grade_financials(value), Decimal(10000), [investor()])[0]
    assert row["status"] == "requires_info"
    assert set(row["missing"]) == {"sector", "investment_horizon_months"}


@pytest.mark.parametrize("amount", ["0", "-1", "NaN", "0.001"])
def test_invalid_request_amounts(amount):
    with pytest.raises(ValidationError):
        funding(amount=amount)


def test_invalid_catalog_and_duplicate_product_ids():
    with pytest.raises(ValueError, match="Duplicate"):
        funding([product(), product()])
    with pytest.raises(ValidationError):
        funding([product(interestRateAnnual="12")])
