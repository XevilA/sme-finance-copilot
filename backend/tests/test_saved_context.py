"""Synthetic, isolated projects prove write/read/replay and dependency retention."""

import asyncio
import copy
import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import DB_ENABLED, session_scope
from app.main import app
from app.models import AllocationResource, SharedResource, Simulation, SmeProfile, SwarmAllocation, SwarmProject
from app.order_simulation import OrderSimulationRequest, simulate_order

client = TestClient(app)
EXAMPLE = json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text(encoding="utf-8"))


def db(coro):
    async def run():
        async with session_scope() as session:
            return await coro(session)
    return asyncio.run(run())


@pytest.fixture
def synthetic():
    if not DB_ENABLED:
        pytest.skip("Requires PostgreSQL")
    shop, packaging, project, truck = [uuid.uuid4() for _ in range(4)]
    ref = "SYNTHETIC-CONTRACT-" + project.hex
    async def create(session):
        for identifier, sector, cost in [(shop, "synthetic_food", "60"), (packaging, "synthetic_packaging", "10")]:
            session.add(SmeProfile(id=identifier, name="Synthetic contract fixture", sector=sector, business_type=sector,
                                   capacity_total=10, capacity_used=0, cost_per_unit=cost, cash_balance=5000, minimum_cash_reserve=0))
        session.add(SwarmProject(id=project, order_ref=ref, buyer_name="Synthetic buyer", target_capacity=10,
                                 unit_price=100, duration_days=2, payment_terms_days=5, deposit_ratio=0))
        session.add(SharedResource(id=truck, title="Synthetic offered truck", category="truck", category_label="Synthetic",
                                   location="Synthetic", capacity_text="Unknown", price_text="Unknown", unit_price=0,
                                   availability="offered", status="offered"))
    db(create)
    try:
        yield {"shop": str(shop), "packaging": str(packaging), "project": str(project), "truck": str(truck), "ref": ref}
    finally:
        async def cleanup(session):
            await session.execute(delete(SwarmProject).where(SwarmProject.id == project))
            await session.execute(delete(SmeProfile).where(SmeProfile.id.in_([shop, packaging])))
            await session.execute(delete(SharedResource).where(SharedResource.id == truck))
            await session.execute(delete(Simulation).where(Simulation.params["baseline"]["order_ref"].astext == ref))
        db(cleanup)


def order(fixture):
    return {"order_ref": fixture["ref"], "buyer_name": "Synthetic buyer", "project_id": fixture["project"],
            "target_capacity": "10", "unit_price": "100", "duration_days": 2, "payment_terms_days": 5,
            "sme_ids": [fixture["shop"], fixture["packaging"]], "persist": False}


def constraints():
    return {"required_business_types": ["synthetic_food"], "max_distance_km": None,
            "collection_schedule": [{"day_index": 7, "fraction": "1"}]}


def test_unknown_and_known_empty_constraints_are_different_and_persisted(synthetic):
    url = f"/api/v1/projects/{synthetic['project']}/constraints"
    unknown = client.get(url).json()
    assert unknown["data"] is None
    assert "required_business_types" in unknown["missing"]
    written = client.post(url, json={**constraints(), "required_business_types": []})
    assert written.status_code == 200
    assert written.json()["persisted"] is True
    loaded = client.get(url).json()
    assert loaded["data"]["required_business_types"] == []
    assert loaded["missing"] == []
    async def read(session):
        row = await session.get(SwarmProject, uuid.UUID(synthetic["project"]))
        assert row.constraints == loaded["data"]
    db(read)


def test_stored_food_constraint_is_enforced_when_client_omits_it(synthetic):
    client.post(f"/api/projects/{synthetic['project']}/constraints", json=constraints()).raise_for_status()
    body = client.post("/api/swarm", json=order(synthetic)).json()
    assert [shop["shopId"] for shop in body["data"]["shops"]] == [synthetic["shop"]]
    assert body["audit"]["eligibility"][synthetic["packaging"]]["eligible"] is False
    assert body["context"]["projectId"] == synthetic["project"]
    assert body["persisted"] is False
    assert f"resources:{synthetic['shop']}" in body["missing"]


def test_explicit_context_does_not_select_an_unrelated_order(synthetic):
    context = client.get("/api/simulator/context", params={"project_id": synthetic["project"]}).json()
    assert context["data"]["order_ref"] == synthetic["ref"]
    assert context["projectId"] == synthetic["project"]
    assert client.get("/api/simulator/context", params={"project_id": str(uuid.uuid4())}).status_code == 404
    mismatch = {**order(synthetic), "project_id": str(uuid.uuid4())}
    assert client.post("/api/swarm", json=mismatch).status_code == 409


def test_preview_does_not_write_and_persistence_preserves_required_dependencies(synthetic):
    async def prepare(session):
        allocation = SwarmAllocation(project_id=uuid.UUID(synthetic["project"]), sme_id=uuid.UUID(synthetic["shop"]),
                                     assigned_role="producer", share_per_day=10, working_capital_needed=1200,
                                     current_cash=5000, funding_gap=0, status="ready")
        session.add(allocation)
        await session.flush()
        session.add(AllocationResource(allocation_id=allocation.id, resource_id=uuid.UUID(synthetic["truck"]), required=False))
        return allocation.id
    identifier = db(prepare)
    payload = {**order(synthetic), "sme_ids": [synthetic["shop"]]}
    preview = client.post("/api/swarm", json=payload).json()
    assert preview["persisted"] is False
    async def read_link(session):
        return (await session.scalar(select(AllocationResource).where(AllocationResource.allocation_id == identifier))).resource_id
    assert str(db(read_link)) == synthetic["truck"]
    saved = client.post("/api/swarm", json={**payload, "persist": True}).json()
    assert saved["persisted"] is True
    async def check(session):
        assert (await session.get(SwarmAllocation, identifier)).sme_id == uuid.UUID(synthetic["shop"])
        resource = await session.get(SharedResource, uuid.UUID(synthetic["truck"]))
        assert resource.status == "offered"
    db(check)
    assert str(db(read_link)) == synthetic["truck"]


def test_known_empty_dependencies_round_trip_without_becoming_unknown(synthetic):
    payload = {**order(synthetic), "persist": True, "shops": [{
        "shop_id": synthetic["shop"], "name": "Synthetic", "capacity_total": "10", "cost_per_unit": "60",
        "cash_balance": "5000", "resources": [], "business_type": "synthetic_food"}], "sme_ids": []}
    assert client.post("/api/swarm", json=payload).json()["persisted"] is True
    context = client.get("/api/simulator/context", params={"project_id": synthetic["project"]}).json()
    selected = next(shop for shop in context["data"]["shops"] if shop["shop_id"] == synthetic["shop"])
    assert selected["resources"] == []
    assert f"resources:{synthetic['shop']}" not in context["missing"]


def test_offered_resource_cannot_be_confirmed_by_saving_a_snapshot(synthetic):
    payload = {**order(synthetic), "persist": True, "shops": [{
        "shop_id": synthetic["shop"], "name": "Synthetic", "capacity_total": "10", "cost_per_unit": "60", "resources": [{
            "resource_id": synthetic["truck"], "title": "Synthetic", "category": "logistics", "available": True,
            "status": "confirmed", "required": True}]}]}
    assert client.post("/api/swarm", json=payload).status_code == 409


def simulation(fixture):
    baseline = {k: v for k, v in order(fixture).items() if k not in ("project_id", "persist", "sme_ids")}
    baseline["shops"] = [{"shop_id": fixture["shop"], "name": "Synthetic", "capacity_total": "10",
                           "cost_per_unit": "60", "cash_balance": "5000", "resources": []}]
    return {"baseline": baseline, "scenario": {"unit_price": "120", "deposit_ratio": "0.5", "payment_terms_days": 10},
            "project_id": fixture["project"], "input_revision": "synthetic-r1", "persist": True}


def test_order_save_list_read_and_replay_are_scoped_and_exact(synthetic):
    saved = client.post("/api/v1/simulate/order", json=simulation(synthetic)).json()
    assert saved["persisted"] is True
    identifier = saved["simulationId"]
    scope = {"project_id": synthetic["project"]}
    listing = client.get("/api/v1/simulations", params=scope).json()
    assert identifier in {row["simulationId"] for row in listing["data"]}
    read = client.get(f"/api/v1/simulations/{identifier}", params=scope).json()["data"]
    assert read["results"] == saved["data"]
    assert read["request"]["input_revision"] == "synthetic-r1"
    assert read["engine"] == saved["engine"]
    replay = client.post(f"/api/v1/simulations/{identifier}/replay", params=scope).json()
    assert replay["data"]["reproduced"] is True
    assert replay["data"]["savedResultHash"] == replay["data"]["recomputedResultHash"]
    assert replay["data"]["results"] == saved["data"]
    assert replay["persisted"] is False
    changed = client.post(f"/api/simulations/{identifier}/replay", params={**scope, "input_revision": "synthetic-r2"}).json()
    assert "input_revision" in changed["data"]["contextDifferences"]
    assert changed["status"] == "stale"
    assert client.get(f"/api/simulations/{identifier}", params={"project_id": str(uuid.uuid4())}).status_code == 404
    assert client.get(f"/api/simulations/{identifier}").status_code == 422
    async def read_db(session):
        row = await session.get(Simulation, uuid.UUID(identifier))
        assert row.params == read["request"]
        assert row.results == saved["data"]
        assert row.context["projectId"] == synthetic["project"]
    db(read_db)


def test_statement_save_retains_complete_input_and_replays_findings(synthetic):
    saved = client.post("/api/simulate", json={"input": EXAMPLE, "sme_id": synthetic["shop"],
        "project_id": synthetic["project"], "input_revision": "synthetic-statement-1",
        "scenario": {"revenue_change_pct": "-0.2"}, "persist": True}).json()
    replay = client.post(f"/api/simulations/{saved['simulationId']}/replay", params={"project_id": synthetic["project"]}).json()
    assert replay["data"]["reproduced"] is True
    assert replay["data"]["contextDifferences"] == []
    assert replay["data"]["results"] == saved["data"]
    a, b = saved["data"]["planA"]["analysis"], saved["data"]["planB"]["analysis"]
    assert a["inputHash"] != b["inputHash"]
    assert b["data"]["input"] == saved["data"]["planB"]["input"]
    assert "cash_forecast" in b["missing"]
    assert "contextEvidence" not in b["data"]


def test_replay_reports_result_and_engine_differences_instead_of_claiming_success(synthetic):
    saved = client.post("/api/simulate/order", json=simulation(synthetic)).json()
    async def alter(session):
        row = await session.get(Simulation, uuid.UUID(saved["simulationId"]))
        row.replay_version = "order-what-if/v1"
        row.results = {**row.results, "scope": "synthetic-tampered-fixture"}
    db(alter)
    replay = client.post(f"/api/simulations/{saved['simulationId']}/replay", params={"project_id": synthetic["project"]}).json()
    assert replay["data"]["reproduced"] is False
    assert "engine_version" in replay["data"]["contextDifferences"]
    assert replay["status"] == "stale"
    assert replay["data"]["savedResultHash"] != replay["data"]["recomputedResultHash"]


def test_old_partial_simulation_is_readable_but_replay_unavailable(synthetic):
    identifier = uuid.uuid4()
    async def create(session):
        session.add(Simulation(id=identifier, project_id=uuid.UUID(synthetic["project"]), scenario_key="synthetic-legacy",
                               params={"revenue_change_pct": "0.1"}, results={"summary": "synthetic"}))
    db(create)
    scope = {"project_id": synthetic["project"]}
    read = client.get(f"/api/simulations/{identifier}", params=scope).json()
    assert read["data"]["replayAvailable"] is False
    assert client.post(f"/api/simulations/{identifier}/replay", params=scope).status_code == 409


def test_saved_scope_enforces_owner_access_when_enabled(synthetic):
    from app.rbac import Principal, resolve_principal
    saved = client.post("/api/simulate/order", json=simulation(synthetic)).json()
    app.dependency_overrides[resolve_principal] = lambda: Principal(
        "synthetic-owner@example.test", "sme_owner", uuid.UUID(synthetic["shop"]), None, True)
    try:
        assert client.get("/api/simulations", params={"project_id": synthetic["project"]}).status_code == 403
        assert client.get(f"/api/simulations/{saved['simulationId']}", params={"sme_id": str(uuid.uuid4())}).status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_resource_outage_recomputes_only_scenario_without_confirming_anything():
    fixture = {"ref": "SYNTHETIC-OUTAGE", "project": None, "shop": "synthetic", "packaging": "synthetic-packaging"}
    payload = simulation(fixture)
    payload.update(persist=False, project_id=None)
    payload["baseline"]["shops"][0]["resources"] = [{"resource_id": "synthetic-truck", "title": "Synthetic truck",
        "category": "logistics", "status": "confirmed", "available": True, "required": True}]
    payload["scenario"]["unavailable_resource_ids"] = ["synthetic-truck"]
    original = copy.deepcopy(payload)
    body = client.post("/api/simulate/order", json=payload).json()
    assert payload == original
    assert body["data"]["planA"]["totalCapacityAssigned"] == 10
    assert body["data"]["planB"]["totalCapacityAssigned"] == 0
    assert body["data"]["planB"]["deficitBoxesPerDay"] == 10
    assert body["data"]["auditB"]["eligibility"]["synthetic"]["missing_resources"][0]["status"] == "unavailable"
    payload["scenario"]["unavailable_resource_ids"] = ["unknown"]
    assert client.post("/api/simulate/order", json=payload).status_code == 422
