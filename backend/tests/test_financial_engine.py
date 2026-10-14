import json
from decimal import Decimal, localcontext
from pathlib import Path

import pytest
from pydantic import ValidationError

from engines.financial_engine import (
    calculate_dscr, calculate_fcf, calculate_grade, calculate_liquidity,
    calculate_net_profit, calculate_pmt, calculate_roa, calculate_roe, calculate_statement,
)


def payload():
    return json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text(encoding="utf-8"))


def test_standalone_known_answers_and_period_ratios():
    assert calculate_net_profit("250000", "200000") == Decimal("50000")
    assert calculate_fcf("70000", "20000") == Decimal("50000")
    assert calculate_dscr("60000", "25000", "5000") == Decimal("2")
    assert calculate_roa("50000", "900000", "1000000").quantize(Decimal("0.0001")) == Decimal("5.2632")
    assert calculate_roe("50000", "350000", "400000").quantize(Decimal("0.0001")) == Decimal("13.3333")
    assert calculate_liquidity("300000", "150000") == Decimal("2")


def test_undefined_ratios_and_cash_losses_are_explicit():
    assert calculate_dscr("0", "0", "0") is None
    assert calculate_liquidity("100", "0") is None
    assert calculate_roa("100", "0", "0") is None
    assert calculate_roe("100", "-100", "50") is None
    assert calculate_fcf("-100", "50") == Decimal("-150")
    assert calculate_dscr("-500", "1000", "0") == Decimal("-0.5")


@pytest.mark.parametrize("value", [True, "NaN", "Infinity", "1,000", "0.001", -1])
def test_direct_function_validation_rejects_invalid_expenses(value):
    with pytest.raises(ValidationError):
        calculate_net_profit("1000", value)


def test_pmt_amortization_and_zero_interest():
    loan = {"principal": "120000", "annual_interest_rate": "0.12", "periods": 12, "payments_per_year": 12}
    payment = calculate_pmt(loan)
    with localcontext() as context:
        context.prec = 50
        balance = Decimal(loan["principal"])
        for _ in range(loan["periods"]):
            balance = balance * Decimal("1.01") - payment
        assert abs(balance) < Decimal("0.000001")
        beginning = calculate_pmt({**loan, "timing": "beginning"})
        assert abs(beginning * Decimal("1.01") - payment) < Decimal("0.000001")
    assert calculate_pmt({**loan, "annual_interest_rate": "0"}) == Decimal("10000")


def test_statement_json_and_reused_grading_policy():
    result = calculate_statement(payload())
    assert result["grading"] == calculate_grade(payload())
    assert result["grading"]["score"] == "75.00"
    assert result["grading"]["grade"] == "B"
    assert result["status"] == "ok"
    assert result["missing"] == []
    json.dumps(result, allow_nan=False)
