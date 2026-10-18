"""Stable cross-process locks and real DB concurrency, with no provider traffic."""

import asyncio
import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import fetch_state
from app.db import DB_ENABLED, session_scope
from app.main import app


def test_provider_lock_key_is_identical_across_independent_python_hash_seeds():
    keys = []
    for seed in ("1", "12345"):
        env = {**os.environ, "PYTHONHASHSEED": seed, "DATABASE_URL": ""}
        result = subprocess.run([sys.executable, "-c", "from app.fetch_state import lock_key; print(lock_key('gdelt'))"],
            cwd=Path(__file__).parents[1], env=env, capture_output=True, text=True, check=True)
        keys.append(result.stdout.strip())
    assert keys[0] == keys[1] == str(fetch_state.lock_key("gdelt"))


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_gate_lock_spans_sessions_until_backoff_commit_and_does_not_leak():
    provider = "synthetic-coordination-" + uuid.uuid4().hex
    async def exercise():
        try:
            async with session_scope() as first:
                assert (await fetch_state.acquire(first, provider)).allowed is True
                async with session_scope() as second:
                    blocked = await fetch_state.acquire(second, provider)
                    assert blocked.allowed is False
                    assert blocked.reason == "another_worker_is_fetching"
                await fetch_state.record_failure(first, provider, "synthetic_timeout")
                # Compatibility release must not open a pre-commit race.
                await fetch_state.release(first, provider)
                async with session_scope() as second:
                    assert (await fetch_state.acquire(second, provider, force=True)).allowed is False
            async with session_scope() as third:
                delayed = await fetch_state.acquire(third, provider)
                assert delayed.allowed is False
                assert delayed.reason == "rate_limited"
                # The old transaction no longer owns a lock. Force is used on
                # this synthetic key only; no provider request is made.
                assert (await fetch_state.acquire(third, provider, force=True)).allowed is True
        finally:
            async with session_scope() as session:
                await session.execute(text("DELETE FROM provider_fetch_state WHERE provider=:p"), {"p": provider})
    asyncio.run(exercise())


@pytest.mark.skipif(not DB_ENABLED, reason="Requires PostgreSQL")
def test_route_keeps_the_lock_during_fetch_and_updates_backoff_without_network(monkeypatch):
    from app.routers import insights
    from app.industry import analyze_industry_articles
    monkeypatch.setenv("PROVIDER_BACKOFF_BASE_SECONDS", "1")
    provider = "synthetic-route-" + uuid.uuid4().hex
    monkeypatch.setattr(insights, "PROVIDER", provider)
    calls = []
    async def synthetic_fetch(sector, *, as_of, **kwargs):
        calls.append(sector)
        async with session_scope() as competing:
            gate = await fetch_state.acquire(competing, provider)
            assert gate.allowed is False
            assert gate.reason == "another_worker_is_fetching"
        return analyze_industry_articles([], sector, as_of=as_of, source_status="unavailable", source_error="synthetic_timeout")
    monkeypatch.setattr(insights, "fetch_industry_trends", synthetic_fetch)
    try:
        client = TestClient(app)
        first = client.get("/api/industry/trends").json()
        assert first["data"]["sourceError"] == "synthetic_timeout"
        assert first["data"]["retryAfterSeconds"] == 1
        assert first["providerGate"]["consecutiveFailures"] == 1
        second = client.get("/api/industry/trends").json()
        assert second["data"]["sourceError"] == "provider_gate_closed"
        assert second["data"]["retryAfterSeconds"] >= 1
        assert len(calls) == 1
        assert second["data"]["articles"] == []
    finally:
        async def cleanup():
            async with session_scope() as session:
                await session.execute(text("DELETE FROM provider_fetch_state WHERE provider=:p"), {"p": provider})
        asyncio.run(cleanup())
