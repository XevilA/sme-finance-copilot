"""Swarm allocation and /api/calculate routing. No database required."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def financial_payload():
    return json.loads((Path(__file__).parents[1] / "examples/manual_input.json").read_text())


def order(**overrides):
    body = {
        "order_ref": "PO-TEST-001",
        "buyer_name": "Siam Retail Group",
        "target_capacity": "1000",
        "unit_price": "100.00",
        "duration_days": 30,
        "payment_terms_days": 30,
        "deposit_ratio": "0",
        "persist": False,
        "shops": [
            {
                "shop_id": "shop-a",
                "name": "Shop A",
                "capacity_total": "600",
                "capacity_used": "100",
                "cost_per_unit": "60.00",
                "cash_balance": "5000000.00",
                "minimum_cash_reserve": "0.00",
            },
            {
                "shop_id": "shop-b",
                "name": "Shop B",
                "capacity_total": "400",
                "capacity_used": "0",
                "cost_per_unit": "70.00",
                "cash_balance": "0.00",
                "minimum_cash_reserve": "0.00",
            },
        ],
    }
    body.update(overrides)
    return body


def test_allocates_cheapest_capacity_first():
    data = client.post("/api/swarm", json=order()).json()["data"]
    shares = {shop["shopId"]: shop["shareBoxesPerDay"] for shop in data["shops"]}
    # Shop A is cheaper, so its 500 free boxes are taken before Shop B's 400.
    assert shares == {"shop-a": 500.0, "shop-b": 400.0}
    assert data["deficitBoxesPerDay"] == 100.0
    assert data["status"] == "incomplete"


def test_working_capital_and_funding_gap_math():
    data = client.post("/api/swarm", json=order()).json()["data"]
    shops = {shop["shopId"]: shop for shop in data["shops"]}
    # 400 boxes * 70 THB * (30 produce + 30 payment terms) days
    assert shops["shop-b"]["workingCapitalNeeded"] == 1680000.0
    # Shop B holds no cash, so the whole need is a gap.
    assert shops["shop-b"]["fundingGap"] == 1680000.0
    assert shops["shop-b"]["status"] == "blocked"
    # Shop A: 500 * 60 * 60 = 1,800,000 against 5,000,000 usable cash.
    assert shops["shop-a"]["fundingGap"] == 0.0
    assert shops["shop-a"]["status"] == "ready"
    assert data["totalFundingGap"] == 1680000.0


def test_revenue_cost_and_profit_totals():
    data = client.post("/api/swarm", json=order()).json()["data"]
    # 900 boxes/day assigned over 30 days at 100 THB.
    assert data["totalRevenue"] == 2700000.0
    assert data["totalCost"] == 500 * 30 * 60 + 400 * 30 * 70
    assert data["totalProfit"] == data["totalRevenue"] - data["totalCost"]


def test_deposit_closes_the_funding_gap():
    body = order(target_capacity="400", deposit_ratio="0.5", shops=[order()["shops"][1]])
    data = client.post("/api/swarm", json=body).json()["data"]
    # Deposit of 50% on 1,200,000 revenue covers less than the 1,680,000 need.
    shop = data["shops"][0]
    assert shop["fundingGap"] == 1680000.0 - 600000.0
    assert data["status"] == "has_issues"


def test_ready_when_capacity_and_cash_both_suffice():
    body = order(target_capacity="500", shops=[order()["shops"][0]])
    data = client.post("/api/swarm", json=body).json()["data"]
    assert data["status"] == "ready"
    assert data["stuckReasons"] == []
    assert data["deficitBoxesPerDay"] == 0.0


def test_allocation_is_deterministic_regardless_of_shop_order():
    forward = order()
    reversed_shops = order(shops=list(reversed(forward["shops"])))
    first = client.post("/api/swarm", json=forward).json()["data"]
    second = client.post("/api/swarm", json=reversed_shops).json()["data"]
    assert first == second


def test_swarm_requires_shops_or_sme_ids():
    assert client.post("/api/swarm", json=order(shops=[])).status_code == 422


def test_stuck_reasons_name_the_blocked_shop():
    data = client.post("/api/swarm", json=order()).json()["data"]
    kinds = {reason["type"] for reason in data["stuckReasons"]}
    assert kinds == {"funding", "capacity"}
    funding = next(reason for reason in data["stuckReasons"] if reason["type"] == "funding")
    assert funding["shopId"] == "shop-b"


def test_v1_alias_serves_the_same_route():
    assert client.post("/api/v1/swarm", json=order()).status_code == 200


def test_calculate_runs_the_finance_engine_without_a_database():
    response = client.post("/api/calculate", json={"input": financial_payload(), "persist": False})
    assert response.status_code == 200
    body = response.json()
    assert body["persisted"] is False
    assert body["recordId"] is None
    assert body["data"]["fcf"]["value"] == "50000.00"
    assert body["data"]["liquidity"]["value"] == "2.0000"


def test_calculate_rejects_an_unbalanced_balance_sheet():
    payload = financial_payload()
    payload["equity"] = "1.00"
    assert client.post("/api/calculate", json={"input": payload}).status_code == 422
