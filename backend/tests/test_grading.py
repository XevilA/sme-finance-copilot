import json
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.finance import calculate_business_metrics
from app.grading import grade_financials
from app.schemas import FinancialInput


def payload(**changes):
    data = json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text())
    return {**data, **changes}


def test_business_metrics_known_answers():
    metrics = calculate_business_metrics(FinancialInput(**payload()))
    assert {key: item["value"] for key, item in metrics.items()} == {
        "gross_profit": "130000.00", "operating_profit": "70000.00", "net_profit": "50000.00",
        "total_cost": "200000.00", "cost_per_unit": "72.00", "contribution_per_unit": "52.00",
        "breakeven_units": "1154.0000", "roi": "15.0000", "debt_ratio": "0.6000", "cash_reserve_months": "0.4000",
    }


def test_profit_must_reconcile():
    with pytest.raises(ValidationError, match="net_income must reconcile"):
        FinancialInput(**payload(net_income="1"))


def test_missing_cost_is_not_zero():
    metrics = calculate_business_metrics(FinancialInput(**payload(tax_expense=None)))
    assert metrics["net_profit"]["value"] is None
    assert metrics["net_profit"]["missingFields"] == ["tax_expense"]
    assert metrics["gross_profit"]["value"] == "130000.00"


def test_break_even_and_roi_undefined():
    metrics = calculate_business_metrics(FinancialInput(**payload(variable_cost_per_unit="100", initial_investment="0", units_sold=0)))
    for name in ["breakeven_units", "roi", "cost_per_unit"]:
        assert metrics[name]["value"] is None
        assert metrics[name]["status"] == "undefined"


def test_grade_uses_normalized_weighted_scores():
    grade = grade_financials(FinancialInput(**payload()))
    assert grade["grade"] == "B"
    assert grade["score"] == "75.00"
    assert grade["components"]["dscr"]["score"] == "100.0000"
    assert grade["components"]["debt_burden"]["score"] == "40.0000"
    weighted = sum(Decimal(item["weight"]) * Decimal(item["score"]) for item in grade["components"].values())
    assert abs(weighted - Decimal(grade["score"])) < Decimal("0.01")


@pytest.mark.parametrize("score,expected", [(80, "A"), (79, "B"), (65, "B"), (64, "C"), (50, "C"), (49, "D"), (0, "D"), (100, "A")])
def test_all_grade_boundaries(score, expected):
    ratio = Decimal(score) / 100
    data = payload(assets="100000", liabilities=str(Decimal(100000) * (1 - ratio)), equity=str(Decimal(100000) * ratio),
                   current_assets="100000", current_liabilities="0", cash_balance=str(Decimal(3000) * ratio),
                   operating_cash_outflow="1000", revenue="100000", cost_of_goods_sold=None,
                   operating_cash_flow=str(Decimal(20000) * ratio), cash_available_for_debt_service=str(Decimal(1500) * ratio),
                   debt_principal_due="1000", debt_interest_due="0")
    grade = grade_financials(FinancialInput(**data))
    assert grade["score"] == f"{score}.00"
    assert grade["grade"] == expected


def test_missing_or_zero_revenue_does_not_produce_a_grade():
    for revenue in [None, "0"]:
        grade = grade_financials(FinancialInput(**payload(revenue=revenue, net_income=None)))
        assert grade["grade"] is None
        assert grade["score"] is None


def test_explicit_debt_free_case():
    grade = grade_financials(FinancialInput(**payload(debt_principal_due="0", debt_interest_due="0")))
    assert grade["components"]["dscr"]["score"] == "100.0000"
    assert grade["components"]["dscr"]["rawValue"] is None


def test_negative_cash_flow_and_insolvency_are_not_positive_scores():
    grade = grade_financials(FinancialInput(**payload(operating_cash_flow="-1000", liabilities="1100000", equity="-100000")))
    assert grade["components"]["cash_flow"]["score"] == "0.0000"
    assert grade["components"]["debt_burden"]["score"] == "0.0000"
