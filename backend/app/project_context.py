"""Load explicit order constraints; unknown is never an invented requirement."""

import uuid

from fastapi import HTTPException
from pydantic import Field, model_validator
from sqlalchemy import select

from .catalog import ACTIVE_PROJECT_ORDER
from .models import SmeProfile, SwarmProject
from .obligations import load_shop_resources
from .repository import load_shop_capacities
from .schemas import PositiveMoney, StrictModel
from .swarm import BuyerCollection, Coordinates, SwarmRequest

CONSTRAINT_FIELDS = ("required_business_types", "buyer_coordinates", "max_distance_km", "collection_schedule")


class OrderConstraints(StrictModel):
    required_business_types: list[str] | None = Field(default=None, max_length=30)
    buyer_coordinates: Coordinates | None = None
    max_distance_km: PositiveMoney | None = None
    collection_schedule: list[BuyerCollection] | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_constraints(self):
        if any(not row.strip() for row in self.required_business_types or []):
            raise ValueError("required_business_types cannot contain blank values")
        if self.max_distance_km is not None and self.buyer_coordinates is None:
            raise ValueError("buyer_coordinates are required for a distance limit")
        if self.collection_schedule is not None and sum(row.fraction for row in self.collection_schedule) != 1:
            raise ValueError("Collection fractions must sum to one for the invoice balance")
        return self


def constraint_gaps(values: dict | None) -> list[str]:
    values = values or {}
    missing = [key for key in ("required_business_types", "collection_schedule") if values.get(key) is None]
    if "max_distance_km" not in values:
        missing.append("max_distance_km")
    if values.get("buyer_coordinates") is None and ("max_distance_km" not in values or values.get("max_distance_km") is not None):
        missing.append("buyer_coordinates")
    return missing


async def selected_project(session, project_id: uuid.UUID | None = None, order_ref: str | None = None):
    query = select(SwarmProject)
    if project_id is not None:
        query = query.where(SwarmProject.id == project_id)
    if order_ref is not None:
        query = query.where(SwarmProject.order_ref == order_ref)
    project = await session.scalar(query.order_by(*ACTIVE_PROJECT_ORDER).limit(1))
    if project is None:
        raise HTTPException(404, "No stored order for the selected context")
    return project


async def load_order_context(session, project: SwarmProject) -> tuple[SwarmRequest, list[str]]:
    ids = list((await session.scalars(select(SmeProfile.id).order_by(SmeProfile.id))).all())
    rows = await load_shop_capacities(session, ids)
    if not rows:
        raise HTTPException(404, "No candidate shops")
    resources = await load_shop_resources(session, ids, project_id=project.id)
    constraints = project.constraints or {}
    request = SwarmRequest(
        order_ref=project.order_ref, buyer_name=project.buyer_name,
        target_capacity=project.target_capacity, unit=project.unit, unit_price=project.unit_price,
        duration_days=project.duration_days, payment_terms_days=project.payment_terms_days,
        deposit_ratio=project.deposit_ratio, production_start=project.start_date,
        required_business_types=constraints.get("required_business_types") or [],
        buyer_coordinates=constraints.get("buyer_coordinates"), max_distance_km=constraints.get("max_distance_km"),
        collection_schedule=constraints.get("collection_schedule"),
        shops=[{**row, "resources": resources.get(row["shop_id"])} for row in rows],
    )
    missing = constraint_gaps(project.constraints)
    missing += [f"resources:{shop.shop_id}" for shop in request.shops if shop.resources is None]
    return request, sorted(missing)
