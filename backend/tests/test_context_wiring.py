"""The seam that carries forecast, expense history and resource dependencies.

app/analysis.py and app/swarm.py accept these three optional inputs and have
their own suites (test_analysis_context.py, test_swarm_resources.py). What is
checked here is the wiring Claude owns: that the routes load them for the SME
or project the request is actually about, that an unqueried input stays `None`
rather than becoming an empty one, and that a sub-status inside `data` reaches
the envelope's `missing` so `status` can never claim ok while the comparison
inside says the data is not there.

Database-backed cases skip when no database is reachable.
"""

import asyncio
import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import DB_ENABLED, session_scope
from app.main import app

client = TestClient(app)

BAAN_SUAN = "11111111-1111-4111-8111-111111111111"
RUNG_CHAROEN = "22222222-2222-4222-8222-222222222222"
SAHAI = "33333333-3333-4333-8333-333333333333"
DEMO_ORDER = "PO-STP-2026-091"
DEMO_PROJECT = uuid.UUID("bbbbbbbb-0000-4000-8000-000000000001")
GMP_KITCHEN = uuid.UUID("a1000000-0000-4000-8000-000000000001")

# The statements are all period_end 2026-09-30, so a caller confirming 90 days
# of schedule coverage is confirming through 2026-12-29.
CONFIRMED_THROUGH = "2026-12-29"

# sha256("วัตถุดิบ")[:24], the token app/analysis.py builds its raw-material
# expense evidence and finding ids from.
MATERIALS = "086fadaa1bfd438fc67b8798"

EXAMPLE = json.loads((Path(__file__).parents[1] / "examples" / "analysis_input.json").read_text(encoding="utf-8"))


def database_reachable() -> bool:
    if not DB_ENABLED:
        return False

    async def ping() -> None:
        async with session_scope() as session:
            await session.execute(text("SELECT 1"))

    try:
        asyncio.run(ping())
        return True
    except Exception:
        return False


HAS_DB = database_reachable()
needs_db = pytest.mark.skipif(not HAS_DB, reason="no reachable DATABASE_URL")


def run(coro_factory):
    async def wrapper():
        async with session_scope() as session:
            return await coro_factory(session)

    return asyncio.run(wrapper())


def action_ids(body: dict) -> set[str]:
    """The finding ids behind the overview's action items, which prefixes them."""
    return {item["id"].removeprefix("act-") for item in body["data"]["actionableItems"]}


def indicator_ids(body: dict) -> set[str]:
    return {indicator["id"] for indicator in body["data"]}


def evidence(body: dict) -> dict:
    return {row["id"]: row["value"] for row in body["data"]["dataUsed"]}


# --- expense history reaches the analysis for the SME it belongs to ----------

@needs_db
def test_overview_does_not_explain_a_september_statement_using_october_expenses():
    """Intentional period-alignment correction: latest observation is not the selected period."""
    flagged = client.get("/api/v1/overview", params={"sme_id": RUNG_CHAROEN}).json()
    assert flagged["asOf"] == "2026-09-30"
    assert f"unusual_expense_{MATERIALS}" not in action_ids(flagged)
    # The positive anomaly case remains required for the correctly selected
    # October statement, rather than weakening the original financial check.
    october = client.post("/api/analyze", json={"input": {**EXAMPLE, "period_end": "2026-10-31"},
        "sme_id": RUNG_CHAROEN}).json()
    assert f"unusual_expense_{MATERIALS}" in {row["id"] for row in october["data"]["findings"]}
    assert october["asOf"] == "2026-10-31"


@needs_db
def test_another_smes_history_is_not_borrowed_to_fill_the_gap():
    """Baan Suan's own three categories are all normal, so it gets no finding."""
    body = client.get("/api/v1/overview", params={"sme_id": BAAN_SUAN}).json()
    assert not [item for item in action_ids(body) if item.startswith("unusual_expense_")]


@needs_db
def test_the_expense_evidence_served_is_the_requested_smes_own_rows():
    """168,000 is Rung Charoen's October figure; Baan Suan's is not flagged at all."""
    october = client.post("/api/analyze", json={"input": {**EXAMPLE, "period_end": "2026-10-31"},
        "sme_id": RUNG_CHAROEN}).json()
    flagged = october["views"]["indicators"]
    assert flagged["asOf"] == "2026-10-31"
    values = {indicator["id"]: indicator["value"] for indicator in flagged["data"]}
    assert values[f"health-expense_current_{MATERIALS}"] == 168000.0
    assert values[f"health-expense_baseline_{MATERIALS}"] == 99166.67
    plain = client.get("/api/v1/health/indicators", params={"sme_id": BAAN_SUAN}).json()
    assert not [name for name in indicator_ids(plain) if name.startswith("health-expense_")]


@needs_db
def test_a_queried_but_empty_history_is_not_the_same_as_an_unqueried_one():
    """Sahai Packing has no expense rows, which is a fact, not an absence."""
    body = client.post("/api/analyze", json={"input": EXAMPLE, "sme_id": SAHAI}).json()
    assert body["data"]["expenseComparison"]["status"] == "known_empty"
    assert "expense_comparison_known_empty" in body["missing"]
    assert "expense_history" not in body["missing"]


def test_without_an_sme_neither_context_input_is_claimed_to_be_empty():
    body = client.post("/api/analyze", json={"input": EXAMPLE}).json()
    assert "expense_history" in body["missing"]
    assert "cash_forecast" in body["missing"]
    assert body["status"] == "insufficient_data"
    assert "expenseComparison" not in body["data"]
    assert "contextEvidence" not in body["data"]


# --- the forecast is passed as the result, and only where it is confirmed ----

@needs_db
def test_a_confirmed_schedule_puts_the_dated_forecast_findings_on_the_page():
    params = {"sme_id": RUNG_CHAROEN, "schedule_complete_through": CONFIRMED_THROUGH}
    overview = client.get("/api/v1/overview", params=params).json()
    assert {"forecast_cash_shortfall", "forecast_minimum_cash", "forecast_horizon_balances"} <= action_ids(overview)

    explain = client.get("/api/v1/ai/explain", params=params).json()
    cited = evidence(explain)
    # The dates and amounts are the forecaster's own, not re-derived here.
    assert cited["forecast_first_shortfall_date"] == "2026-10-18"
    assert cited["forecast_minimum_cash"] == "29700.00 THB"
    assert cited["forecast_balance_90_days"] == "179700.00 THB"


@needs_db
def test_an_unconfirmed_schedule_is_declared_rather_than_assumed_complete():
    """Coverage is the caller's assertion; without it no dated claim is made."""
    overview = client.get("/api/v1/overview", params={"sme_id": RUNG_CHAROEN}).json()
    assert not [item for item in action_ids(overview) if item.startswith("forecast_")]
    assert "forecast_schedule_complete_through" in overview["missing"]
    assert overview["status"] == "insufficient_data"


@needs_db
def test_an_sme_with_no_stored_cash_events_says_so_in_the_envelope():
    body = client.post("/api/analyze", json={"input": EXAMPLE, "sme_id": SAHAI}).json()
    assert "forecast_cash_events" in body["missing"]
    assert body["data"]["contextEvidence"] == {}


# --- status follows missing, including sub-statuses inside data --------------

@needs_db
def test_ai_explain_cannot_claim_ok_while_the_comparison_inside_says_otherwise():
    """A complete September expense baseline does not imply forecast coverage.

    October's missing utility row is outside the selected statement period.
    The unknown forecast coverage must still keep the envelope insufficient.
    """
    body = client.get("/api/v1/ai/explain", params={"sme_id": RUNG_CHAROEN}).json()
    assert body["data"]["pageId"] == "overview"
    # The September comparison has its own baseline; October's missing utility
    # row must not contaminate September. Forecast coverage is still unknown.
    assert "expense_comparison_insufficient_data" not in body["missing"]
    assert "forecast_schedule_complete_through" in body["missing"]
    assert body["status"] == "insufficient_data"


@needs_db
def test_a_complete_comparison_adds_nothing_to_missing():
    """Baan Suan's categories all have a baseline, so there is nothing to lift."""
    body = client.get("/api/v1/ai/explain", params={
        "sme_id": BAAN_SUAN, "schedule_complete_through": CONFIRMED_THROUGH,
    }).json()
    assert not [name for name in body["missing"] if name.startswith(("expense_", "forecast_", "cash_forecast"))]
    assert body["status"] == "ok"


def test_lifting_a_sub_status_never_upgrades_a_status_the_engine_already_set():
    from app import adapters

    analysis = {"status": "insufficient_data", "missing": [], "data": {}}
    assert adapters.with_context_gaps(analysis, None)["status"] == "insufficient_data"


def test_the_forecasts_own_missing_entries_are_lifted_under_one_prefix():
    from app import adapters

    analysis = {"status": "ok", "missing": [], "data": {"expenseComparison": {"status": "ok"}}}
    forecast = {"missing": ["opening_cash", "cash_schedule_through_2026-12-29"]}
    lifted = adapters.with_context_gaps(analysis, forecast)
    assert lifted["missing"] == ["forecast_opening_cash", "forecast_cash_schedule_through_2026-12-29"]
    assert lifted["status"] == "insufficient_data"


# --- resource dependencies reach the allocator for the right project --------

def swarm_body(order_ref: str, **changes) -> dict:
    return {"order_ref": order_ref, "buyer_name": "Buyer", "target_capacity": "300",
            "unit_price": "100", "duration_days": 10, "payment_terms_days": 30,
            "sme_ids": [BAAN_SUAN, RUNG_CHAROEN, SAHAI], "persist": False, **changes}


@needs_db
def test_the_allocator_sees_the_dependencies_recorded_for_this_order():
    """The demo order's cold truck is required and only offered, so it binds."""
    body = client.post("/api/swarm", json=swarm_body(DEMO_ORDER)).json()
    eligibility = body["audit"]["eligibility"]
    assert eligibility[BAAN_SUAN]["resource_status"] == "checked"
    assert not eligibility[BAAN_SUAN]["eligible"]
    assert [row["resource_id"] for row in eligibility[BAAN_SUAN]["missing_resources"]] == [
        "a1000000-0000-4000-8000-000000000002"
    ]
    assert not eligibility[RUNG_CHAROEN]["eligible"]
    # Sahai's vacuum sealer is a preference, so it is reported without excluding.
    assert eligibility[SAHAI]["eligible"]
    assert [row["resource_id"] for row in eligibility[SAHAI]["unavailable_preferences"]] == [
        "a1000000-0000-4000-8000-000000000003"
    ]


@needs_db
def test_an_order_with_no_recorded_dependencies_leaves_every_shop_unknown():
    """Absent must stay unknown: `[]` would claim the shops need nothing."""
    body = client.post("/api/swarm", json=swarm_body("PO-NO-RESOURCE-RECORD-001")).json()
    for shop_id, item in body["audit"]["eligibility"].items():
        assert item["resource_status"] == "unknown", shop_id
        assert item["resource_unknowns"] == ["resource_dependencies"]
        assert not item["missing_resources"]


@needs_db
def test_the_same_resource_in_a_second_project_is_not_returned_twice():
    """load_shop_resources joins allocations, so it must be scoped to one project.

    There is one demo project today, so the duplicate is latent: a second
    allocation for the same SME depending on the same resource is seeded here
    to prove the filter, because ShopCapacity rejects a repeated resource id.
    """
    from app.obligations import load_shop_resources
    from app.swarm import ShopCapacity

    owner = uuid.UUID(BAAN_SUAN)
    second = uuid.UUID("cccccccc-0000-4000-8000-00000000000d")
    allocation = uuid.UUID("cccccccc-0000-4000-8000-00000000000a")
    async def seed(session):
        # asyncpg rejects several statements in one parameterised execute.
        await session.execute(text(
            "INSERT INTO swarm_projects (id, order_ref, buyer_name, target_capacity, unit_price,"
            "                            duration_days, status)"
            " VALUES (:id, 'PO-SECOND-PROJECT-TEST', 'Second Buyer', 100, 100, 10, 'draft')"
        ), {"id": second})
        await session.execute(text(
            "INSERT INTO swarm_allocations (id, project_id, sme_id, assigned_role, share_per_day,"
            "                               working_capital_needed, current_cash, funding_gap, status)"
            " VALUES (:allocation, :id, :sme, 'producer', 50, 1000, 1000, 0, 'ready')"
        ), {"allocation": allocation, "id": second, "sme": owner})
        await session.execute(text(
            "INSERT INTO allocation_resources (allocation_id, resource_id, required)"
            " VALUES (:allocation, :resource, TRUE)"
        ), {"allocation": allocation, "resource": GMP_KITCHEN})

    try:
        run(seed)

        # The duplicate the filter has to prevent is really in the table now.
        linked = run(lambda session: session.execute(text(
            """
            SELECT count(*) FROM allocation_resources ar
            JOIN swarm_allocations a ON a.id = ar.allocation_id
            WHERE a.sme_id = :sme AND ar.resource_id = :resource
            """
        ), {"sme": owner, "resource": GMP_KITCHEN})).scalar_one()
        assert linked == 2

        for project in (DEMO_PROJECT, second):
            grouped = run(lambda session, project=project: load_shop_resources(
                session, [owner], project_id=project))
            ids = [row["resource_id"] for row in grouped[BAAN_SUAN]]
            assert ids.count(str(GMP_KITCHEN)) == 1
            # The engine's own guard: a repeated id would raise here.
            ShopCapacity.model_validate({"shop_id": BAAN_SUAN, "name": "Baan Suan",
                                         "capacity_total": "600", "cost_per_unit": "60",
                                         "resources": grouped[BAAN_SUAN]})

        # And the route that allocates the demo order still answers.
        response = client.post("/api/swarm", json=swarm_body(DEMO_ORDER))
        assert response.status_code == 200
        assert response.json()["audit"]["eligibility"][BAAN_SUAN]["resource_status"] == "checked"
    finally:
        run(lambda session: session.execute(
            text("DELETE FROM swarm_projects WHERE id = :id"), {"id": second}))


@needs_db
def test_the_loader_is_scoped_to_one_project_by_construction():
    """A project an SME has no allocation in yields no claim about its shops."""
    from app.obligations import load_shop_resources

    unrelated = uuid.UUID("99999999-9999-4999-8999-999999999999")
    assert run(lambda session: load_shop_resources(session, [uuid.UUID(BAAN_SUAN)], project_id=unrelated)) == {}
    assert run(lambda session: load_shop_resources(None, [uuid.UUID(BAAN_SUAN)], project_id=DEMO_PROJECT)) == {}


# --- the simulator carries inline dependencies into both plans --------------

def test_the_simulator_applies_resource_eligibility_to_plan_a_and_plan_b():
    """Resources travel with the shop rows, so scenario_swarm keeps them."""
    blocked = {"shop_id": "shop-blocked", "name": "Blocked", "capacity_total": "40",
               "cost_per_unit": "60",
               "resources": [{"resource_id": "cold-truck", "title": "Cold truck",
                              "category": "transport", "status": "offered",
                              "available": False, "required": True}]}
    open_shop = {"shop_id": "shop-open", "name": "Open", "capacity_total": "40",
                 "cost_per_unit": "80", "resources": []}
    body = client.post("/api/simulate", json={
        "persist": False,
        "input": EXAMPLE,
        "scenario": {"label": "Plan B", "cost_change_pct": "0.10"},
        "swarm": {"order_ref": "SIM-RESOURCES", "buyer_name": "Buyer", "target_capacity": "40",
                  "unit_price": "100", "duration_days": 10, "payment_terms_days": 30,
                  "shops": [blocked, open_shop]},
    })
    assert body.status_code == 200
    data = body.json()["data"]
    for plan in ("planA", "planB"):
        assert [shop["shopId"] for shop in data[plan]["swarm"]["shops"]] == ["shop-open"]
