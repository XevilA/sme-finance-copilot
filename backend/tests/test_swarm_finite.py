from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.order_cash import finite_order_schedule
from app.swarm import ShopCapacity, SwarmRequest, allocate, shop_eligibility


def shop(**updates):
    return {"shop_id": "shop-1", "name": "Shop", "capacity_total": "40", "cost_per_unit": "70",
            "cash_balance": "0", **updates}


def request(**updates):
    return SwarmRequest.model_validate({"order_ref": "FINITE-ORDER", "buyer_name": "Buyer", "target_capacity": "40",
                                       "unit_price": "100", "duration_days": 10, "payment_terms_days": 30,
                                       "shops": [shop()], **updates})


@pytest.mark.parametrize("terms", [0, 30, 365])
def test_finite_order_does_not_add_cost_during_payment_wait(terms):
    result = allocate(request(payment_terms_days=terms))
    assert result["data"]["totalCost"] == 28000
    assert result["data"]["shops"][0]["workingCapitalNeeded"] == 28000
    assert result["data"]["totalFundingGap"] == 28000


@pytest.mark.parametrize("deposit,gap", [("0", 28000), ("0.25", 18000), ("1", 0)])
def test_deposit_is_applied_once_at_the_start(deposit, gap):
    result = allocate(request(deposit_ratio=deposit))
    assert result["data"]["totalFundingGap"] == gap


def test_staged_buyer_collection_reduces_peak_deficit():
    result = allocate(request(collection_schedule=[{"day_index": 5, "fraction": "0.5"}, {"day_index": 40, "fraction": "0.5"}]))
    # Five days of costs precede the first collection: 5 * 40 * 70.
    assert result["data"]["shops"][0]["workingCapitalNeeded"] == 14000
    assert result["data"]["totalFundingGap"] == 14000


def test_real_dates_and_same_day_cost_before_collection():
    schedule = finite_order_schedule(daily_cost=Decimal(2800), revenue=Decimal(40000), duration_days=10,
                                     payment_terms_days=0, deposit_ratio=Decimal(0), start_date=date(2026, 10, 15))
    costs = [row for row in schedule if row["type"] == "production_cost"]
    assert len(costs) == 10
    assert costs[0]["date"] == "2026-10-16"
    assert costs[-1]["date"] == "2026-10-25"
    assert schedule[-2]["type"] == "production_cost"
    assert schedule[-1]["type"] == "buyer_collection"


def test_business_type_and_radius_exclude_unverified_shops():
    coordinates = {"latitude": "0", "longitude": "0"}
    shops = [shop(shop_id="wrong-type", cost_per_unit="1", business_type="packing", coordinates=coordinates),
             shop(shop_id="far", cost_per_unit="2", business_type="food", coordinates={"latitude": "0", "longitude": "1"}),
             shop(shop_id="missing", cost_per_unit="3", business_type="food"),
             shop(shop_id="near", business_type=" FOOD ", coordinates={"latitude": "0", "longitude": "0.1"})]
    data = request(shops=shops, required_business_types=["food"], buyer_coordinates=coordinates, max_distance_km="50")
    assert [row["shopId"] for row in allocate(data)["data"]["shops"]] == ["near"]
    assessment = shop_eligibility(data.shops[1], data)
    assert Decimal(assessment["distance_km"]) == pytest.approx(Decimal("111.19508"), abs=Decimal("0.00001"))
    assert assessment["eligible"] is False


def test_distance_tie_breaking_and_zero_radius():
    origin = {"latitude": "13", "longitude": "100"}
    data = request(shops=[shop(shop_id="far", coordinates={"latitude": "14", "longitude": "100"}), shop(shop_id="near", coordinates=origin)],
                   buyer_coordinates=origin)
    assert allocate(data)["data"]["shops"][0]["shopId"] == "near"
    assert allocate(data.model_copy(update={"max_distance_km": Decimal(0)}))["data"]["shops"][0]["shopId"] == "near"


@pytest.mark.parametrize("updates", [
    {"shops": [shop(), shop(shop_id=" shop-1 ")]},
    {"shops": [shop(capacity_used="41")]},
    {"max_distance_km": "10"},
    {"collection_schedule": [{"day_index": 2, "fraction": "0.9"}]},
    {"shops": [shop(coordinates={"latitude": "NaN", "longitude": "0"})]},
])
def test_invalid_capacity_and_eligibility_inputs(updates):
    with pytest.raises(ValidationError):
        request(**updates)


def test_capacity_validation_is_also_enforced_by_existing_route():
    body = request().model_dump(mode="json")
    for field in ("production_start", "collection_schedule", "required_business_types", "buyer_coordinates", "max_distance_km"):
        body.pop(field)
    body["shops"][0]["capacity_used"] = "41"
    assert TestClient(app).post("/api/swarm", json={**body, "persist": False}).status_code == 422
