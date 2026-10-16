"""Real upload route and per-request views used by the authorised import wiring."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def statement():
    return json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text())


def test_template_roundtrip_through_upload_matches_manual_calculation():
    template = client.get("/api/v1/analysis/template.xlsx")
    assert template.status_code == 200
    uploaded = client.post("/api/v1/upload?persist=false", files={
        "file": ("financial-template.xlsx", template.content,
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    })
    assert uploaded.status_code == 200
    body = uploaded.json()
    manual = client.post("/api/v1/calculate", json={"input": body["input"], "persist": False})
    assert manual.status_code == 200
    for field in ("data", "businessMetrics", "grading"):
        assert body[field] == manual.json()[field]
    assert body["source"] == "supplied_input"
    assert body["upload"]["fileStored"] is False
    assert body["persisted"] is False
    assert body["recordId"] is None
    assert body["grading"]["grade"] == "B"


def test_manual_validation_calculation_and_analysis_use_the_same_statement():
    validated = client.post("/api/v1/inputs/manual", json=statement())
    assert validated.status_code == 200
    payload = validated.json()["data"]
    calculated = client.post("/api/v1/calculate", json={"input": payload, "persist": False}).json()
    analyzed = client.post("/api/v1/analyze", json={"input": payload, "shop_name": "ร้านที่ผู้ใช้กรอก"})
    assert analyzed.status_code == 200
    body = analyzed.json()
    assert body["data"]["grading"] == calculated["grading"]
    assert body["views"]["overview"]["data"]["shopName"] == "ร้านที่ผู้ใช้กรอก"
    assert body["views"]["overview"]["data"]["revenue"] == 250000
    assert body["views"]["overview"]["data"]["netProfit"] == 50000
    assert body["views"]["overview"]["data"]["netProfitMargin"] == 20
    assert body["views"]["overview"]["data"]["cashBalance"] == 80000
    for view in body["views"].values():
        assert view["source"] == "supplied_input"
        assert view["inputHash"] == body["inputHash"]
        assert view["status"] == ("insufficient_data" if view["missing"] else "ok")
    assert body["views"]["overview"]["data"]["weeklyTrend"] == []
    assert "weekly_cash_movements" in body["views"]["overview"]["missing"]
    assert body["views"]["cost"]["data"]["investmentPlans"] == []
    assert "investment_cash_schedule" in body["views"]["cost"]["missing"]


def test_two_imports_do_not_change_each_others_views_or_the_shared_dashboard():
    before = client.get("/api/v1/overview").json()["data"]
    first = client.post("/api/v1/analyze", json={"input": statement()}).json()
    changed = {**statement(), "cash_balance": "54321"}
    second = client.post("/api/v1/analyze", json={"input": changed}).json()
    assert first["views"]["overview"]["data"]["cashBalance"] == 80000
    assert second["views"]["overview"]["data"]["cashBalance"] == 54321
    assert first["inputHash"] != second["inputHash"]
    assert client.get("/api/v1/overview").json()["data"] == before


def test_unprovided_optional_expenses_remain_unknown_in_analysis():
    payload = statement()
    del payload["interest_expense"]
    del payload["tax_expense"]
    body = client.post("/api/v1/analyze", json={"input": payload}).json()
    assert body["data"]["metrics"]["net_profit"]["value"] is None
    assert set(body["data"]["metrics"]["net_profit"]["missingFields"]) == {"interest_expense", "tax_expense"}
    assert body["status"] == "insufficient_data"


def test_manual_request_shapes_and_strict_units_are_not_silently_coerced():
    assert client.post("/api/v1/calculate", json=statement()).status_code == 422
    invalid_units = {**statement(), "units_sold": "2500"}
    assert client.post("/api/v1/inputs/manual", json=invalid_units).status_code == 422
    assert client.post("/api/v1/analyze", json={"input": {**statement(), "equity": "1"}}).status_code == 422
