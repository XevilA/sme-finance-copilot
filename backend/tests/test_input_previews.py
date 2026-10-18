import pytest
from pydantic import ValidationError

from app.routers.previews import (
    CashflowPreviewRequest, SalesPreviewRequest, cashflow_preview, sales_preview,
)
from app.main import app


def test_preview_routes_are_mounted_on_documented_api_prefix():
    paths = set(app.openapi()["paths"])
    assert "/api/cashflow/preview" in paths
    assert "/api/sales/preview" in paths


def test_cashflow_preview_uses_only_dated_events_and_is_not_persisted():
    request = CashflowPreviewRequest.model_validate({
        "as_of": "2026-10-01", "opening_cash": "10000", "reserve": "4000",
        "events": [
            {"date": "2026-10-05", "type": "receive_payment", "title": "Invoice paid",
             "amount": "5000", "isInflow": True, "partner": "Buyer"},
            {"date": "2026-10-08", "type": "pay_obligations", "title": "Supplier payment",
             "amount": "12000", "isInflow": False, "partner": "Supplier"},
        ],
    })
    body = cashflow_preview(request)
    assert body["kind"] == "simulated"
    assert body["source"] == "supplied_input"
    assert body["persisted"] is False
    assert body["missing"] == []
    assert [row["projectedCash"] for row in body["data"]] == [15000, 3000]
    assert body["data"][1]["isDeficit"] is True
    assert all(event["status"] == "simulated" for day in body["data"] for event in day["events"])


def test_cashflow_preview_rejects_undated_or_out_of_window_events():
    body = {"as_of": "2026-10-01", "opening_cash": 10000, "reserve": 0,
            "events": [{"date": "2027-01-01", "type": "receive_payment", "title": "Invoice",
                        "amount": 500, "isInflow": True}]}
    with pytest.raises(ValidationError):
        CashflowPreviewRequest.model_validate(body)
    del body["events"][0]["date"]
    with pytest.raises(ValidationError):
        CashflowPreviewRequest.model_validate(body)


def test_sales_preview_computes_product_and_channel_margins():
    request = SalesPreviewRequest.model_validate({
        "products": [{"name": "Tea", "category": "Drinks", "unitsSold": 100,
                      "revenue": "20000", "cost": "12000", "turnoverDays": 7}],
        "channels": [{"channel": "Delivery", "grossSales": "10000", "commissionFee": "1200",
                      "adCost": "300", "deliveryCost": "500"}],
    })
    body = sales_preview(request)
    assert body["kind"] == "simulated"
    assert body["persisted"] is False
    product = body["data"]["products"][0]
    assert product["profit"] == 8000
    assert product["profitMarginPercent"] == 40
    channel = body["data"]["channels"][0]
    assert channel["netProfit"] == 8000
    assert channel["netMarginPercent"] == 80


def test_sales_preview_requires_complete_rows_and_rejects_unknown_fields():
    body = {
        "products": [{"name": "Tea", "category": "Drinks", "unitsSold": 1,
                      "revenue": 10, "cost": 5}],
        "channels": [{"channel": "Shop", "grossSales": 10, "commissionFee": 0,
                      "adCost": 0, "deliveryCost": 0}],
    }
    with pytest.raises(ValidationError):
        SalesPreviewRequest.model_validate(body)
