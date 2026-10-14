"""What-If simulator and upload ingestion. No database required."""

import json
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.main import app

client = TestClient(app)


def payload():
    return json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text())


def workbook(data):
    book = Workbook()
    book.active.title = "Financials"
    book.active.append(["field", "value"])
    for key, value in data.items():
        if isinstance(value, dict):
            for subkey, subvalue in value.items():
                book.active.append([f"{key}.{subkey}", subvalue])
        else:
            book.active.append([key, value])
    stream = BytesIO()
    book.save(stream)
    book.close()
    return stream.getvalue()


def order():
    return {
        "order_ref": "PO-SIM-001",
        "buyer_name": "Siam Retail Group",
        "target_capacity": "900",
        "unit_price": "100.00",
        "duration_days": 30,
        "payment_terms_days": 30,
        "deposit_ratio": "0",
        "shops": [
            {
                "shop_id": "shop-a", "name": "Shop A", "capacity_total": "600", "capacity_used": "100",
                "cost_per_unit": "60.00", "cash_balance": "5000000.00", "minimum_cash_reserve": "0.00",
            },
            {
                "shop_id": "shop-b", "name": "Shop B", "capacity_total": "400", "capacity_used": "0",
                "cost_per_unit": "70.00", "cash_balance": "5000000.00", "minimum_cash_reserve": "0.00",
            },
        ],
    }


def simulate(scenario, **extra):
    body = {"input": payload(), "scenario": scenario, "persist": False}
    body.update(extra)
    return client.post("/api/simulate", json=body)


def test_baseline_scenario_changes_nothing():
    body = simulate({"label": "no-op"}).json()
    assert body["data"]["delta"]["summary"]["verdict"] == "unchanged"
    assert body["data"]["delta"]["summary"]["improved"] == []
    assert body["data"]["delta"]["summary"]["worsened"] == []


def test_plan_b_is_marked_simulated():
    body = simulate({"label": "Plan B"}).json()
    assert body["data"]["planA"]["input"]["kind"] == "simulated"  # the example input is already simulated
    assert body["data"]["planB"]["input"]["kind"] == "simulated"
    assert body["kind"] == "simulated"


def test_revenue_drop_cuts_profit_and_grade():
    body = simulate({"label": "sales -20%", "revenue_change_pct": "-0.2"}).json()
    delta = body["data"]["delta"]
    net = delta["businessMetrics"]["net_profit"]
    assert net["direction"] == "down"
    assert "net_profit" in delta["summary"]["worsened"]
    # The profit delta must reach DSCR, or 35% of the grade would never move.
    assert delta["metrics"]["dscr"]["direction"] == "down"
    # score is a decimal string in the payload; compare it as a number.
    assert float(delta["grading"]["planB"]["score"]) < float(delta["grading"]["planA"]["score"])
    assert float(delta["grading"]["scoreChange"]) < 0
    assert "grade_score" in delta["summary"]["worsened"]


def test_revenue_rise_lifts_profit_and_grade():
    body = simulate({"label": "sales +20%", "revenue_change_pct": "0.2"}).json()
    delta = body["data"]["delta"]
    assert delta["businessMetrics"]["net_profit"]["direction"] == "up"
    assert delta["metrics"]["dscr"]["direction"] == "up"
    assert delta["summary"]["verdict"] in {"better", "mixed"}


def test_blanket_cost_shock_raises_total_cost():
    body = simulate({"label": "costs +10%", "cost_change_pct": "0.1"}).json()
    delta = body["data"]["delta"]
    assert delta["businessMetrics"]["total_cost"]["direction"] == "up"
    # total_cost is in LOWER_IS_BETTER, so a rise counts as worse.
    assert "total_cost" in delta["summary"]["worsened"]
    assert any("cost_change_pct scales" in note for note in body["data"]["assumptions"])


def test_specific_lever_overrides_the_blanket_shock():
    both = simulate({"cost_change_pct": "0.5", "cogs_change_pct": "0"}).json()
    cogs = both["data"]["planB"]["input"]["cost_of_goods_sold"]
    assert cogs == payload()["cost_of_goods_sold"]
    opex = both["data"]["planB"]["input"]["operating_expenses"]
    assert opex != payload()["operating_expenses"]


def test_collection_delay_removes_cash_for_the_period():
    body = simulate({"label": "paid 30 days late", "collection_delay_days": 30}).json()
    assert body["data"]["delta"]["metrics"]["net_cash_flow"]["direction"] == "down"
    assert any("collection_delay_days defers" in note for note in body["data"]["assumptions"])


def test_extra_funding_keeps_the_balance_sheet_valid():
    body = simulate({"label": "draw 500k", "extra_funding": "500000.00"})
    assert body.status_code == 200
    plan_b = body.json()["data"]["planB"]["input"]
    base = payload()
    assert float(plan_b["assets"]) == float(base["assets"]) + 500000
    assert float(plan_b["liabilities"]) == float(base["liabilities"]) + 500000
    # assets - liabilities - equity must still balance, or validation would have failed.
    assert float(plan_b["equity"]) == float(base["equity"])


def test_dropping_the_loan_removes_the_installment():
    body = simulate({"label": "no loan", "drop_loan": True}).json()
    assert body["data"]["planB"]["input"]["loan"] is None
    assert body["data"]["planB"]["metrics"]["pmt"]["status"] == "insufficient_data"


def test_replacing_loan_terms_changes_pmt():
    cheaper = {"principal": "120000.00", "annual_interest_rate": "0.05", "periods": 12,
               "payments_per_year": 12, "timing": "end"}
    body = simulate({"label": "cheaper loan", "loan": cheaper}).json()
    assert body["data"]["delta"]["metrics"]["pmt"]["direction"] == "down"


def test_removing_a_shop_opens_a_capacity_deficit():
    body = simulate({"label": "Shop B leaves", "remove_shops": ["shop-b"]}, swarm=order()).json()
    swarm = body["data"]["delta"]["swarm"]
    assert swarm["status"]["planA"] == "ready"
    assert swarm["status"]["planB"] == "incomplete"
    assert swarm["deficitBoxesPerDay"]["planB"] == 400.0
    assert swarm["shopsAssigned"]["planB"] == 1.0
    assert "swarm.deficitBoxesPerDay" in body["data"]["delta"]["summary"]["worsened"]


def test_adding_a_shop_closes_the_deficit():
    scenario = {
        "label": "swap in Shop C",
        "remove_shops": ["shop-b"],
        "add_shops": [{
            "shop_id": "shop-c", "name": "Shop C", "capacity_total": "500", "capacity_used": "0",
            "cost_per_unit": "65.00", "cash_balance": "5000000.00", "minimum_cash_reserve": "0.00",
        }],
    }
    body = simulate(scenario, swarm=order()).json()
    swarm = body["data"]["delta"]["swarm"]
    assert swarm["status"]["planB"] == "ready"
    assert swarm["deficitBoxesPerDay"]["planB"] == 0.0


def test_simulation_is_deterministic():
    scenario = {"label": "sales -15%", "revenue_change_pct": "-0.15", "cost_change_pct": "0.05"}
    first = simulate(scenario).json()["data"]["delta"]
    second = simulate(scenario).json()["data"]["delta"]
    assert first == second


def test_unknown_scenario_lever_is_rejected():
    assert simulate({"label": "typo", "revenue_change": "-0.2"}).status_code == 422


def test_scenario_that_breaks_the_input_contract_returns_422():
    # -100% revenue with a cost rise drives profit, and therefore cash, far
    # negative; cash is floored, but a loan principal of zero is still invalid.
    response = simulate({"label": "broken", "loan": {
        "principal": "0.00", "annual_interest_rate": "0.1", "periods": 0,
        "payments_per_year": 12, "timing": "end"}})
    assert response.status_code == 422


def test_v1_alias_serves_simulate():
    body = {"input": payload(), "scenario": {"label": "alias"}, "persist": False}
    assert client.post("/api/v1/simulate", json=body).status_code == 200


def test_upload_parses_a_workbook_and_grades_it():
    data = payload()
    response = client.post("/api/upload", files={"file": ("statement.xlsx", workbook(data))})
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["fcf"]["value"] == "50000.00"
    assert body["grading"]["grade"] in {"A", "B", "C", "D"}
    assert body["input"]["currency"] == "THB"


def test_upload_reports_the_file_without_storing_it():
    content = workbook(payload())
    body = client.post("/api/upload", files={"file": ("statement.xlsx", content)}).json()
    assert body["upload"]["byteSize"] == len(content)
    assert len(body["upload"]["contentSha256"]) == 64
    assert body["upload"]["fileStored"] is False


def test_upload_rejects_a_file_that_is_not_a_workbook():
    response = client.post("/api/upload", files={"file": ("notes.txt", b"not a workbook")})
    assert response.status_code == 422


def test_upload_rejects_an_unbalanced_statement():
    data = payload()
    data["equity"] = "1.00"
    response = client.post("/api/upload", files={"file": ("bad.xlsx", workbook(data))})
    assert response.status_code == 422
