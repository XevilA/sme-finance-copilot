"""Imported context is explicit, request-local, auditable and never a seed SME."""

import asyncio
import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.context import fingerprint
from app.db import DB_ENABLED
from app.main import app, origins

client = TestClient(app)
EXAMPLE = json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text(encoding="utf-8"))
MINIMAL = {k: EXAMPLE[k] for k in ("currency", "kind", "period_start", "period_end", "assets", "liabilities", "equity")}


@pytest.mark.parametrize("origin", [o.strip() for o in origins.split(",") if o.strip()])
def test_authorization_preflight_for_each_actual_configured_origin(origin):
    response = client.options("/api/v1/analyze", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_untrusted_origin_does_not_gain_authorization_cors():
    response = client.options("/api/v1/analyze", headers={
        "Origin": "https://synthetic-untrusted.invalid", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_unknown_cost_scalars_are_null_and_known_zeros_survive():
    body = client.post("/api/v1/analyze", json={"input": MINIMAL}).json()
    costs = body["views"]["cost"]
    for key in ("costPerUnit", "profitPerUnit", "breakevenUnits", "currentMonthlyFixedCost", "currentMonthlyVariableCost"):
        assert costs["data"][key] is None
    assert {"cost_per_unit", "contribution_per_unit", "breakeven_units", "fixed_costs", "variable_cost_per_unit"} <= set(costs["missing"])
    known = {**MINIMAL, "cost_of_goods_sold": "0", "operating_expenses": "0", "fixed_costs": "0", "units_sold": 10,
             "variable_cost_per_unit": "0", "unit_price": "10"}
    values = client.post("/api/analyze", json={"input": known}).json()["views"]["cost"]["data"]
    assert values["costPerUnit"] == 0
    assert values["currentMonthlyFixedCost"] == 0
    assert values["currentMonthlyVariableCost"] == 0
    assert values["breakevenUnits"] == 0


def test_analysis_and_views_share_revision_and_input_hash():
    payload = {"input": EXAMPLE, "input_revision": "synthetic-revision-1", "expected_input_hash": fingerprint(EXAMPLE)}
    # Normalization includes null defaults; use the actual normalized statement hash.
    first = client.post("/api/analyze", json={"input": EXAMPLE}).json()
    payload["expected_input_hash"] = first["inputHash"]
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["context"]["smeId"] is None
    assert body["context"]["projectId"] is None
    assert body["context"]["inputRevision"] == "synthetic-revision-1"
    for name in ("overview", "indicators", "cost", "explanation", "forecast"):
        assert body["views"][name]["context"] == body["context"]
        assert body["views"][name]["inputHash"] == body["inputHash"]
    changed = client.post("/api/analyze", json={"input": {**EXAMPLE, "cash_balance": "79000"}, "input_revision": "synthetic-revision-2"}).json()
    assert changed["inputHash"] != body["inputHash"]
    assert changed["contextHash"] != body["contextHash"]


@pytest.mark.parametrize("field,value", [("sme_id", "shop-1"), ("project_id", "invalid"), ("expected_input_hash", "0" * 64)])
def test_invalid_identity_or_stale_hash_is_rejected(field, value):
    assert client.post("/api/analyze", json={"input": MINIMAL, field: value}).status_code == 422


def test_forecast_preview_without_identity_has_no_invented_dated_events():
    response = client.post("/api/v1/forecast/preview", json={"input": EXAMPLE, "input_revision": "synthetic-1"})
    assert response.status_code == 200
    body = response.json()
    assert body["data"] is None
    assert body["missing"] == ["cash_forecast"]
    assert body["status"] == "insufficient_data"
    assert body["persisted"] is False
    assert body["context"]["smeId"] is None


@pytest.mark.parametrize("path", ["/analyze", "/calculate", "/forecast/preview", "/funding/evaluate"])
def test_coverage_before_selected_statement_is_a_validation_error(path):
    response = client.post("/api/v1" + path, json={"input": EXAMPLE, "schedule_complete_through": "2026-09-01"})
    assert response.status_code == 422
    assert "schedule_complete_through cannot precede" in response.text


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_unsupported_forecast_calendar_is_422_not_500():
    response = client.post("/api/forecast/preview", json={"input": {**EXAMPLE, "period_end": "9999-12-31"},
        "sme_id": "11111111-1111-4111-8111-111111111111"})
    assert response.status_code == 422
    assert response.json()["detail"] == "Forecast context has an invalid date range or schedule"


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_stored_view_rejects_coverage_before_its_statement():
    response = client.get("/api/overview", params={"sme_id": "11111111-1111-4111-8111-111111111111",
        "schedule_complete_through": "2026-09-01"})
    assert response.status_code == 422


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_imported_funding_does_not_use_unrelated_seed_grade_or_gap():
    response = client.post("/api/v1/funding/evaluate", json={"input": EXAMPLE, "amount": "45000", "input_revision": "synthetic-funding-1"})
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "supplied_input"
    assert body["context"]["smeId"] is None
    assert body["data"]["grade"] == "B"
    assert body["data"]["gradeScore"] == "75.00"
    assert body["data"]["requestedAmount"] == "45000"
    assert body["persisted"] is False
    assert body["data"]["funding"]
    assert body["data"]["options"]


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_missing_imported_amount_never_loads_seed_gap():
    body = client.post("/api/funding/evaluate", json={"input": MINIMAL}).json()
    assert body["data"]["requestedAmount"] is None
    assert body["data"]["funding"] == []
    assert body["missing"] == ["requested_amount"]
    zero = client.post("/api/funding/evaluate", json={"input": MINIMAL, "amount": "0"}).json()
    assert zero["data"]["notRequired"] is True
    assert zero["data"]["requestedAmount"] == "0"


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_selected_period_does_not_use_later_expense_observations():
    body = client.post("/api/analyze", json={"input": EXAMPLE, "sme_id": "22222222-2222-4222-8222-222222222222"}).json()
    comparison = body["data"]["expenseComparison"]
    assert "2026-10" not in json.dumps(comparison)
    assert body["context"]["periodEnd"] == EXAMPLE["period_end"]
    assert not any(f["id"].startswith("unusual_expense_") for f in body["data"]["findings"])


def test_unsupported_transactions_are_explicit_capabilities():
    body = client.get("/api/v1/capabilities").json()
    for name in ("fundingApplication", "agreementSignature", "funderInfoRequest", "reportExport", "resourceReservation"):
        assert body["data"][name]["available"] is False
        assert body["data"][name]["reason"]
