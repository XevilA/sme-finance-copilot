"""Routes wiring the logic modules: matching, forecast and industry trends.

These test the seam, not the algorithms - app/matching.py, app/forecasting.py
and app/industry.py have their own suites. What matters here is that stored rows
reach them in the shape they expect, results are reshaped without being
recomputed, and a missing input is declared rather than filled in.

Database-backed cases skip when no database is reachable.
"""

import asyncio
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import DB_ENABLED, session_scope
from app.main import app

client = TestClient(app)

BAAN_SUAN = "11111111-1111-4111-8111-111111111111"
RUNG_CHAROEN = "22222222-2222-4222-8222-222222222222"


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


# --- POST /api/match-funding -------------------------------------------------

@needs_db
def test_match_funding_returns_debt_and_equity_separately():
    body = client.post(f"/api/match-funding?sme_id={BAAN_SUAN}&amount=465000&persist=false").json()
    data = body["data"]
    assert data["funding"] and data["investors"]
    # Debt rows carry a payment and a stressed coverage ratio; equity rows do not.
    assert all("monthly_payment" in row for row in data["funding"])
    assert all("monthly_payment" not in row for row in data["investors"])
    assert all("investor_id" in row for row in data["investors"])


@needs_db
def test_match_funding_carries_the_matcher_disclosure():
    """A ranking must not reach the UI without its own notice attached."""
    data = client.post(f"/api/match-funding?sme_id={BAAN_SUAN}&amount=465000&persist=false").json()["data"]
    for row in data["funding"] + data["investors"]:
        assert row["notice"]
        assert row["policy_version"]


@needs_db
def test_healthy_sme_qualifies_for_loans_and_distressed_one_does_not():
    healthy = client.post(f"/api/match-funding?sme_id={BAAN_SUAN}&amount=465000&persist=false").json()["data"]
    distressed = client.post(f"/api/match-funding?sme_id={RUNG_CHAROEN}&amount=465000&persist=false").json()["data"]

    assert healthy["grade"] == "A"
    assert distressed["grade"] == "D"

    def eligible(rows):
        return [row for row in rows if row["status"] == "eligible"]

    assert len(eligible(healthy["funding"])) > len(eligible(distressed["funding"]))
    # The only facility a grade-D borrower clears is the one with no repayment.
    for row in eligible(distressed["funding"]):
        assert row["monthly_payment"] == "0.00"


@needs_db
def test_match_funding_persists_and_replaces_rather_than_appending():
    first = client.post(f"/api/match-funding?sme_id={RUNG_CHAROEN}&amount=465000").json()
    second = client.post(f"/api/match-funding?sme_id={RUNG_CHAROEN}&amount=465000").json()
    assert first["persisted"]["funding"] == second["persisted"]["funding"] > 0

    async def count() -> int:
        async with session_scope() as session:
            result = await session.execute(
                text("SELECT count(*) FROM funding_matches WHERE sme_id = :s"),
                {"s": RUNG_CHAROEN},
            )
            return result.scalar_one()

    assert asyncio.run(count()) == second["persisted"]["funding"]


def test_match_funding_rejects_a_non_uuid():
    assert client.post("/api/match-funding?sme_id=nope").status_code == 422


@needs_db
def test_match_funding_needs_an_amount_to_match():
    """Baan Suan has no funding gap, so there is nothing to size a facility to."""
    response = client.post(f"/api/match-funding?sme_id={BAAN_SUAN}")
    assert response.status_code == 422
    assert "amount" in response.json()["detail"]


# --- GET /api/v1/funding/options --------------------------------------------

@needs_db
def test_funding_options_uses_matcher_scores():
    body = client.get(f"/api/v1/funding/options?sme_id={BAAN_SUAN}&amount=465000").json()
    assert body["data"]
    assert any(option["matchScore"] > 0 for option in body["data"])
    assert "funding_match_score" not in body["missing"]
    # Best first.
    scores = [option["matchScore"] for option in body["data"]]
    assert scores == sorted(scores, reverse=True)


@needs_db
def test_grant_is_not_amortised_like_a_loan():
    """A 0% grant repays nothing; treating it as a loan produced a payment."""
    body = client.get(f"/api/v1/funding/options?sme_id={BAAN_SUAN}&amount=465000").json()
    grant = next(option for option in body["data"] if option["type"] == "grant")
    assert grant["monthlyPayment"] == 0
    assert grant["totalRepayment"] == 0
    assert "ไม่มีภาระผ่อนชำระ" in grant["impactOnCash"]


@needs_db
def test_total_repayment_spans_the_facility_not_the_reporting_period():
    body = client.get(f"/api/v1/funding/options?sme_id={BAAN_SUAN}&amount=465000").json()
    for option in body["data"]:
        if option["monthlyPayment"]:
            assert option["totalRepayment"] == pytest.approx(
                option["monthlyPayment"] * option["termMonths"], rel=1e-6
            )


@needs_db
def test_funding_options_scores_against_a_resolved_statement():
    """Behaviour changed: with no sme_id it now resolves one rather than
    listing products unranked.

    This screen is about a funding need, so it answers for the SME that has the
    largest stored gap and also has a statement to score. Statement and gap
    always come from the same SME.
    """
    body = client.get("/api/v1/funding/options").json()
    assert body["status"] == "ok"
    assert body["missing"] == []
    assert body["requestedAmount"] > 0
    # Every product carries a verdict and a reason from the matcher.
    for option in body["data"]:
        assert option["status"] in {"eligible", "requires_info", "not_eligible"}
        assert option["matchReason"]
        assert option["notice"]


@needs_db
def test_funding_options_declares_a_missing_statement_when_there_is_none():
    """An SME with no stored statement cannot be scored, and says so."""
    unknown = "99999999-9999-4999-8999-999999999999"
    body = client.get(f"/api/v1/funding/options?sme_id={unknown}&amount=465000").json()
    assert body["status"] == "insufficient_data"
    assert "financial_record_for_matching" in body["missing"]
    assert all(option["matchScore"] == 0 for option in body["data"])


# --- GET /api/forecast -------------------------------------------------------

# The seven cash_events seeded by db/seed.sql, by their fixed ids. Codex
# documented the forecast for exactly this set.
SEEDED_EVENT_IDS = tuple(f"f0000000-0000-4000-8000-00000000000{n}" for n in range(1, 8))


@needs_db
def test_the_forecaster_reproduces_its_documented_demo_values():
    """Pinned at the function, not through the route.

    The route also projects dated receivables and payables and stores the
    result, so the stored event set legitimately grows and the route can no
    longer reproduce a fixed number. The engine still must, for the set it was
    documented against.
    """
    from decimal import Decimal

    from app.forecasting import forecast_cashflow

    async def seeded_events():
        async with session_scope() as session:
            rows = await session.execute(
                text(
                    "SELECT id, sme_id, event_date, day_index, type, title, amount,"
                    " is_inflow, partner, status, impact_reason"
                    " FROM cash_events WHERE id = ANY(:ids) ORDER BY day_index"
                ),
                {"ids": list(SEEDED_EVENT_IDS)},
            )
            return [
                {
                    "id": str(row[0]), "sme_id": str(row[1]), "date": row[2].isoformat(),
                    "dayIndex": row[3], "type": row[4], "title": row[5],
                    "amount": str(row[6]), "isInflow": row[7], "partner": row[8],
                    "status": row[9], "impactReason": row[10],
                }
                for row in rows.all()
            ]

    events = asyncio.run(seeded_events())
    assert len(events) == 7, "the seeded cash events are missing"

    result = forecast_cashflow(
        events,
        opening_cash=Decimal("5000000.00"),
        as_of=date(2026, 9, 30),
        minimum_cash_reserve=Decimal("200000.00"),
        schedule_complete_through=date(2026, 12, 29),
    )
    assert result["minimum_cash"] == "3370000.00"
    assert result["minimum_cash_date"] == "2026-10-25"
    assert result["period_end_balances"] == {
        "30": "3370000.00", "60": "3370000.00", "90": "5770000.00"
    }


@needs_db
def test_the_route_forecast_is_no_higher_than_the_seeded_set_alone():
    """Adding real bills can only lower projected cash, never raise it."""
    body = client.get(
        f"/api/forecast?sme_id={BAAN_SUAN}&as_of=2026-09-30"
        "&schedule_complete_through=2026-12-29"
    ).json()
    assert body["status"] == "ok"
    assert float(body["data"]["minimum_cash"]) <= 3370000.0


@needs_db
def test_forecast_withholds_horizons_until_coverage_is_confirmed():
    """A schedule that merely stops is not a schedule that is complete."""
    body = client.get(f"/api/forecast?sme_id={BAAN_SUAN}&as_of=2026-09-30").json()
    assert body["status"] == "insufficient_data"
    assert "schedule_complete_through" in body["missing"]
    assert all(value is None for value in body["data"]["period_end_balances"].values())
    # Only the conditional view is populated, and it is labelled as such.
    conditional = body["data"]["conditional_period_end_balances"]
    assert conditional["90"] is not None


def test_forecast_rejects_a_non_uuid():
    assert client.get("/api/forecast?sme_id=nope").status_code == 422


@needs_db
def test_forecast_404s_for_an_unknown_sme():
    unknown = "99999999-9999-4999-8999-999999999999"
    assert client.get(f"/api/forecast?sme_id={unknown}").status_code == 404


# --- GET /api/industry/trends -----------------------------------------------

def test_industry_trends_answers_even_when_the_provider_fails(monkeypatch):
    """A provider outage must not become a 500 or an invented headline."""
    from app.routers import insights
    from app.industry import analyze_industry_articles
    monkeypatch.setattr(insights, "DB_ENABLED", False)
    async def unavailable(sector, *, as_of, **kwargs):
        return analyze_industry_articles([], sector, as_of=as_of, source_status="unavailable", source_error="synthetic_timeout")
    monkeypatch.setattr(insights, "fetch_industry_trends", unavailable)
    body = client.get("/api/industry/trends?sector=food_processing").json()
    assert body["status"] in {"ok", "empty", "stale", "unavailable"}
    assert isinstance(body["data"]["articles"], list)
    if body["status"] == "unavailable":
        assert body["data"]["articles"] == []
        assert body["data"]["findings"] == []
        assert "industry_news" in body["missing"]


def test_industry_trends_never_invents_a_publication_date(monkeypatch):
    from app.routers import insights
    from app.industry import analyze_industry_articles
    monkeypatch.setattr(insights, "DB_ENABLED", False)
    async def supplied_article(sector, *, as_of, **kwargs):
        return analyze_industry_articles([{
            "id": "a" * 64, "provider": "gdelt", "sector": sector, "source": "example.test",
            "url": "https://example.test/synthetic-publication-evidence", "title": "Synthetic publication fixture",
            "published_at": None, "observed_at": as_of.isoformat(), "fetched_at": as_of.isoformat(),
            "date_source": "gdelt_first_seen", "status": "fresh",
        }], sector, as_of=as_of, source_status="live")
    monkeypatch.setattr(insights, "fetch_industry_trends", supplied_article)
    body = client.get("/api/industry/trends?sector=food_processing").json()
    assert body["data"]["articles"]
    for article in body["data"]["articles"]:
        if article["published_at"] is None:
            assert article["observed_at"] or article["date_source"]


@needs_db
def test_news_cache_upsert_is_idempotent_and_keeps_published_at_null():
    from app.news_cache import load_cached_articles, upsert_articles

    now = datetime.now(timezone.utc).isoformat()
    article = {
        "id": "f" * 64, "sector": "wiring_test", "provider": "gdelt",
        "source": "example.test", "url": "https://example.test/one",
        "title": "Row one", "published_at": None, "observed_at": now,
        "fetched_at": now, "date_source": "gdelt_first_seen", "status": "fresh",
    }

    async def run():
        async with session_scope() as session:
            first = await upsert_articles(session, [article])
        async with session_scope() as session:
            second = await upsert_articles(session, [article])
        async with session_scope() as session:
            cached = await load_cached_articles(session, "wiring_test")
        async with session_scope() as session:
            await session.execute(
                text("DELETE FROM industry_news WHERE sector = 'wiring_test'")
            )
        return first, second, cached

    first, second, cached = asyncio.run(run())
    assert first == second == 1
    assert len(cached) == 1, "a second ingest must update the row, not add one"
    assert cached[0]["published_at"] is None


# --- POST /api/swarm forwarding ---------------------------------------------

def shop(shop_id, cost, **extra):
    row = {
        "shop_id": shop_id, "name": shop_id, "capacity_total": "600",
        "capacity_used": "0", "cost_per_unit": cost,
        "cash_balance": "5000000.00", "minimum_cash_reserve": "0.00",
    }
    row.update(extra)
    return row


def order(**overrides):
    body = {
        "order_ref": "PO-WIRING-001", "buyer_name": "Siam Retail Group",
        "target_capacity": "500", "unit_price": "100.00", "duration_days": 10,
        "payment_terms_days": 30, "deposit_ratio": "0", "persist": False,
        "shops": [shop("shop-a", "60.00")],
    }
    body.update(overrides)
    return body


def test_duplicate_shop_ids_are_a_422_not_a_500():
    """The engine validator fires after SwarmBody, so it must be translated."""
    body = order(shops=[shop("same", "60.00"), shop("same", "70.00")])
    assert client.post("/api/swarm", json=body).status_code == 422


def test_capacity_used_above_total_is_rejected():
    body = order(shops=[shop("shop-a", "60.00", capacity_total="100", capacity_used="200")])
    assert client.post("/api/swarm", json=body).status_code == 422


def test_distance_filter_is_forwarded_to_the_engine():
    near = shop("near", "60.00", coordinates={"latitude": "13.75", "longitude": "100.50"})
    far = shop("far", "55.00", coordinates={"latitude": "18.79", "longitude": "98.98"})
    body = order(
        target_capacity="1000",
        shops=[near, far],
        buyer_coordinates={"latitude": "13.75", "longitude": "100.50"},
        max_distance_km="50",
    )
    data = client.post("/api/swarm", json=body).json()["data"]
    assigned = {row["shopId"] for row in data["shops"]}
    # Chiang Mai is roughly 580 km from Bangkok, so it fails a 50 km radius
    # even though it is the cheaper shop.
    assert "near" in assigned
    assert "far" not in assigned


def test_required_business_type_is_forwarded():
    body = order(
        shops=[shop("baker", "60.00", business_type="food_processing"),
               shop("printer", "50.00", business_type="packaging")],
        required_business_types=["food_processing"],
    )
    data = client.post("/api/swarm", json=body).json()["data"]
    assert {row["shopId"] for row in data["shops"]} == {"baker"}


def test_production_start_dates_the_audit_schedule():
    body = order(production_start="2026-11-01")
    envelope = client.post("/api/swarm", json=body).json()
    assert envelope["data"]["shops"]
    assert envelope["audit"]["engine"].endswith("v2")
