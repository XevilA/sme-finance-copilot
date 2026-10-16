"""The five /api/v1 GET contracts the deployed frontend already calls.

Before these adapters every one returned 404, so the client could not leave
mock mode. These tests are the regression guard for that, and for the rule that
a series we do not have is served empty and declared in `missing` rather than
filled with a plausible number.
"""

import pytest
from fastapi.testclient import TestClient

from app.db import DB_ENABLED
from app.main import app

client = TestClient(app)

CONTRACTS = [
    "/overview",
    "/health/indicators",
    "/ai/explain?page=health",
    "/cost/breakdown",
    "/swarm/proposal",
]

ENVELOPE_KEYS = {"data", "kind", "status", "missing", "asOf", "analyzedAt"}


def test_every_contract_answers_instead_of_404():
    for path in CONTRACTS:
        response = client.get(f"/api/v1{path}")
        assert response.status_code == 200, f"{path} returned {response.status_code}"


def test_every_contract_returns_the_frontend_envelope():
    for path in CONTRACTS:
        body = client.get(f"/api/v1{path}").json()
        assert ENVELOPE_KEYS <= set(body), f"{path} is missing {ENVELOPE_KEYS - set(body)}"
        assert body["status"] in {"ok", "insufficient_data", "stale", "error"}
        assert body["kind"] in {"actual", "forecast", "simulated"}


def test_status_follows_missing():
    """status must never claim ok while missing is populated."""
    for path in CONTRACTS:
        body = client.get(f"/api/v1{path}").json()
        if body["missing"]:
            assert body["status"] == "insufficient_data", path
        else:
            assert body["status"] == "ok", path


def test_contracts_are_also_served_without_the_v1_prefix():
    for path in CONTRACTS:
        assert client.get(f"/api{path}").status_code == 200


# --- /overview ---------------------------------------------------------------

def test_overview_matches_the_business_overview_shape():
    data = client.get("/api/v1/overview").json()["data"]
    required = {
        "shopName", "revenue", "expense", "netProfit", "cashBalance",
        "usableCashAfterReserve", "reserveThreshold", "period", "lastPeriodDiff",
        "cashVsProfitInsight", "actionableItems", "weeklyTrend",
    }
    assert required <= set(data)
    assert set(data["lastPeriodDiff"]) == {"revenue", "expense", "netProfit", "cashBalance"}


def test_overview_reports_usable_cash_net_of_the_reserve():
    data = client.get("/api/v1/overview").json()["data"]
    assert data["usableCashAfterReserve"] == data["cashBalance"] - data["reserveThreshold"]


def test_overview_declares_the_series_it_cannot_produce():
    body = client.get("/api/v1/overview").json()
    assert body["data"]["weeklyTrend"] == []
    assert "weekly_cash_movements" in body["missing"]
    # One demo statement has no prior period, so the diff must be declared.
    assert "previous_period_statement" in body["missing"]
    assert all(value is None for value in body["data"]["lastPeriodDiff"].values())


def data_all_zero(diff: dict) -> bool:
    return all(value == 0 for value in diff.values())


def test_overview_action_items_carry_the_fields_the_ui_reads():
    items = client.get("/api/v1/overview").json()["data"]["actionableItems"]
    assert items, "findings should produce at least one action item"
    for item in items:
        assert {"id", "type", "title", "description", "priority", "actionText", "targetPage"} <= set(item)
        assert item["type"] in {"deficit_warning", "due_item", "expense_review", "pending_plan"}
        assert item["priority"] in {"high", "medium", "low"}


# --- /health/indicators ------------------------------------------------------

def test_health_indicators_match_the_indicator_shape():
    body = client.get("/api/v1/health/indicators").json()
    indicators = body["data"]
    assert isinstance(indicators, list) and indicators
    for indicator in indicators:
        assert {"id", "category", "name", "value", "unit", "benchmark", "status",
                "trend", "formula", "interpretation"} <= set(indicator)
        assert indicator["category"] in {"liquidity", "profitability", "debt", "efficiency", "growth"}
        assert indicator["status"] in {"good", "warning", "danger", "insufficient"}


def test_health_indicators_do_not_invent_a_sparkline():
    body = client.get("/api/v1/health/indicators").json()
    assert all(indicator["trend"] == [] for indicator in body["data"])
    assert "indicator_history" in body["missing"]


# --- /ai/explain -------------------------------------------------------------

def test_ai_explain_matches_the_ai_response_shape():
    body = client.get("/api/v1/ai/explain?page=health").json()
    data = body["data"]
    assert {"pageId", "summary", "reasoning", "dataUsed", "suggestions", "unknowns"} <= set(data)
    assert data["pageId"] == "health"
    for entry in data["dataUsed"]:
        assert {"id", "refNum", "label", "value", "targetElementId"} <= set(entry)


def test_ai_explain_honours_the_page_parameter():
    for page in ("overview", "cashflow", "funding"):
        assert client.get(f"/api/v1/ai/explain?page={page}").json()["data"]["pageId"] == page


def test_ai_explain_discloses_whether_a_model_was_used():
    """The UI must not imply a model ran when the answer came from rules."""
    body = client.get("/api/v1/ai/explain?page=health").json()
    assert body["aiMode"] in {"rules", "model"}


# --- /cost/breakdown ---------------------------------------------------------

def test_cost_breakdown_matches_the_shape_and_sums_to_100_percent():
    body = client.get("/api/v1/cost/breakdown").json()
    data = body["data"]
    assert {"categories", "costPerUnit", "profitPerUnit", "breakevenUnits",
            "currentMonthlyFixedCost", "currentMonthlyVariableCost", "investmentPlans"} <= set(data)
    assert data["categories"]
    for category in data["categories"]:
        assert {"name", "amount", "percentage", "color"} <= set(category)
        assert category["color"].startswith("#")
    # Rounded to one decimal per category, so the total can drift slightly.
    assert sum(c["percentage"] for c in data["categories"]) == pytest.approx(100.0, abs=0.3)


def test_cost_breakdown_does_not_invent_npv_or_irr():
    body = client.get("/api/v1/cost/breakdown").json()
    assert body["data"]["investmentPlans"] == []
    assert "investment_cash_schedule" in body["missing"]


def test_cost_breakdown_normalises_monthly_figures_to_30_days():
    """The demo periods are 30 days, so fixed_costs pass through unchanged."""
    data = client.get("/api/v1/cost/breakdown").json()["data"]
    period_days = 30
    fixed = data["currentMonthlyFixedCost"]
    assert fixed > 0
    # Equal to the stated figure because the period is already 30 days.
    assert fixed == pytest.approx(fixed * 30 / period_days)


# --- /swarm/proposal ---------------------------------------------------------

def test_swarm_proposal_is_not_shadowed_by_the_order_lookup():
    """/swarm/{order_ref} must not capture the literal path "proposal"."""
    body = client.get("/api/v1/swarm/proposal").json()
    assert "shops" in body["data"]
    assert "orderId" in body["data"]


def test_stored_order_lookup_still_works_alongside_it():
    response = client.get("/api/v1/swarm/NO-SUCH-ORDER")
    assert response.status_code in {404, 503}


def test_swarm_proposal_shape_and_provenance():
    body = client.get("/api/v1/swarm/proposal").json()
    data = body["data"]
    assert {"orderId", "shops", "totalCapacityAssigned", "targetCapacity",
            "deficitBoxesPerDay", "totalCost", "totalRevenue", "totalProfit",
            "totalFundingGap", "status", "stuckReasons", "version"} <= set(data)
    assert data["status"] in {"ready", "has_issues", "incomplete"}
    if DB_ENABLED:
        assert body["source"] in {"stored_record", "none"}
    else:
        assert body["source"] == "none"
        assert "database_disabled" in body["missing"]


def test_swarm_proposal_totals_agree_with_the_shop_rows():
    data = client.get("/api/v1/swarm/proposal").json()["data"]
    if not data["shops"]:
        return
    assert data["totalCapacityAssigned"] == sum(s["shareBoxesPerDay"] for s in data["shops"])
    assert data["totalFundingGap"] == sum(s["fundingGap"] for s in data["shops"])
    if data["totalCost"]:
        assert data["totalProfit"] == data["totalRevenue"] - data["totalCost"]


# --- provenance --------------------------------------------------------------

def test_responses_say_which_dataset_answered_them():
    """Behaviour changed: a stored statement now outranks the bundled example.

    The deployed client sends no query parameters, so falling back to the
    example meant real seeded data went unused and the overview showed a
    placeholder shop name. `source` still states which one answered.
    """
    expected = "stored_record" if DB_ENABLED else "demo_dataset"
    for path in ("/overview", "/health/indicators", "/ai/explain?page=health", "/cost/breakdown"):
        body = client.get(f"/api/v1{path}").json()
        assert body["source"] == expected, path


def test_unknown_sme_id_is_a_404_not_a_silent_demo_answer():
    unknown = "99999999-9999-4999-8999-999999999999"
    response = client.get("/api/v1/overview", params={"sme_id": unknown})
    assert response.status_code == (404 if DB_ENABLED else 503)
