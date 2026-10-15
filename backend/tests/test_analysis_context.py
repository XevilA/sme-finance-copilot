from copy import deepcopy
from datetime import date
from decimal import Decimal
import json
from pathlib import Path

import pytest

from app.analysis import build_analysis
from app.forecasting import forecast_cashflow
from app.schemas import FinancialInput


def statement():
    return FinancialInput.model_validate(json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text()))


def forecast(**changes):
    return forecast_cashflow([
        {"id": "cost", "date": "2026-10-11", "amount": "70", "isInflow": False, "status": "projected"},
        {"id": "receipt", "date": "2026-11-20", "amount": "100", "isInflow": True, "status": "confirmed"},
    ], opening_cash=Decimal("50"), as_of=date(2026, 10, 1), minimum_cash_reserve=Decimal("20"),
        **{"schedule_complete_through": date(2026, 12, 30), **changes})


def expenses(amount="168000"):
    return [{"id": f"material-{month}", "date": f"2026-{month:02d}-09", "category": "materials", "amount": value}
            for month, value in [(7, "96000"), (8, "102000"), (9, "99500"), (10, amount)]]


def new_findings(result, prefix):
    return [row for row in result["data"]["findings"] if row["id"].startswith(prefix)]


def test_default_keyword_arguments_preserve_existing_contract():
    assert build_analysis(statement())["data"] == build_analysis(statement(), forecast=None, expense_history=None)["data"]
    assert "contextEvidence" not in build_analysis(statement())["data"]


def test_supplied_forecast_is_cited_without_changing_financial_math_or_recomputing(monkeypatch):
    supplied = forecast()
    snapshot = deepcopy(supplied)
    monkeypatch.setattr("app.forecasting.forecast_cashflow", lambda *args, **kwargs: pytest.fail("Forecast must not be recomputed"))
    baseline, result = build_analysis(statement()), build_analysis(statement(), forecast=supplied)
    assert result["data"]["metrics"] == baseline["data"]["metrics"]
    assert result["data"]["grading"] == baseline["data"]["grading"]
    facts = result["data"]["contextEvidence"]
    assert facts["forecast_minimum_cash"]["value"] == "-20.00"
    assert facts["forecast_minimum_cash"]["date"] == "2026-10-11"
    assert facts["forecast_minimum_cash"]["first_shortfall_date"] == "2026-10-11"
    assert facts["forecast_balance_30_days"]["value"] == "-20.00"
    assert facts["forecast_balance_60_days"]["value"] == "80.00"
    assert facts["forecast_balance_90_days"]["value"] == "80.00"
    assert len(new_findings(result, "forecast_")) == 3
    assert all("No dated cash events" not in text for text in result["data"]["explanation"]["unknowns"])
    assert supplied == snapshot
    evidence_ids = {row["id"] for row in result["data"]["explanation"]["dataUsed"]}
    targets = {row["id"] for row in result["data"]["indicators"]}
    for row in new_findings(result, "forecast_"):
        assert set(row["evidenceIds"]) <= evidence_ids
    assert all(row["targetElementId"] in targets for row in result["data"]["explanation"]["dataUsed"])


def test_conditional_forecast_is_not_reported_as_a_confirmed_shortfall():
    result = build_analysis(statement(), forecast=forecast(schedule_complete_through=None))
    assert not new_findings(result, "forecast_")
    assert result["data"]["contextEvidence"] == {}
    assert any("incomplete" in text for text in result["data"]["explanation"]["unknowns"])


def test_partial_schedule_cites_only_confirmed_horizon():
    result = build_analysis(statement(), forecast=forecast(schedule_complete_through=date(2026, 10, 31)))
    assert set(result["data"]["contextEvidence"]) == {"forecast_balance_30_days"}
    assert not new_findings(result, "forecast_cash_shortfall")


@pytest.mark.parametrize("field,value", [("unit", "USD"), ("minimum_cash", "NaN"),
    ("minimum_cash_date", "2027-01-01"), ("first_shortfall_date", "2026-10-12"),
    ("schedule_complete_through", None)])
def test_invalid_or_contradictory_forecast_is_rejected(field, value):
    supplied = forecast()
    supplied[field] = value
    with pytest.raises(ValueError):
        build_analysis(statement(), forecast=supplied)


def test_known_empty_expenses_are_distinct_from_unknown():
    unknown, empty = build_analysis(statement()), build_analysis(statement(), expense_history=[])
    assert "expenseComparison" not in unknown["data"]
    assert empty["data"]["expenseComparison"]["status"] == "known_empty"
    assert any("queried and is empty" in text for text in empty["data"]["explanation"]["unknowns"])
    assert not new_findings(empty, "unusual_expense_")


def test_materials_spike_has_reproducible_own_category_baseline():
    result = build_analysis(statement(), expense_history=expenses())
    comparison = result["data"]["expenseComparison"]
    item = comparison["categories"][0]
    assert comparison["as_of"] == "2026-10-09"
    assert comparison["policy"]["increase_threshold"] == "0.50"
    assert item["baseline_mean"] == "99166.67"
    assert item["increase_percent"] == "69.41"
    assert item["baseline_window_start"] == "2026-07-01"
    assert item["baseline_window_end"] == "2026-09-30"
    assert item["observed_months"] == ["2026-07-01", "2026-08-01", "2026-09-01"]
    assert item["source_ids"] == [f"material-{month}" for month in [10, 7, 8, 9]]
    findings = new_findings(result, "unusual_expense_")
    assert len(findings) == 1
    assert all(identifier in result["data"]["contextEvidence"] for identifier in findings[0]["evidenceIds"])


@pytest.mark.parametrize("amount,flagged", [("148750", False), ("148750.01", True)])
def test_expense_threshold_uses_unrounded_baseline(amount, flagged):
    assert bool(new_findings(build_analysis(statement(), expense_history=expenses(amount)), "unusual_expense_")) is flagged


def test_smooth_categories_do_not_flag_and_missing_month_is_not_zero():
    rows = [{"id": str(month), "date": f"2026-{month:02d}-12", "category": "materials", "amount": value}
            for month, value in [(7, "820000"), (8, "865000"), (9, "900000")]]
    result = build_analysis(statement(), expense_history=rows)
    item = result["data"]["expenseComparison"]["categories"][0]
    assert item["baseline_mean"] == "842500.00"
    assert item["missing_months"] == ["2026-06-01"]
    assert item["status"] == "normal"
    assert not new_findings(result, "unusual_expense_")


@pytest.mark.parametrize("rows", [expenses()[2:], expenses("500") + [{"id": "new", "date": "2026-10-08", "category": "new-category", "amount": "99999"}],
    [{**row, "amount": "0" if row["date"] < "2026-10" else "168000"} for row in expenses()]])
def test_no_positive_baseline_never_produces_a_spike(rows):
    result = build_analysis(statement(), expense_history=rows)
    assert not new_findings(result, "unusual_expense_")
    assert result["data"]["expenseComparison"]["status"] == "insufficient_data"


def test_history_order_and_identical_duplicates_do_not_change_result():
    rows = expenses()
    assert build_analysis(statement(), expense_history=rows)["data"] == build_analysis(statement(), expense_history=list(reversed(rows)) + [rows[0]])["data"]


@pytest.mark.parametrize("rows", [expenses() + [{**expenses()[0], "amount": "1"}],
    [{**row, "sme_id": "a" if i == 0 else "b"} for i, row in enumerate(expenses())],
    [{**expenses()[0], "amount": "-1"}], [{**expenses()[0], "category": " "}]])
def test_invalid_expense_history_is_rejected(rows):
    with pytest.raises(ValueError):
        build_analysis(statement(), expense_history=rows)
