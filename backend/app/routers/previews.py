"""Stateless input previews for cash schedules and product/channel margins."""

from datetime import date
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter
from pydantic import Field, model_validator

from .. import adapters, adapters_catalog
from ..schemas import PositiveMoney, StrictModel

router = APIRouter(tags=["input-previews"])


class CashEventInput(StrictModel):
    date: date
    type: Literal["buy_materials", "produce", "deliver", "receive_payment", "pay_obligations"]
    title: str = Field(min_length=1, max_length=120)
    amount: PositiveMoney
    isInflow: bool
    partner: str = Field(default="", max_length=120)
    impactReason: str = Field(default="User-entered preview assumption", max_length=240)

    @model_validator(mode="after")
    def validate_direction(self):
        if self.isInflow != (self.type == "receive_payment"):
            raise ValueError("Only receive_payment events can be cash inflows")
        return self


class CashflowPreviewRequest(StrictModel):
    as_of: date
    opening_cash: PositiveMoney
    reserve: PositiveMoney
    events: list[CashEventInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_dates(self):
        for event in self.events:
            days = (event.date - self.as_of).days
            if days < 1 or days > 90:
                raise ValueError("Every event date must be 1 to 90 days after as_of")
        return self


class ProductInput(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    unitsSold: int = Field(ge=0, le=1_000_000_000)
    revenue: PositiveMoney
    cost: PositiveMoney
    turnoverDays: int = Field(ge=0, le=3650)


class ChannelInput(StrictModel):
    channel: str = Field(min_length=1, max_length=120)
    grossSales: PositiveMoney
    commissionFee: PositiveMoney
    adCost: PositiveMoney
    deliveryCost: PositiveMoney


class SalesPreviewRequest(StrictModel):
    products: list[ProductInput] = Field(min_length=1, max_length=100)
    channels: list[ChannelInput] = Field(min_length=1, max_length=100)


@router.post("/cashflow/preview")
def cashflow_preview(request: CashflowPreviewRequest) -> dict:
    """Build a 90-day schedule only from explicitly entered dated events."""
    events = []
    for item in request.events:
        event_date = item.date.isoformat()
        events.append({
            "id": str(uuid4()), "date": event_date,
            "dayIndex": (item.date - request.as_of).days,
            "type": item.type, "title": item.title.strip(),
            "amount": float(item.amount), "isInflow": item.isInflow,
            "partner": item.partner.strip(), "status": "simulated",
            "impactReason": item.impactReason.strip(),
        })
    data, _ = adapters_catalog.cashflow_timeline(
        events, float(request.opening_cash), float(request.reserve)
    )
    for day in data:
        day["simulatedCash"] = day["projectedCash"]
        for event in day["events"]:
            event["status"] = "simulated"
    return adapters.envelope(
        data, "simulated", [], request.as_of.isoformat(),
        source="supplied_input", persisted=False,
    )


@router.post("/sales/preview")
def sales_preview(request: SalesPreviewRequest) -> dict:
    """Calculate product and channel margins from explicit user-supplied rows."""
    product_rows = [
        {"id": f"preview-{index + 1}", "name": row.name.strip(),
         "category": row.category.strip(), "unitsSold": row.unitsSold,
         "revenue": float(row.revenue), "cost": float(row.cost),
         "turnoverDays": row.turnoverDays}
        for index, row in enumerate(request.products)
    ]
    channel_rows = [
        {"channel": row.channel.strip(), "grossSales": float(row.grossSales),
         "commissionFee": float(row.commissionFee), "adCost": float(row.adCost),
         "deliveryCost": float(row.deliveryCost)}
        for row in request.channels
    ]
    products, _ = adapters_catalog.sales_products(product_rows)
    channels, _ = adapters_catalog.sales_channels(channel_rows)
    return adapters.envelope(
        {"products": products, "channels": channels}, "simulated", [], "",
        source="supplied_input", persisted=False,
    )
