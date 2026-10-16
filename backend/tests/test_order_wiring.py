"""The four visible controls must recompute finite order economics, not demo math."""

import asyncio
import copy
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import DB_ENABLED, session_scope
from app.main import app
from app.models import Simulation

client = TestClient(app)


def request():
    return {"baseline": {
        "order_ref": "synthetic-wiring", "buyer_name": "Synthetic buyer",
        "target_capacity": "10", "unit_price": "100", "duration_days": 2,
        "payment_terms_days": 5, "deposit_ratio": "0", "production_start": "2026-10-16",
        "shops": [{"shop_id": "synthetic-a", "name": "Synthetic A", "capacity_total": "10",
                   "cost_per_unit": "60", "cash_balance": "100", "minimum_cash_reserve": "20",
                   "resources": []}],
    }, "scenario": {"unit_price": "100", "cost_per_unit": None,
                     "deposit_ratio": "0", "payment_terms_days": 5}, "persist": False}


def test_order_baseline_is_exact_and_does_not_mix_business_profit_or_cash():
    body = client.post("/api/v1/simulate/order", json=request()).json()
    assert body["source"] == "supplied_input"
    assert body["data"]["scope"] == "order_only"
    for plan in (body["data"]["planA"], body["data"]["planB"]):
        assert plan["totalRevenue"] == 2000
        assert plan["totalCost"] == 1200
        assert plan["totalProfit"] == 800
        assert plan["totalFundingGap"] == 1120
        assert plan["minimumShopCash"] == "-1100.00"
    assert body["persisted"] is False
    assert body["simulationId"] is None


def test_all_four_order_controls_reach_the_engine_and_leave_baseline_unchanged():
    payload = request()
    payload["scenario"] = {"unit_price": "120", "cost_per_unit": "50", "deposit_ratio": "0.5", "payment_terms_days": 10}
    original = copy.deepcopy(payload)
    body = client.post("/api/simulate/order", json=payload).json()
    assert payload == original
    assert body["data"]["planA"]["totalProfit"] == 800
    assert body["data"]["planB"]["totalRevenue"] == 2400
    assert body["data"]["planB"]["totalCost"] == 1000
    assert body["data"]["planB"]["totalProfit"] == 1400
    assert body["data"]["planB"]["totalFundingGap"] == 0
    assert body["data"]["planB"]["minimumShopCash"] == "100.00"
    assert body["data"]["auditB"]["cashCycleDays"] == 12
    assert body["data"]["scenario"]["payment_terms_days"] == 10


def test_ineligible_shops_remain_excluded_in_both_order_plans():
    payload = request()
    payload["baseline"]["shops"][0]["resources"] = [{
        "resource_id": "truck", "title": "Truck", "category": "logistics", "status": "pending",
        "available": True, "required": True,
    }]
    body = client.post("/api/v1/simulate/order", json=payload).json()
    assert body["data"]["planB"]["shops"] == []
    assert body["data"]["planB"]["minimumShopCash"] is None
    assert body["data"]["planB"]["deficitBoxesPerDay"] == 10
    assert body["missing"] == ["assigned_shops"]
    assert body["status"] == "insufficient_data"


@pytest.mark.parametrize("key,value", [("payment_terms_days", "10"), ("payment_terms_days", 366), ("deposit_ratio", "1.1"), ("cost_per_unit", "-1")])
def test_order_controls_reject_invalid_inputs(key, value):
    payload = request()
    payload["scenario"][key] = value
    assert client.post("/api/v1/simulate/order", json=payload).status_code == 422


def test_context_gaps_cannot_be_promoted_to_complete_simulation():
    payload = request()
    payload["context_missing"] = ["buyer_coordinates", "required_business_types"]
    body = client.post("/api/v1/simulate/order", json=payload).json()
    assert body["missing"] == ["buyer_coordinates", "required_business_types"]
    assert body["status"] == "insufficient_data"


def test_scenario_date_overflow_is_a_validation_error_instead_of_server_error():
    payload = request()
    payload["baseline"].update(production_start="9999-12-30", duration_days=1, payment_terms_days=0)
    payload["scenario"]["payment_terms_days"] = 2
    response = client.post("/api/v1/simulate/order", json=payload)
    assert response.status_code == 422
    assert "Cash schedule dates" in response.json()["detail"][0]["msg"]


def test_one_shops_cash_surplus_does_not_erase_another_shops_shortfall():
    payload = request()
    other = {**payload["baseline"]["shops"][0], "shop_id": "synthetic-b", "cash_balance": "10000"}
    payload["baseline"]["shops"].append(other)
    payload["baseline"]["target_capacity"] = "20"
    body = client.post("/api/v1/simulate/order", json=payload).json()["data"]["planB"]
    assert body["totalCapacityAssigned"] == 20
    assert body["totalFundingGap"] == 1120
    assert body["minimumShopCash"] == "-1100.00"


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_context_has_machine_fields_and_save_is_readable_with_full_replay_input():
    context = client.get("/api/v1/simulator/context")
    assert context.status_code == 200
    body = context.json()
    assert body["source"] == "database"
    assert body["status"] == "insufficient_data"
    assert "buyer_coordinates" in body["missing"]
    assert isinstance(body["data"]["deposit_ratio"], str)
    assert isinstance(body["data"]["payment_terms_days"], int)
    assert client.get(f"/api/v1/swarm/{body['data']['order_ref']}").json()["source"] == "database"
    payload = request()
    payload["persist"] = True
    saved = client.post("/api/v1/simulate/order", json=payload).json()
    assert saved["persisted"] is True

    async def read_back():
        async with session_scope() as session:
            row = await session.scalar(select(Simulation).where(Simulation.id == uuid.UUID(saved["simulationId"])))
            assert row.params["baseline"]["order_ref"] == "synthetic-wiring"
            assert row.params["scenario"]["payment_terms_days"] == 5
            assert row.results == saved["data"]
            await session.delete(row)
    asyncio.run(read_back())


def test_overview_unknowns_are_null_instead_of_zero():
    minimal = {"currency": "THB", "kind": "simulated", "period_start": "2026-10-01", "period_end": "2026-10-31",
               "assets": "100", "liabilities": "20", "equity": "80"}
    body = client.post("/api/v1/analyze", json={"input": minimal}).json()["views"]["overview"]
    for key in ("revenue", "expense", "netProfit", "cashBalance", "usableCashAfterReserve", "reserveThreshold", "netProfitMargin"):
        assert body["data"][key] is None
    assert set(body["data"]["lastPeriodDiff"].values()) == {None}
    assert body["kind"] == "simulated"
    assert body["status"] == "insufficient_data"
    assert {"cash_balance", "minimum_cash_reserve", "net_profit_margin", "previous_period_statement"} <= set(body["missing"])
