"""Missing financial evidence must not become an observed zero."""

import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas import FinancialInput
from engines.financial_engine import calculate_statement


def example_input():
    return json.loads(
        (Path(__file__).parents[1] / "examples/analysis_input.json").read_text(encoding="utf-8")
    )


def test_omitted_expense_total_preserves_existing_calculation():
    financial_input = FinancialInput.model_validate(example_input())
    assert financial_input.total_expenses is None
    assert financial_input.inventory is None
    result = calculate_statement(financial_input)
    assert result["data"]["net_profit"]["value"] == "50000.00"
    assert result["data"]["total_cost"]["value"] == "200000.00"
    assert result["grading"]["grade"] == "B"
    assert result["grading"]["score"] == "75.00"


@pytest.mark.parametrize("field", ["assets", "liabilities", "equity"])
def test_missing_required_balance_amount_is_rejected_by_http(field):
    data = example_input()
    del data[field]
    response = TestClient(app).post("/api/v1/inputs/manual", json=data)
    assert response.status_code == 422


@pytest.mark.parametrize("value,expected", [(None, None), ("0", Decimal("0")), ("1234.50", Decimal("1234.50"))])
def test_inventory_distinguishes_unknown_from_known_zero(value, expected):
    assert FinancialInput.model_validate({**example_input(), "inventory": value}).inventory == expected


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", float("nan"), float("inf")])
def test_nonfinite_inventory_is_rejected(value):
    with pytest.raises(ValidationError, match="NaN and infinity are not allowed"):
        FinancialInput.model_validate({**example_input(), "inventory": value})
