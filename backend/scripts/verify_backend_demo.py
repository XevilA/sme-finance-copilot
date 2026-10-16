"""Real HTTP + PostgreSQL read-back acceptance using isolated synthetic fixtures.

Run with backend/run.cmd serving the tested checkout. No provider calls, seed
reset or customer-data mutations. Only UUIDs created by this invocation are
cleaned up, including on failure. Report never contains credentials.
"""

import argparse
import asyncio
import json
import sys
import uuid
from datetime import date
from pathlib import Path

import httpx
from sqlalchemy import delete, func, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.context import fingerprint
from app.db import session_scope
from app.models import CashEvent, ExpenseTransaction, FinancialRecord, SharedResource, Simulation, SmeProfile, SwarmProject, UploadEvent


def db(operation):
    async def run():
        async with session_scope() as session:
            return await operation(session)
    return asyncio.run(run())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    owner, packaging, project, machine = [uuid.uuid4() for _ in range(4)]
    ref = "SYNTHETIC-HTTP-" + project.hex
    payload = json.loads((Path(__file__).resolve().parents[1] / "examples/analysis_input.json").read_text(encoding="utf-8"))
    async def create(session):
        for identifier, sector, cost in [(owner, "synthetic_food", 60), (packaging, "synthetic_packaging", 10)]:
            session.add(SmeProfile(id=identifier, name="Synthetic HTTP acceptance", sector=sector, business_type=sector,
                                   capacity_total=10, capacity_used=0, cost_per_unit=cost, cash_balance=80000, minimum_cash_reserve=30000))
        await session.flush()
        session.add(SwarmProject(id=project, order_ref=ref, buyer_name="Synthetic HTTP buyer", target_capacity=10,
                                 unit_price=100, duration_days=2, payment_terms_days=5, deposit_ratio=0))
        session.add(SharedResource(id=machine, owner_sme_id=owner, title="Synthetic confirmed machine", category="machine",
                                   category_label="Synthetic", location="Synthetic", capacity_text="Fixture only", price_text="Fixture only",
                                   unit_price=0, availability="confirmed", status="confirmed"))
        await session.flush()
        for month, amount in [(7, 500), (8, 500), (9, 1000)]:
            session.add(ExpenseTransaction(sme_id=owner, transaction_date=date(2026, month, 10), category="Synthetic materials",
                                           description="Synthetic comparison", amount=amount, source="api"))
        for day, amount, inflow in [(5, 10000, False), (20, 15000, True)]:
            session.add(CashEvent(sme_id=owner, project_id=project, event_date=date(2026, 10, day), day_index=day,
                                  type="receive_payment" if inflow else "pay_obligations", title="Synthetic dated event",
                                  amount=amount, is_inflow=inflow, status="projected", impact_reason="Synthetic fixture"))
    async def cleanup(session):
        await session.execute(delete(SwarmProject).where(SwarmProject.id == project))
        await session.execute(delete(SharedResource).where(SharedResource.id == machine))
        await session.execute(delete(SmeProfile).where(SmeProfile.id.in_([owner, packaging])))
    db(create)
    try:
        async def check_fixture(session):
            assert await session.get(SmeProfile, owner) is not None
            assert await session.get(SwarmProject, project) is not None
            assert (await session.get(SharedResource, machine)).status == "confirmed"
        db(check_fixture)
        with httpx.Client(base_url=args.base_url, timeout=25) as client:
            def call(method, path, **kwargs):
                response = client.request(method, "/api/v1" + path, **kwargs)
                response.raise_for_status()
                return response.json()
            template = client.get("/api/v1/analysis/template.xlsx")
            template.raise_for_status()
            uploaded = call("POST", "/upload?persist=false", files={"file": ("synthetic.xlsx", template.content)})
            assert uploaded["persisted"] is False and uploaded["upload"]["fileStored"] is False
            ctx = {"input": payload, "sme_id": str(owner), "project_id": str(project),
                   "input_revision": "synthetic-http-r1", "schedule_complete_through": "2026-12-29"}
            calculated = call("POST", "/calculate", json={**ctx, "persist": True})
            assert calculated["persisted"] is True
            async def read_calculation(session):
                row = await session.get(FinancialRecord, uuid.UUID(calculated["recordId"]))
                assert row.sme_id == owner
                assert row.payload == uploaded["input"]
                assert row.computed["grading"] == calculated["grading"]
            db(read_calculation)
            analysis = call("POST", "/analyze", json=ctx)
            funding = call("POST", "/funding/evaluate", json={**ctx, "amount": "45000", "sector": "synthetic_food"})
            forecast = call("POST", "/forecast/preview", json=ctx)
            assert calculated["inputHash"] == analysis["inputHash"] == funding["inputHash"] == forecast["inputHash"]
            assert analysis["data"]["grading"]["grade"] == funding["data"]["grade"] == "B"
            assert funding["data"]["gradeScore"] == "75.00"
            assert forecast["data"]["minimum_cash"] == "70000.00"
            assert forecast["data"]["period_end_balances"]["90"] == "85000.00"
            assert any(f["id"].startswith("unusual_expense_") for f in analysis["data"]["findings"])
            values = {"required_business_types": ["synthetic_food"], "max_distance_km": None,
                      "collection_schedule": [{"day_index": 7, "fraction": "1"}]}
            call("POST", f"/projects/{project}/constraints", json=values)
            assert call("GET", f"/projects/{project}/constraints")["data"] == values
            async def read_constraints(session):
                assert (await session.get(SwarmProject, project)).constraints == values
            db(read_constraints)
            baseline = {"order_ref": ref, "buyer_name": "Synthetic HTTP buyer", "target_capacity": "10", "unit_price": "100",
                "duration_days": 2, "payment_terms_days": 5, **values, "shops": [
                    {"shop_id": str(owner), "name": "Synthetic food", "business_type": "synthetic_food", "capacity_total": "10",
                     "cost_per_unit": "60", "cash_balance": "80000", "resources": [{"resource_id": str(machine),
                         "title": "Synthetic confirmed machine", "category": "machine", "status": "confirmed", "available": True, "required": True}]},
                    {"shop_id": str(packaging), "name": "Synthetic packaging", "business_type": "synthetic_packaging", "capacity_total": "10",
                     "cost_per_unit": "10", "cash_balance": "80000", "resources": []}]}
            swarm = call("POST", "/swarm", json={**baseline, "project_id": str(project), "persist": False})
            assert swarm["persisted"] is False
            assert [shop["shopId"] for shop in swarm["data"]["shops"]] == [str(owner)]
            simulation = call("POST", "/simulate/order", json={"baseline": baseline, "project_id": str(project),
                "sme_id": str(owner), "input_hash": analysis["inputHash"], "input_revision": "synthetic-http-r1", "persist": True,
                "scenario": {"unit_price": "100", "deposit_ratio": "0", "payment_terms_days": 5,
                             "unavailable_resource_ids": [str(machine)]}})
            assert simulation["persisted"] is True
            assert simulation["data"]["planA"]["totalCapacityAssigned"] == 10
            assert simulation["data"]["planB"]["totalCapacityAssigned"] == 0
            scope = {"project_id": str(project)}
            identifier = simulation["simulationId"]
            assert identifier in {row["simulationId"] for row in call("GET", "/simulations", params=scope)["data"]}
            saved = call("GET", f"/simulations/{identifier}", params=scope)["data"]
            assert saved["results"] == simulation["data"]
            replay = call("POST", f"/simulations/{identifier}/replay", params=scope)
            assert replay["data"]["reproduced"] is True
            async def read_saved(session):
                row = await session.get(Simulation, uuid.UUID(identifier))
                assert row.project_id == project and row.sme_id == owner
                assert row.results == saved["results"]
                assert row.params == saved["request"]
                assert (await session.get(SharedResource, machine)).status == "confirmed"
            db(read_saved)
            partial = call("POST", "/analyze", json={"input": {key: payload[key] for key in
                ("currency", "kind", "period_start", "period_end", "assets", "liabilities", "equity")}})
            assert partial["views"]["cost"]["data"]["costPerUnit"] is None
            assert client.get(f"/api/v1/simulations/{identifier}", params={"project_id": str(uuid.uuid4())}).status_code == 404
            assert client.get(f"/api/v1/simulations/{identifier}").status_code == 422
            assert client.post("/api/v1/analyze", json={**ctx, "expected_input_hash": "0" * 64}).status_code == 422
            print(json.dumps({"synthetic": True, "httpAndDbReadBack": "passed", "sharedInputHash": analysis["inputHash"],
                "grade": "B", "score": "75.00", "forecastMinimum": "70000.00", "forecast90": "85000.00",
                "swarmFoodOnly": True, "outageRecomputed": True, "savedReplayReproduced": True,
                "crossProject404": True, "missingScope422": True, "staleHash422": True,
                "deployed": False, "providerCalls": 0}, indent=2))
    finally:
        db(cleanup)


if __name__ == "__main__":
    main()
