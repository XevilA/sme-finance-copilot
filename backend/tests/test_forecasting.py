from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.forecasting import forecast_cashflow, project_cash_events

AS_OF = date(2026, 9, 30)
COMPLETE = date(2026, 12, 29)
SME = "11111111-1111-4111-8111-111111111111"


def events():
    return [{"id": str(index), "date": day, "amount": amount, "isInflow": incoming, "status": "projected"}
            for index, (day, amount, incoming) in enumerate([
                ("2026-10-01", "600000", True), ("2026-10-02", "900000", False),
                ("2026-10-10", "450000", False), ("2026-10-15", "850000", False),
                ("2026-10-25", "30000", False), ("2026-10-31", "0", False),
                ("2026-11-30", "2400000", True),
            ])]


def forecast(rows=None, **updates):
    options = {"as_of": AS_OF, "opening_cash": Decimal(5000000), "minimum_cash_reserve": Decimal(50000),
               "schedule_complete_through": COMPLETE, **updates}
    return forecast_cashflow(events() if rows is None else rows, **options)


def test_demo_cash_reconciles_to_5770000_with_actual_30_60_90_boundaries():
    result = forecast()
    assert result["status"] == "ok"
    assert result["minimum_cash"] == "3370000.00"
    assert result["minimum_cash_date"] == "2026-10-25"
    assert result["first_shortfall_date"] is None
    assert result["period_end_balances"] == {"30": "3370000.00", "60": "3370000.00", "90": "5770000.00"}
    assert len(result["timeline"]) == 7
    assert result["missing"] == []


@pytest.mark.parametrize("rows", [None, []])
def test_missing_schedule_is_not_a_zero_forecast(rows):
    result = forecast_cashflow(rows, opening_cash=Decimal(5000000), as_of=AS_OF)
    assert result["status"] == "insufficient_data"
    assert result["minimum_cash"] is None
    assert result["period_end_balances"] == {"30": None, "60": None, "90": None}
    assert "cash_events" in result["missing"]


def test_explicitly_confirmed_empty_schedule_preserves_known_opening_cash():
    result = forecast([])
    assert result["status"] == "ok"
    assert result["period_end_balances"]["90"] == "5000000.00"


def test_unconfirmed_horizons_are_null_with_conditional_results_kept_separate():
    result = forecast(schedule_complete_through=None)
    assert result["minimum_cash"] is None
    assert result["conditional_minimum_cash"] == "3370000.00"
    assert result["period_end_balances"]["90"] is None
    assert result["conditional_period_end_balances"]["90"] == "5770000.00"
    assert "schedule_complete_through" in result["missing"]
    partial = forecast(schedule_complete_through=date(2026, 11, 1))
    assert partial["period_end_balances"] == {"30": "3370000.00", "60": None, "90": None}


def test_shortfall_and_negative_cash_dates_and_unknown_reserve_are_distinct():
    result = forecast(opening_cash=Decimal(350000))
    assert result["first_shortfall_date"] == "2026-10-10"
    assert result["first_negative_date"] == "2026-10-10"
    reserve = forecast(opening_cash=Decimal(50000), minimum_cash_reserve=Decimal(100000))
    assert reserve["first_shortfall_date"] == AS_OF.isoformat()
    assert reserve["first_negative_date"] == "2026-10-02"
    no_reserve = forecast(minimum_cash_reserve=None)
    assert no_reserve["minimum_cash_reserve"] is None
    assert no_reserve["first_reserve_breach_date"] is None


def test_same_day_cash_is_netted_and_source_order_does_not_change_result():
    rows = [{"id": "out", "date": "2026-10-01", "amount": "6000000", "isInflow": False, "status": "confirmed"},
            {"id": "in", "date": "2026-10-01", "amount": "6000000", "isInflow": True, "status": "confirmed"}]
    result = forecast(rows)
    assert result == forecast(list(reversed(rows)))
    assert result["minimum_cash"] == "5000000.00"
    assert result["first_negative_date"] is None


def test_as_of_and_old_events_are_not_applied_to_snapshot_again():
    rows = [{"id": "old", "date": AS_OF.isoformat(), "amount": "100000000", "isInflow": False, "status": "confirmed"}, *events()]
    assert forecast(rows)["period_end_balances"] == forecast()["period_end_balances"]


def test_duplicate_identical_events_are_deduplicated_but_conflicts_are_rejected():
    rows = events()
    assert forecast([*rows, rows[0]]) == forecast(rows)
    with pytest.raises(ValueError, match="Conflicting duplicate"):
        forecast([*rows, {**rows[0], "amount": "1"}])


@pytest.mark.parametrize("change", [{"amount": "NaN"}, {"amount": -1}, {"isInflow": "false"}, {"status": "cancelled"}])
def test_invalid_source_events(change):
    with pytest.raises((ValueError, ValidationError)):
        forecast([{**events()[0], **change}])


def test_unknown_opening_cash_and_mixed_smes_are_rejected_or_declared():
    result = forecast(opening_cash=None)
    assert result["minimum_cash"] is None
    assert "opening_cash" in result["missing"]
    with pytest.raises(ValueError, match="different SMEs"):
        forecast([{**events()[0], "sme_id": "one"}, {**events()[1], "sme_id": "two"}])


def test_simulated_events_require_explicit_scenario_mode():
    simulated = {"id": "scenario", "date": "2026-10-03", "amount": "100", "isInflow": False, "status": "simulated"}
    assert forecast([*events(), simulated])["period_end_balances"] == forecast()["period_end_balances"]
    included = forecast([*events(), simulated], include_simulated=True)
    assert included["kind"] == "simulated"
    assert included["period_end_balances"]["90"] == "5769900.00"


def obligation(**updates):
    return {"id": "invoice-1", "due_date": "2026-10-01", "amount": "1000", "title": "Invoice", **updates}


def generated(**updates):
    return project_cash_events(as_of=AS_OF, sme_id=SME, receivables=[obligation()], payables=[], operating_costs=[], installments=[], **updates)


def test_generation_is_dated_projected_and_uses_stable_uuid_for_upsert():
    result = generated()
    row = result["events"][0]
    assert UUID(row["id"]).version == 5
    assert row["event_date"] == "2026-10-01"
    assert row["day_index"] == 1
    assert row["amount"] == "1000.00"
    assert row["is_inflow"] is True
    assert row["status"] == "projected"
    corrected = project_cash_events(as_of=AS_OF, sme_id=SME, receivables=[obligation(due_date="2026-10-05", amount="2000")],
                                    payables=[], operating_costs=[], installments=[])
    assert corrected["events"][0]["id"] == row["id"]
    forecasted = forecast(result["events"])
    assert forecasted["period_end_balances"]["90"] == "5001000.00"


def test_overdue_or_unknown_obligations_are_declared_not_rescheduled_silently():
    result = project_cash_events(as_of=AS_OF, sme_id=SME, receivables=[obligation(due_date=AS_OF.isoformat())])
    assert result["events"] == []
    assert "payables" in result["missing"]
    assert "rescheduled_due_date:receivables:invoice-1" in result["missing"]


def test_outflow_categories_and_duplicate_source_id_validation():
    result = project_cash_events(as_of=AS_OF, sme_id=SME, receivables=[], payables=[obligation()],
                                 operating_costs=[obligation()], installments=[obligation()])
    assert len({row["id"] for row in result["events"]}) == 3
    assert all(row["is_inflow"] is False for row in result["events"])
    with pytest.raises(ValueError, match="Duplicate obligation"):
        project_cash_events(as_of=AS_OF, sme_id=SME, receivables=[obligation(), obligation()])
