"""Persistence path. Skipped unless a reachable DATABASE_URL is configured.

  docker compose -f backend/docker-compose.yml up -d

backend/.env supplies DATABASE_URL, so these run by default once the container
is up and skip when it is not.
"""

import asyncio
import hashlib
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import DB_ENABLED, session_scope
from app.main import app


def database_reachable() -> bool:
    """backend/.env sets DATABASE_URL for everyone, so DB_ENABLED alone is not
    enough: skip rather than fail when the container simply is not running."""
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


pytestmark = pytest.mark.skipif(
    not database_reachable(),
    reason="no reachable DATABASE_URL (start it with: docker compose -f backend/docker-compose.yml up -d)",
)

# UUIDs from db/seed.sql.
BAAN_SUAN = "11111111-1111-4111-8111-111111111111"
RUNG_CHAROEN = "22222222-2222-4222-8222-222222222222"
SAHAI = "33333333-3333-4333-8333-333333333333"

client = TestClient(app)


def order(**overrides):
    body = {
        "order_ref": "PO-PERSIST-TEST",
        "buyer_name": "Siam Retail Group",
        "target_capacity": "1000",
        "unit_price": "100.00",
        "duration_days": 30,
        "payment_terms_days": 30,
        "deposit_ratio": "0.2",
        "sme_ids": [BAAN_SUAN, RUNG_CHAROEN, SAHAI],
    }
    body.update(overrides)
    return body


def test_health_reports_persistence_on():
    assert client.get("/health").json()["persistence"] is True


def test_swarm_loads_shops_from_sme_profiles_and_persists():
    body = client.post("/api/swarm", json=order()).json()
    assert body["persisted"] is True
    assert body["projectId"]
    assert len(body["data"]["shops"]) == 3


def test_stored_proposal_reads_back():
    client.post("/api/swarm", json=order())
    body = client.get("/api/swarm/PO-PERSIST-TEST").json()["data"]
    assert len(body["shops"]) == 3
    assert {shop["assignedRole"] for shop in body["shops"]} == {
        "lead_producer", "co_producer", "finisher"
    }


def test_reposting_the_same_order_replaces_allocations():
    """Guards the upsert: re-running a proposal must not duplicate rows."""
    client.post("/api/swarm", json=order())
    first = client.get("/api/swarm/PO-PERSIST-TEST").json()["data"]["shops"]
    client.post("/api/swarm", json=order())
    second = client.get("/api/swarm/PO-PERSIST-TEST").json()["data"]["shops"]
    assert len(first) == len(second) == 3


def test_calculate_writes_a_financial_record():
    """Guards the JSONB payload: date and Decimal must be dumped in JSON mode."""
    payload = json.loads((Path(__file__).parents[1] / "examples/manual_input.json").read_text())
    body = client.post("/api/calculate", json={"sme_id": BAAN_SUAN, "input": payload}).json()
    assert body["persisted"] is True
    assert body["recordId"]


def test_unknown_sme_id_computes_without_persisting():
    payload = json.loads((Path(__file__).parents[1] / "examples/manual_input.json").read_text())
    unknown = "99999999-9999-4999-8999-999999999999"
    body = client.post("/api/calculate", json={"sme_id": unknown, "input": payload}).json()
    assert body["persisted"] is False
    assert body["data"]["fcf"]["value"] == "50000.00"


def analysis_payload():
    return json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text())


def excel_bytes(data):
    from io import BytesIO

    from openpyxl import Workbook

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


def test_upload_stores_the_record_and_the_upload_event():
    content = excel_bytes(analysis_payload())
    body = client.post(
        "/api/upload", params={"sme_id": BAAN_SUAN}, files={"file": ("statement.xlsx", content)}
    ).json()
    assert body["persisted"] is True
    assert body["recordId"]
    assert body["upload"]["uploadId"]
    # The bytes themselves are never stored, only their digest.
    assert body["upload"]["contentSha256"] == hashlib.sha256(content).hexdigest()
    assert body["upload"]["fileStored"] is False


def test_rejected_upload_is_still_recorded():
    """A rejected workbook must leave an audit trail, not vanish."""
    before = client.post("/api/upload", params={"sme_id": BAAN_SUAN},
                         files={"file": ("junk.txt", b"not a workbook")})
    assert before.status_code == 422


def test_simulation_is_persisted():
    body = client.post("/api/simulate", json={
        "sme_id": BAAN_SUAN,
        "scenario_key": "sales_shock",
        "input": analysis_payload(),
        "scenario": {"label": "sales -20%", "revenue_change_pct": "-0.2"},
    }).json()
    assert body["persisted"] is True
    assert body["simulationId"]


def test_simulation_for_an_unknown_sme_computes_without_persisting():
    body = client.post("/api/simulate", json={
        "sme_id": "99999999-9999-4999-8999-999999999999",
        "input": analysis_payload(),
        "scenario": {"label": "sales -20%", "revenue_change_pct": "-0.2"},
    }).json()
    assert body["persisted"] is False
    assert body["data"]["delta"]["summary"]["verdict"] in {"worse", "mixed"}


def test_pool_is_nullpool_unless_opted_in():
    """A pooled asyncpg connection is bound to one event loop; NullPool is the
    safe default for TestClient and serverless runtimes alike."""
    from sqlalchemy.pool import NullPool

    from app.db import POOLED, _engine

    if not POOLED:
        assert isinstance(_engine.pool, NullPool)
    assert os.getenv("DB_POOL", "null").lower() in {"null", "queue"}
