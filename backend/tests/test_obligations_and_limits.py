"""Dated obligations, the provider rate gate and the login throttle.

These are the data and coordination layers behind the forecast and the trends
route. The algorithms themselves are Codex's and have their own suites; what is
checked here is that stored rows reach them in the shape they expect, that an
unknown category stays distinguishable from an empty one, and that the two
limits actually hold.
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import DB_ENABLED, session_scope
from app.forecasting import project_cash_events
from app.main import app
from app.obligations import load_expense_history, load_obligations, upsert_projected_events

client = TestClient(app)

BAAN_SUAN = uuid.UUID("11111111-1111-4111-8111-111111111111")
RUNG_CHAROEN = uuid.UUID("22222222-2222-4222-8222-222222222222")
DEMO_PROJECT = uuid.UUID("bbbbbbbb-0000-4000-8000-000000000001")
AS_OF = date(2026, 9, 30)


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


# --- obligation loading -----------------------------------------------------

def test_an_unknown_category_is_not_an_empty_one():
    """Without a session nothing was queried, so nothing may be called empty.

    The forecaster treats None as unknown and [] as known-empty. Returning []
    for a table never read would let it call a schedule complete when it is
    merely unseen.
    """
    result = asyncio.run(load_obligations(None, BAAN_SUAN))
    assert set(result) == {"receivables", "payables", "operating_costs", "installments"}
    assert all(value is None for value in result.values())
    assert asyncio.run(load_expense_history(None, BAAN_SUAN)) is None


@needs_db
def test_queried_categories_are_lists_even_when_a_shop_has_none():
    """Every category was read, so an absent one is genuinely empty."""
    unknown = uuid.UUID("99999999-9999-4999-8999-999999999999")
    result = run(lambda session: load_obligations(session, unknown))
    assert all(isinstance(value, list) for value in result.values())
    assert all(value == [] for value in result.values())


@needs_db
def test_obligations_match_the_forecaster_dto():
    result = run(lambda session: load_obligations(session, BAAN_SUAN))
    for rows in result.values():
        for row in rows:
            assert {"id", "due_date", "amount", "title"} <= set(row)
            # Dates and money are strings, as the forecaster documents.
            assert date.fromisoformat(row["due_date"])
            assert float(row["amount"]) > 0


@needs_db
def test_payable_kinds_land_in_the_right_forecaster_category():
    result = run(lambda session: load_obligations(session, BAAN_SUAN))
    assert any("PO-RAW" in row["title"] for row in result["payables"])
    assert any("UTIL" in row["title"] for row in result["operating_costs"])
    assert any("LOAN" in row["title"] for row in result["installments"])


@needs_db
def test_settled_obligations_are_not_forecast_again():
    """A paid bill is already in the cash balance; forecasting it double counts."""
    result = run(lambda session: load_obligations(session, BAAN_SUAN))
    titles = [row["title"] for rows in result.values() for row in rows]
    # Seeded as paid and collected respectively.
    assert not any("PO-RAW-1150" in title for title in titles)
    assert not any("INV-2026-0854" in title for title in titles)


# --- projected events -------------------------------------------------------

@needs_db
def test_projected_events_are_stable_and_upsert_rather_than_duplicate():
    obligations = run(lambda session: load_obligations(session, BAAN_SUAN))
    first = project_cash_events(as_of=AS_OF, sme_id=str(BAAN_SUAN), **obligations)
    second = project_cash_events(as_of=AS_OF, sme_id=str(BAAN_SUAN), **obligations)
    assert [event["id"] for event in first["events"]] == [event["id"] for event in second["events"]]

    def count(session):
        return session.execute(
            text("SELECT count(*) FROM cash_events WHERE sme_id = :s AND status = 'projected'"),
            {"s": str(BAAN_SUAN)},
        )

    run(lambda session: upsert_projected_events(session, first["events"]))
    before = run(count).scalar_one()
    run(lambda session: upsert_projected_events(session, first["events"]))
    after = run(count).scalar_one()
    assert before == after, "a second upsert added rows instead of updating them"


@needs_db
def test_upsert_leaves_confirmed_events_alone():
    """A confirmed event records something that happened; it is not ours to overwrite."""

    def confirmed(session):
        return session.execute(
            text("SELECT count(*) FROM cash_events WHERE status = 'confirmed'")
        )

    before = run(confirmed).scalar_one()
    obligations = run(lambda session: load_obligations(session, BAAN_SUAN))
    produced = project_cash_events(as_of=AS_OF, sme_id=str(BAAN_SUAN), **obligations)
    run(lambda session: upsert_projected_events(session, produced["events"]))
    assert run(confirmed).scalar_one() == before


# --- GET /api/forecast ------------------------------------------------------

@needs_db
def test_forecast_projects_from_stored_obligations():
    body = client.get(
        f"/api/forecast?sme_id={BAAN_SUAN}&as_of=2026-09-30"
        "&schedule_complete_through=2026-12-29"
    ).json()
    assert body["status"] == "ok"
    assert body["projectedFromObligations"]["events"] > 0


@needs_db
def test_forecast_finds_the_distressed_shortfall():
    """Rung Charoen cannot cover its October bills; the date must be reported."""
    body = client.get(
        f"/api/forecast?sme_id={RUNG_CHAROEN}&as_of=2026-09-30"
        "&schedule_complete_through=2026-12-29"
    ).json()
    assert body["data"]["first_shortfall_date"] is not None


@needs_db
def test_an_overdue_obligation_is_reported_not_moved():
    """A past-due row needs a real rescheduled date, never an invented one."""
    body = client.get(
        f"/api/forecast?sme_id={RUNG_CHAROEN}&as_of=2026-09-30"
        "&schedule_complete_through=2026-12-29"
    ).json()
    generated = body["projectedFromObligations"]
    assert generated["overdue"], "the seeded overdue invoice should be reported"
    assert any("rescheduled_due_date" in entry for entry in generated["missing"])


@needs_db
def test_forecasting_can_be_turned_off():
    body = client.get(
        f"/api/forecast?sme_id={BAAN_SUAN}&as_of=2026-09-30&project_obligations=false"
    ).json()
    assert body["projectedFromObligations"]["events"] == 0


# --- expense history --------------------------------------------------------

@needs_db
def test_expense_history_gives_a_baseline_to_compare_against():
    rows = run(lambda session: load_expense_history(session, RUNG_CHAROEN))
    assert rows
    for row in rows:
        assert {"id", "date", "category", "description", "amount"} <= set(row)
    # Newest first, so a comparison window is easy to take.
    dates = [row["date"] for row in rows]
    assert dates == sorted(dates, reverse=True)
    # Several months in one category is what makes "unusual" meaningful.
    materials = [row for row in rows if row["category"] == "วัตถุดิบ"]
    assert len(materials) >= 3


# --- provider rate gate -----------------------------------------------------

@needs_db
def test_the_provider_gate_blocks_a_second_immediate_call():
    """Several workers calling at once is what produced HTTP 429."""
    from app import fetch_state

    run(lambda session: session.execute(text("DELETE FROM provider_fetch_state")))
    first = client.get("/api/industry/trends?sector=food_processing").json()
    assert first["providerGate"]["coordinated"] is True

    second = client.get("/api/industry/trends?sector=food_processing").json()
    assert any("provider_gate" in entry for entry in second["missing"]), second["missing"]
    assert second["data"]["retryAfterSeconds"]
    assert fetch_state.min_interval() > 0


@needs_db
def test_backoff_grows_with_consecutive_failures_and_respects_retry_after():
    from app import fetch_state

    run(lambda session: session.execute(text("DELETE FROM provider_fetch_state")))
    delays = [
        run(lambda session: fetch_state.record_failure(session, "test-provider", "boom"))
        for _ in range(3)
    ]
    assert delays[1] > delays[0] and delays[2] > delays[1], delays

    # A longer Retry-After from the provider wins: being asked to wait and then
    # calling sooner is how a soft limit becomes a hard block.
    honoured = run(
        lambda session: fetch_state.record_failure(session, "test-provider", "429", 3000)
    )
    assert honoured >= 3000 or honoured == fetch_state.DEFAULT_BACKOFF_CEILING_SECONDS
    run(lambda session: session.execute(
        text("DELETE FROM provider_fetch_state WHERE provider = 'test-provider'")
    ))


@needs_db
def test_success_clears_the_failure_count():
    from app import fetch_state

    run(lambda session: fetch_state.record_failure(session, "test-provider", "boom"))
    run(lambda session: fetch_state.record_success(session, "test-provider"))
    state = run(lambda session: fetch_state.status(session, "test-provider"))
    assert state["consecutiveFailures"] == 0
    assert state["lastError"] is None
    run(lambda session: session.execute(
        text("DELETE FROM provider_fetch_state WHERE provider = 'test-provider'")
    ))


def test_no_database_means_no_coordination_is_claimed():
    from app import fetch_state

    gate = asyncio.run(fetch_state.acquire(None, "gdelt"))
    assert gate.allowed is True
    assert gate.reason == "no_coordination"
    assert asyncio.run(fetch_state.status(None, "gdelt"))["coordinated"] is False


# --- login throttle ---------------------------------------------------------

@needs_db
def test_login_locks_out_after_repeated_failures():
    from app import throttle

    email = "throttle-probe@example.test"
    run(lambda session: throttle.record_success(session, email))

    seen = []
    for _ in range(throttle.max_attempts() + 2):
        response = client.post("/api/auth/login", json={"email": email, "password": "wrong"})
        seen.append(response.status_code)
    assert 401 in seen
    assert 429 in seen, seen
    assert seen.index(429) >= throttle.max_attempts()

    locked = client.post("/api/auth/login", json={"email": email, "password": "wrong"})
    assert locked.headers.get("Retry-After")
    run(lambda session: throttle.record_success(session, email))


@needs_db
def test_an_unknown_address_is_throttled_the_same_way():
    """Throttling only real accounts would reveal which addresses exist."""
    from app import throttle

    ghost = "definitely-not-a-user@example.test"
    run(lambda session: throttle.record_success(session, ghost))
    codes = {
        client.post("/api/auth/login", json={"email": ghost, "password": "wrong"}).status_code
        for _ in range(throttle.max_attempts() + 1)
    }
    assert 429 in codes
    run(lambda session: throttle.record_success(session, ghost))


@needs_db
def test_the_throttle_table_never_stores_an_address():
    from app import throttle

    email = "privacy-probe@example.test"
    run(lambda session: throttle.record_failure(session, email))
    rows = run(lambda session: session.execute(text("SELECT key_hash FROM auth_throttle"))).all()
    assert rows
    for (key_hash,) in rows:
        assert len(key_hash) == 64
        assert "@" not in key_hash
    run(lambda session: throttle.record_success(session, email))


@needs_db
def test_a_successful_login_clears_earlier_typos():
    from app import throttle

    email = "clearing-probe@example.test"
    run(lambda session: throttle.record_failure(session, email))
    run(lambda session: throttle.record_success(session, email))
    assert run(lambda session: throttle.check(session, email)) is None


@needs_db
def test_expired_throttle_rows_are_purgeable():
    from app import throttle

    stale = "stale-probe@example.test"
    run(lambda session: throttle.record_failure(session, stale))
    old = datetime.now(timezone.utc) - timedelta(days=2)
    run(lambda session: session.execute(
        text("UPDATE auth_throttle SET window_start = :old, blocked_until = NULL WHERE key_hash = :k"),
        {"old": old, "k": throttle.throttle_key(stale)},
    ))
    assert run(lambda session: throttle.purge_expired(session)) >= 1


# --- shop resource dependencies ---------------------------------------------

def test_no_session_or_no_project_means_no_resource_claims():
    """Rewritten: the loader now has to be told which project it is reading for.

    A dependency hangs off an allocation and an SME holds one per project, so an
    unscoped read returned the same resource once per project. With no project
    named there is nothing to claim, exactly as with no session.
    """
    from app.obligations import load_shop_resources

    assert asyncio.run(load_shop_resources(None, [BAAN_SUAN], project_id=DEMO_PROJECT)) == {}
    assert asyncio.run(load_shop_resources(None, [], project_id=DEMO_PROJECT)) == {}
    assert asyncio.run(load_shop_resources(None, [BAAN_SUAN], project_id=None)) == {}


@needs_db
def test_shop_resources_separate_required_from_preference():
    """A required resource is a constraint; a preference is not."""
    from app.obligations import load_shop_resources

    grouped = run(lambda session: load_shop_resources(session, [BAAN_SUAN, RUNG_CHAROEN], project_id=DEMO_PROJECT))
    assert str(BAAN_SUAN) in grouped
    for rows in grouped.values():
        for row in rows:
            assert {"resource_id", "title", "category", "status",
                    "available", "required", "owned_by_shop"} <= set(row)
            assert isinstance(row["required"], bool)
            # Only a confirmed resource counts as secured.
            assert row["available"] == (row["status"] == "confirmed")
    assert any(row["required"] for row in grouped[str(BAAN_SUAN)])


@needs_db
def test_a_shop_with_no_recorded_dependency_is_omitted():
    """Absent is not the same as needing nothing, so the key is left out."""
    from app.obligations import load_shop_resources

    unknown = uuid.UUID("99999999-9999-4999-8999-999999999999")
    grouped = run(lambda session: load_shop_resources(session, [unknown], project_id=DEMO_PROJECT))
    assert str(unknown) not in grouped


# --- the gate actually has to stop the call ---------------------------------

class CountingClient:
    """Stands in for httpx.AsyncClient and records that one was opened.

    Opening a client is the moment a provider call becomes inevitable, so
    counting constructions is what proves the gate held. No request is ever
    sent: `get` raises the same timeout the real provider produces here.
    """

    opened = 0

    def __init__(self, *args, **kwargs):
        type(self).opened += 1

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, *args, **kwargs):
        import httpx

        raise httpx.TimeoutException("blocked by test")


@needs_db
def test_a_shut_gate_serves_the_cache_without_calling_the_provider():
    """The gate exists to stop the call. It has to stop the call.

    A stale cache is the normal state - rows are kept for seven days but count
    as fresh for five minutes - so if the shut-gate branch can still reach the
    network, the backoff never applies to anything and the 429s it was built
    for come straight back.
    """
    import app.industry as industry
    from app import fetch_state
    from app.routers.insights import PROVIDER

    # Close the gate for real, through the same table the route reads.
    run(lambda session: fetch_state.record_failure(session, PROVIDER, "timeout", None))
    gate = run(lambda session: fetch_state.acquire(session, PROVIDER))
    assert gate.allowed is False, "the gate was expected to be shut for this test"
    assert gate.reason == "rate_limited"

    original = industry.httpx.AsyncClient
    CountingClient.opened = 0
    industry.httpx.AsyncClient = CountingClient
    try:
        response = client.get("/api/v1/industry/trends")
    finally:
        industry.httpx.AsyncClient = original

    assert response.status_code == 200
    assert CountingClient.opened == 0, (
        "the gate was shut, yet the route still opened a provider connection"
    )

    body = response.json()
    assert body["data"]["sourceStatus"] == "unavailable"
    assert body["data"]["sourceError"] == "provider_gate_closed"
    # The closed gate is declared rather than hidden behind an empty answer.
    assert any(item.startswith("provider_gate:") for item in body["missing"]), body["missing"]
    assert body["status"] != "ok"

    run(lambda session: fetch_state.record_success(session, PROVIDER))
