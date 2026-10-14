import json
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.finance import calculate_financials, calculate_pmt
from app.schemas import FinancialInput, LoanTerms


def example_payload():
    return json.loads((Path(__file__).parents[1] / "examples/manual_input.json").read_text())


def metrics(payload):
    return calculate_financials(FinancialInput.model_validate(payload))["data"]


def test_all_eight_metrics_known_answers():
    response = calculate_financials(FinancialInput.model_validate(example_payload()))
    assert response["status"] == "ok"
    assert response["kind"] == "simulated"
    assert {key: value["value"] for key, value in response["data"].items()} == {
        "fcf": "50000.00", "net_cash_flow": "40000.00", "roa": "5.2632", "roe": "13.3333",
        "liquidity": "2.0000", "funding_gap": "70000.00", "dscr": "2.0000", "pmt": "10661.85",
    }


def test_missing_is_not_zero():
    payload = example_payload()
    for field in ["capital_expenditure", "opening_assets", "buyer_deposit", "loan"]:
        del payload[field]
    response = calculate_financials(FinancialInput.model_validate(payload))
    assert response["status"] == "insufficient_data"
    for name, field in [("fcf", "capital_expenditure"), ("roa", "opening_assets"), ("funding_gap", "buyer_deposit"), ("pmt", "loan")]:
        assert response["data"][name]["value"] is None
        assert response["data"][name]["missingFields"] == [field]
    assert response["data"]["net_cash_flow"]["value"] == "40000.00"


def test_zero_denominators_and_negative_equity():
    payload = {**example_payload(), "current_liabilities": "0", "debt_principal_due": "0",
               "debt_interest_due": "0", "opening_equity": "-500000"}
    for name in ["liquidity", "dscr", "roe"]:
        metric = metrics(payload)[name]
        assert metric["value"] is None
        assert metric["status"] == "undefined"
        assert metric["reason"]


def test_zero_average_assets():
    payload = {**example_payload(), "assets": "0", "liabilities": "0", "equity": "0",
               "opening_assets": "0", "cash_balance": "0", "current_assets": "0", "current_liabilities": "0"}
    assert metrics(payload)["roa"]["status"] == "undefined"


def test_funding_gap_reserve_and_floor():
    payload = example_payload()
    payload["cash_balance"] = "10000"
    assert metrics(payload)["funding_gap"]["value"] == "120000.00"
    payload["committed_funding"] = "200000"
    assert metrics(payload)["funding_gap"]["value"] == "0.00"


def test_negative_cash_flow_and_zero_capex():
    payload = {**example_payload(), "operating_cash_flow": "-100", "capital_expenditure": "0",
               "cash_available_for_debt_service": "-30000"}
    result = metrics(payload)
    assert result["fcf"]["value"] == "-100.00"
    assert result["net_cash_flow"]["value"] == "-30100.00"
    assert result["dscr"]["value"] == "-1.0000"


def test_pmt_zero_rate_and_beginning_payments():
    terms = example_payload()["loan"]
    assert calculate_pmt(LoanTerms(**{**terms, "annual_interest_rate": "0"})) == Decimal("10000")
    end = calculate_pmt(LoanTerms(**terms))
    beginning = calculate_pmt(LoanTerms(**{**terms, "timing": "beginning"}))
    assert abs(beginning * Decimal("1.01") - end) < Decimal("0.00000001")


def test_pmt_amortizes_principal():
    loan = LoanTerms(**example_payload()["loan"])
    balance = loan.principal
    rate = loan.annual_interest_rate / loan.payments_per_year
    payment = calculate_pmt(loan)
    for _ in range(loan.periods):
        balance = balance * (1 + rate) - payment
    assert abs(balance) < Decimal("0.000001")


@pytest.mark.parametrize("patch", [
    {"annual_interest_rate": "12"}, {"annual_interest_rate": "-0.01"},
    {"periods": 0}, {"periods": 12.5}, {"periods": True}, {"payments_per_year": 0},
])
def test_invalid_loan_terms(patch):
    with pytest.raises(ValidationError):
        LoanTerms(**{**example_payload()["loan"], **patch})
