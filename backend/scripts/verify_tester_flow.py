"""Measure the local tester API, using only synthetic data and no paid LLM."""

import argparse
import asyncio
import json
import sys
from uuid import UUID
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db import session_scope

ROOT = Path(__file__).resolve().parents[1]
RUNG = "22222222-2222-4222-8222-222222222222"


async def database_facts():
    async with session_scope() as session:
        tables = (await session.execute(text(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
        ))).scalar_one()
        profile = (await session.execute(text(
            "SELECT cash_balance, minimum_cash_reserve, latitude, longitude FROM sme_profiles WHERE id=:id"
        ), {"id": UUID(RUNG)})).mappings().one()
        admin_ready = (await session.execute(text(
            "SELECT password_hash IS NOT NULL AND password_hash <> '' FROM users WHERE email='admin@example.test'"
        ))).scalar_one()
        return {"tables": tables, "rung_cash": str(profile["cash_balance"]),
                "rung_reserve": str(profile["minimum_cash_reserve"]),
                "coordinates_known": profile["latitude"] is not None and profile["longitude"] is not None,
                "admin_password_configured": admin_ready}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--news", action="store_true", help="Make one gated news request; never force or retry")
    args = parser.parse_args()
    payload = json.loads((ROOT / "examples/analysis_input.json").read_text())
    with httpx.Client(base_url=args.base_url, timeout=25) as client:
        def call(method, path, **kwargs):
            response = client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()

        health = call("GET", "/health")
        template = client.get("/api/v1/analysis/template.xlsx")
        template.raise_for_status()
        uploaded = call("POST", "/api/v1/upload?persist=false", files={"file": ("template.xlsx", template.content)})
        assert uploaded["upload"]["fileStored"] is False and uploaded["persisted"] is False
        manual = call("POST", "/api/v1/inputs/manual", json=payload)
        computed = call("POST", "/api/v1/calculate", json={"input": manual["data"], "persist": False})
        analyzed = call("POST", "/api/v1/analyze", json={"input": payload, "shop_name": "Synthetic tester statement"})
        assert analyzed["data"]["grading"] == computed["grading"]
        assert analyzed["data"]["grading"]["score"] == "75.00"
        bad = client.post("/api/v1/upload?persist=false", files={"file": ("bad.xlsx", b"bad zip")})
        assert bad.status_code == 422
        funding = call("POST", f"/api/v1/match-funding?sme_id={RUNG}&persist=false")
        assert funding["data"]["requestedAmount"] == 45000
        swarm = call("POST", "/api/v1/swarm", json={
            "order_ref": "SYNTHETIC-READINESS", "buyer_name": "Synthetic buyer", "persist": False,
            "target_capacity": "40", "unit_price": "100", "duration_days": 10, "payment_terms_days": 30,
            "shops": [{"shop_id": "synthetic", "name": "Synthetic shop", "capacity_total": "40",
                       "cost_per_unit": "70", "resources": []}],
        })
        assert swarm["data"]["totalCost"] == 28000
        simulation = call("POST", "/api/v1/simulate", json={
            "input": payload, "persist": False, "scenario": {"revenue_change_pct": "0.10"},
        })
        assert simulation["data"]["planB"]["input"]["revenue"] == "275000.00"
        forecast = call("GET", f"/api/v1/forecast?sme_id={RUNG}&as_of=2026-09-30&schedule_complete_through=2026-12-29")
        spec = call("GET", "/openapi.json")
        contracts = ["/overview", "/cashflow/timeline", "/shops", "/order", "/swarm/proposal",
                     f"/shops/{RUNG}/finance", "/funding/options", "/unlock/resources", "/simulator/chaos",
                     "/health/indicators", "/cost/breakdown", "/sales/products", "/sales/channels",
                     "/funder/projects", "/projects", "/ai/explain?page=overview"]
        for path in contracts:
            body = call("GET", f"/api/v1{path}")
            assert body["source"]
            if body.get("missing"):
                assert body["status"] != "ok", path
        report = {
            "health": health, "database": asyncio.run(database_facts()),
            "api_routes": sum(1 for path in spec["paths"] if path.startswith("/api/") and not path.startswith("/api/v1/")),
            "frontend_contracts_checked": len(contracts), "template_bytes": len(template.content),
            "corrupt_upload_status": bad.status_code,
            "manual_grade": computed["grading"], "upload_grade": uploaded["grading"]["grade"],
            "views": {key: {"source": value["source"], "status": value["status"], "missing": value["missing"]}
                      for key, value in analyzed["views"].items()},
            "rung_funding_amount": funding["data"]["requestedAmount"],
            "synthetic_swarm_cost": swarm["data"]["totalCost"],
            "synthetic_scenario_revenue": simulation["data"]["planB"]["input"]["revenue"],
            "forecast_minimum": forecast["data"]["minimum_cash"],
            "forecast_first_shortfall": forecast["data"]["first_shortfall_date"],
        }
        if args.news:
            news = call("GET", "/api/v1/industry/trends?sector=food_processing")
            report["news"] = {"status": news["status"], "source": news["source"],
                              "sourceStatus": news["data"]["sourceStatus"],
                              "sourceError": news["data"]["sourceError"], "articles": len(news["data"]["articles"])}
        output = ROOT / "uploads/tester-readiness-verification.json"
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({key: value for key, value in report.items() if key not in {"manual_grade", "views"}}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
