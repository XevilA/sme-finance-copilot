from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.swarm import ShopCapacity, SwarmRequest, allocate, shop_eligibility


def resource(**changes):
    return {"resource_id": "cold-truck", "title": "Cold truck", "category": "transport",
            "status": "confirmed", "available": True, "required": True, **changes}


def shop(**changes):
    return {"shop_id": "shop-1", "name": "Shop", "capacity_total": "40", "cost_per_unit": "70", **changes}


def request(shops):
    return SwarmRequest.model_validate({"order_ref": "RESOURCES", "buyer_name": "Buyer", "target_capacity": "40",
        "unit_price": "100", "duration_days": 10, "payment_terms_days": 30, "shops": shops})


@pytest.mark.parametrize("resources,status", [(None, "unknown"), ([], "known_empty"), ([resource()], "checked")])
def test_unknown_empty_and_confirmed_resources_are_distinct_and_eligible(resources, status):
    req = request([shop(resources=resources)])
    result = shop_eligibility(req.shops[0], req)
    assert result["eligible"]
    assert result["resource_status"] == status
    assert result["resource_unknowns"] == (["resource_dependencies"] if resources is None else [])


@pytest.mark.parametrize("status,available", [("offered", False), ("offered", True), ("confirmed", False), ("unavailable", False)])
def test_required_unsecured_resource_excludes_shop_even_if_owned(status, available):
    req = request([shop(resources=[resource(status=status, available=available, owned_by_shop=True)])])
    result = allocate(req)
    item = result["audit"]["eligibility"]["shop-1"]
    assert not item["eligible"]
    assert item["missing_resources"][0]["resource_id"] == "cold-truck"
    assert "cold-truck" in item["reasons"][0]
    assert result["data"]["shops"] == []
    assert result["data"]["status"] == "incomplete"


def test_unavailable_preference_does_not_exclude_or_change_financials():
    baseline = allocate(request([shop()]))
    result = allocate(request([shop(resources=[resource(required=False, status="offered", available=False)])]))
    assert result["data"] == baseline["data"]
    item = result["audit"]["eligibility"]["shop-1"]
    assert item["eligible"] and not item["missing_resources"]
    assert item["unavailable_preferences"][0]["resource_id"] == "cold-truck"


def test_excluded_shop_cannot_displace_a_more_expensive_eligible_shop():
    result = allocate(request([shop(resources=[resource(status="offered", available=False)]),
        shop(shop_id="shop-2", cost_per_unit="80", resources=[])]))
    assert [item["shopId"] for item in result["data"]["shops"]] == ["shop-2"]
    assert result["data"]["totalCost"] == 32000
    assert result["audit"]["eligibility"]["shop-1"]["missing_resources"]


def test_every_shop_is_audited_even_after_target_is_met():
    req = request([shop(), shop(shop_id="shop-2", resources=[resource(status="offered", available=False)])])
    before = deepcopy(req.model_dump())
    result = allocate(req)
    assert set(result["audit"]["eligibility"]) == {"shop-1", "shop-2"}
    assert req.model_dump() == before


@pytest.mark.parametrize("resources", [[resource(), resource()], [resource(available="true")], [resource(required=1)]])
def test_resource_contract_rejects_ambiguous_duplicates_and_non_boolean_flags(resources):
    with pytest.raises(ValidationError):
        ShopCapacity.model_validate(shop(resources=resources))
