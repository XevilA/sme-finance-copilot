"""The eleven database-backed /api/v1 GET contracts, plus full coverage of all sixteen.

These are the paths src/api/client.ts calls. Shapes come from
src/api/contracts/types.ts. The tests that need stored rows skip when no
database is reachable; the shape and no-404 guarantees are checked either way.
"""

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text

from app.db import DB_ENABLED, session_scope
from app.main import app
from app.models import SwarmProject

client = TestClient(app)

BAAN_SUAN = "11111111-1111-4111-8111-111111111111"
RUNG_CHAROEN = "22222222-2222-4222-8222-222222222222"
DEMO_ORDER = "PO-STP-2026-091"

# Every path the deployed client calls, with the arguments it would send.
ALL_CONTRACTS = [
    "/overview",
    "/cashflow/timeline",
    "/shops",
    "/order",
    "/swarm/proposal",
    f"/shops/{BAAN_SUAN}/finance",
    "/funding/options",
    "/unlock/resources",
    "/simulator/chaos",
    "/health/indicators",
    "/cost/breakdown",
    "/sales/products",
    "/sales/channels",
    "/funder/projects",
    "/projects",
    "/ai/explain?page=health",
]


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


def get(path: str) -> dict:
    response = client.get(f"/api/v1{path}")
    assert response.status_code == 200, f"{path} -> {response.status_code}"
    return response.json()


# --- the whole surface -------------------------------------------------------

def test_no_frontend_contract_returns_404():
    """The regression this work exists for: all sixteen used to 404."""
    for path in ALL_CONTRACTS:
        assert client.get(f"/api/v1{path}").status_code == 200, path


def test_every_contract_returns_an_envelope_with_provenance():
    for path in ALL_CONTRACTS:
        body = get(path)
        assert {"data", "kind", "status", "missing"} <= set(body), path
        assert "source" in body, f"{path} does not say where its data came from"
        assert body["source"] in {"stored_record", "demo_dataset", "none"}


def test_status_never_claims_ok_while_data_is_missing():
    for path in ALL_CONTRACTS:
        body = get(path)
        expected = "insufficient_data" if body["missing"] else "ok"
        assert body["status"] == expected, path


def test_contracts_are_served_without_the_v1_prefix_too():
    for path in ALL_CONTRACTS:
        assert client.get(f"/api{path}").status_code == 200, path


# --- /shops ------------------------------------------------------------------

@needs_db
def test_shops_shape_and_available_capacity():
    body = get("/shops")
    assert body["data"]
    for shop in body["data"]:
        assert {"id", "name", "monogram", "category", "capacityTotal", "capacityUsed",
                "capacityAvailable", "unit", "status", "statusNote", "costPerUnit",
                "workingCapitalNeeded", "currentCash", "fundingGap", "location", "tags"} <= set(shop)
        assert shop["status"] in {"ready", "review", "blocked"}
        assert shop["capacityAvailable"] == shop["capacityTotal"] - shop["capacityUsed"]
        assert isinstance(shop["tags"], list)


# --- /order ------------------------------------------------------------------

@needs_db
def test_order_totals_follow_from_quantity_and_price():
    data = get("/order")["data"]
    assert data["totalQuantity"] == data["quantityPerDay"] * data["days"]
    assert data["budgetTotal"] == pytest.approx(data["totalQuantity"] * data["unitPrice"])


# --- /shops/{id}/finance -----------------------------------------------------

@needs_db
def test_shop_finance_itemises_cost_and_reconciles_profit():
    body = get(f"/shops/{BAAN_SUAN}/finance?order_ref={DEMO_ORDER}")
    data = body["data"]
    assert body["missing"] == []
    lines = (data["rawMaterialCost"] + data["additionalLaborCost"]
             + data["deliveryCost"] + data["serviceFee"])
    assert data["totalCost"] == pytest.approx(lines)
    assert data["projectedProfit"] == pytest.approx(data["revenue"] - data["totalCost"])
    assert data["revenue"] == pytest.approx(data["totalBoxes"] * data["sellingPricePerBox"])
    assert data["totalBoxes"] == pytest.approx(data["boxesPerDay"] * 30)


@needs_db
def test_shop_finance_cash_timeline_runs_a_real_balance():
    data = get(f"/shops/{BAAN_SUAN}/finance?order_ref={DEMO_ORDER}")["data"]
    timeline = data["cashTimeline"]
    assert timeline
    balance = data["currentCash"]
    for row in timeline:
        event_amount = row["amount"]
        # Each row carries the balance after its own movement.
        assert row["cashBalance"] == pytest.approx(balance + event_amount) or \
               row["cashBalance"] == pytest.approx(balance - event_amount)
        balance = row["cashBalance"]
    assert [row["dayIndex"] for row in timeline] == sorted(row["dayIndex"] for row in timeline)


@needs_db
def test_shop_finance_declares_party_signoff():
    data = get(f"/shops/{BAAN_SUAN}/finance?order_ref={DEMO_ORDER}")["data"]
    assert set(data["partyAcceptance"]) == {"buyerSigned", "shopSigned", "logisticsSigned", "funderSigned"}


@needs_db
def test_shop_finance_answers_an_unknown_id_with_an_envelope():
    """Behaviour changed: this was a 422.

    Every other contract answers with an envelope and the UI renders its own
    empty state from one, so a screen still holding a mock id like "shop-1"
    used to surface an error instead of an empty panel.
    """
    response = client.get("/api/v1/shops/not-a-uuid/finance")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "insufficient_data"
    assert "unknown_shop_id" in body["missing"]


# --- /cashflow/timeline ------------------------------------------------------

@needs_db
def test_cashflow_timeline_balance_is_cumulative():
    body = get(f"/cashflow/timeline?sme_id={BAAN_SUAN}")
    days = body["data"]
    assert days
    for day in days:
        assert {"date", "dayIndex", "projectedCash", "reserveLine", "inflow",
                "outflow", "netChange", "isDeficit", "events"} <= set(day)
        assert day["netChange"] == pytest.approx(day["inflow"] - day["outflow"])
        assert day["events"]
    for earlier, later in zip(days, days[1:]):
        assert later["projectedCash"] == pytest.approx(earlier["projectedCash"] + later["netChange"])


@needs_db
def test_cashflow_timeline_flags_a_dip_below_the_reserve():
    days = get(f"/cashflow/timeline?sme_id={BAAN_SUAN}")["data"]
    for day in days:
        assert day["isDeficit"] == (day["projectedCash"] < day["reserveLine"])


@needs_db
def test_cashflow_timeline_does_not_fabricate_the_actual_series():
    """actualCash and simulatedCash are separate series the rows cannot tell apart."""
    body = get(f"/cashflow/timeline?sme_id={BAAN_SUAN}")
    assert "actual_vs_simulated_cash_series" in body["missing"]
    assert all("actualCash" not in day for day in body["data"])


# --- /funding/options -------------------------------------------------------

@needs_db
def test_funding_options_shape_and_repayment_arithmetic():
    body = get("/funding/options?amount=465000")
    assert body["data"]
    for option in body["data"]:
        assert {"id", "name", "provider", "type", "typeLabel", "maxAmount", "minAmount",
                "interestRateAnnual", "termMonths", "disbursementDays", "monthlyPayment",
                "totalRepayment", "impactOnCash", "requiredDocs", "eligibilityConditions",
                "matchScore", "matchReason", "status"} <= set(option)
        assert option["status"] in {"eligible", "requires_info", "not_eligible"}
        assert option["totalRepayment"] == pytest.approx(option["monthlyPayment"] * option["termMonths"], rel=1e-6)


@needs_db
def test_grant_carries_no_repayment():
    """Behaviour changed: the grant used to be amortised like a 0% loan.

    Repayment now comes from the matcher, which treats a grant as having no
    debt service at all, so there is no installment to show.
    """
    options = get(f"/funding/options?sme_id={BAAN_SUAN}&amount=465000")["data"]
    grant = next(o for o in options if o["type"] == "grant")
    assert grant["monthlyPayment"] == 0
    assert grant["totalRepayment"] == 0


@needs_db
def test_amount_outside_a_product_range_is_not_eligible():
    """The reason text now comes from the matcher, so only the verdict is asserted."""
    options = get(f"/funding/options?sme_id={BAAN_SUAN}&amount=20000")["data"]
    too_small = [o for o in options if 20000 < o["minAmount"]]
    assert too_small, "expected at least one product with a higher minimum"
    for option in too_small:
        assert option["status"] == "not_eligible"
        assert option["matchReason"]


@needs_db
def test_match_score_now_comes_from_the_matcher():
    """Behaviour changed: the matcher module exists, so the score is real.

    It was previously returned as 0 with funding_match_score declared missing,
    because no ranking logic existed yet.
    """
    body = get(f"/funding/options?sme_id={BAAN_SUAN}&amount=465000")
    assert "funding_match_score" not in body["missing"]
    assert any(option["matchScore"] > 0 for option in body["data"])
    assert all(option["notice"] for option in body["data"])


# --- /sales/* ----------------------------------------------------------------

@needs_db
def test_sales_products_profit_and_velocity():
    body = get(f"/sales/products?sme_id={BAAN_SUAN}")
    assert body["data"]
    for row in body["data"]:
        assert {"id", "name", "category", "unitsSold", "revenue", "cost", "profit",
                "profitMarginPercent", "turnoverDays", "velocity"} <= set(row)
        assert row["profit"] == pytest.approx(row["revenue"] - row["cost"])
        assert row["velocity"] in {"fast", "normal", "slow"}
        if row["turnoverDays"] and row["turnoverDays"] > 21:
            assert row["velocity"] == "slow"


@needs_db
def test_sales_channels_net_profit_subtracts_every_stated_cost():
    body = get(f"/sales/channels?sme_id={BAAN_SUAN}")
    assert body["data"]
    for row in body["data"]:
        expected = row["grossSales"] - row["commissionFee"] - row["adCost"] - row["deliveryCost"]
        assert row["netProfit"] == pytest.approx(expected)
    # Cost of goods is not split per channel, so that limit is declared.
    assert "channel_cost_of_goods_split" in body["missing"]


# --- /unlock/resources and /simulator/chaos ----------------------------------

@needs_db
def test_unlock_resources_shape_and_detach_impact():
    body = get("/unlock/resources")
    assert body["data"]
    for row in body["data"]:
        assert {"id", "title", "category", "categoryLabel", "ownerShop", "location",
                "capacityText", "priceText", "unitPrice", "availability", "status",
                "impactIfDetached"} <= set(row)
        assert row["category"] in {"kitchen", "truck", "machine", "team", "space"}
        assert row["status"] in {"offered", "confirmed"}
        assert {"additionalCost", "delayDays", "bottleneckMessage", "affectedShopIds"} <= set(row["impactIfDetached"])


@needs_db
def test_chaos_scenarios_shape():
    body = get("/simulator/chaos")
    assert body["data"]
    for row in body["data"]:
        assert {"id", "title", "category", "severity", "description", "triggerNodeId",
                "propagationPath", "cashImpactAmount", "deficitDays",
                "contingencyOptions", "calculatedResults"} <= set(row)
        assert row["severity"] in {"low", "medium", "high"}
        assert {"revenueLoss", "additionalCost", "newDeficitAmount",
                "deliveryDelayDays"} <= set(row["calculatedResults"])
        for option in row["contingencyOptions"]:
            assert {"id", "title", "actionText", "savingsOrMitigation", "targetPage"} <= set(option)


# --- /projects and /funder/projects -----------------------------------------

@needs_db
def test_project_records_shape_and_status_union():
    body = get("/projects")
    assert body["data"]
    allowed = {"draft", "under_review", "pending_approval", "in_progress", "completed", "issue"}
    for row in body["data"]:
        assert {"id", "code", "title", "clientName", "status", "statusText",
                "progressPercent", "version", "totalBudget", "totalShops",
                "startDate", "deliveryDate", "deliverySchedule"} <= set(row)
        assert row["status"] in allowed, row["status"]
        for day in row["deliverySchedule"]:
            assert day["status"] in {"done", "on_schedule", "delayed"}


@needs_db
def test_funder_projects_recommendation_follows_the_evidence():
    body = get("/funder/projects")
    assert body["data"]
    for row in body["data"]:
        assert {"id", "title", "enterpriseName", "targetFunding", "fundingGap",
                "evidenceDocuments", "riskLevel", "recommendationDecision",
                "recommendationNote", "allocationRecommended", "hasAccessPermission"} <= set(row)
        assert row["recommendationDecision"] in {
            "recommend", "insufficient_data", "reduced_amount_possible", "not_recommended"
        }
        # A recommendation requires every document verified.
        if row["recommendationDecision"] == "recommend":
            assert row["evidenceDocuments"]
            assert all(document["verified"] for document in row["evidenceDocuments"])
            assert row["allocationRecommended"] is True
        else:
            assert row["allocationRecommended"] is False


@needs_db
def test_funder_projects_without_evidence_are_not_recommended():
    project_id = uuid.uuid4()
    order_ref = f"NO-EVIDENCE-{project_id.hex}"

    async def create(session):
        session.add(SwarmProject(
            id=project_id,
            order_ref=order_ref,
            buyer_name="Synthetic buyer without evidence",
            target_capacity=10,
            unit_price=100,
            duration_days=2,
            payment_terms_days=30,
        ))

    async def cleanup(session):
        await session.execute(delete(SwarmProject).where(SwarmProject.id == project_id))

    async def run(operation):
        async with session_scope() as session:
            await operation(session)

    asyncio.run(run(create))
    try:
        rows = get("/funder/projects")["data"]
        row = next(item for item in rows if item["id"] == str(project_id))
        assert row["evidenceDocuments"] == []
        assert row["recommendationDecision"] == "insufficient_data"
        assert row["allocationRecommended"] is False
    finally:
        asyncio.run(run(cleanup))
