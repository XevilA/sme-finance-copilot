"""POST /api/swarm - allocate one buyer order across SME shops.

Shops can be supplied inline (demo / stateless) or by sme_ids, which are read
from sme_profiles. Inline shops win when both are given.
"""

from datetime import date
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import Field, ValidationError
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..obligations import load_shop_resources
from ..repository import (
    load_project_id,
    load_shop_capacities,
    load_swarm_project,
    parse_uuid,
    save_swarm_proposal,
)
from ..schemas import StrictModel
from ..swarm import BuyerCollection, Coordinates, ShopCapacity, SwarmRequest, allocate
from ..models import SharedResource, SwarmProject
from ..project_context import CONSTRAINT_FIELDS, constraint_gaps
from ..context import fingerprint

router = APIRouter(tags=["swarm"])


class SwarmBody(StrictModel):
    project_id: uuid.UUID | None = None
    input_revision: str | None = Field(default=None, min_length=1, max_length=100)
    input_hash: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    order_ref: str
    buyer_name: str
    target_capacity: float | int | str
    unit: str = "box"
    unit_price: float | int | str
    duration_days: int = Field(strict=True, gt=0, le=3650)
    payment_terms_days: int = Field(default=30, strict=True, ge=0, le=365)
    deposit_ratio: float | int | str = 0
    shops: list[ShopCapacity] = []
    sme_ids: list[str] = []
    persist: bool = True
    # Finite-order and eligibility inputs, passed straight through to the engine.
    production_start: date | None = None
    collection_schedule: list[BuyerCollection] | None = None
    required_business_types: list[str] = []
    buyer_coordinates: Coordinates | None = None
    max_distance_km: float | int | str | None = None


@router.post("/swarm")
async def build_swarm(body: SwarmBody) -> dict:
    shops = body.shops
    stored_constraints = None
    selected_id = None
    if DB_ENABLED:
        async with session_scope() as session:
            stored = await session.scalar(select(SwarmProject).where(SwarmProject.order_ref == body.order_ref))
            stored_constraints = None if stored is None else stored.constraints
            selected_id = None if stored is None else stored.id
    if body.project_id is not None:
        if not DB_ENABLED:
            raise HTTPException(503, "Project identity requires DATABASE_URL")
        if selected_id != body.project_id:
            raise HTTPException(409, "project_id and order_ref differ")
    constraint_values = {key: getattr(body, key) for key in CONSTRAINT_FIELDS}
    # A stored restriction may not be bypassed by a client omitting it.
    for key in CONSTRAINT_FIELDS:
        if key not in body.model_fields_set and stored_constraints and key in stored_constraints:
            constraint_values[key] = stored_constraints[key]
    if not shops:
        if not body.sme_ids:
            raise HTTPException(status_code=422, detail="Provide either shops or sme_ids")
        ids = [parse_uuid(item) for item in body.sme_ids]
        if any(value is None for value in ids) or len(set(ids)) != len(ids):
            raise HTTPException(status_code=422, detail="sme_ids must be UUIDs")
        if not DB_ENABLED:
            raise HTTPException(status_code=503, detail="sme_ids require DATABASE_URL; send shops inline instead")
        async with session_scope() as session:
            rows = await load_shop_capacities(session, ids)
            # Dependencies belong to an allocation, so they are read for the
            # project this order_ref already has. A new order has none recorded.
            project_id = await load_project_id(session, body.order_ref)
            resources = await load_shop_resources(session, ids, project_id=project_id)
        if len(rows) != len(ids):
            raise HTTPException(status_code=404, detail="No matching sme_profiles")
        # A shop absent from the map gets None, not []: the engine treats
        # "nothing recorded" and "depends on nothing" as different answers, and
        # only the second one is a claim we are entitled to make.
        shops = [
            ShopCapacity.model_validate({**row, "resources": resources.get(row["shop_id"])})
            for row in rows
        ]

    # The engine owns the cross-field rules (duplicate shop ids, capacity used
    # above total, a collection schedule that does not sum to one). Those fire
    # when SwarmRequest is constructed, which is after SwarmBody has already
    # validated, so the error is translated here rather than surfacing as a 500.
    try:
        request = SwarmRequest(
            order_ref=body.order_ref,
            buyer_name=body.buyer_name,
            target_capacity=body.target_capacity,
            unit=body.unit,
            unit_price=body.unit_price,
            duration_days=body.duration_days,
            payment_terms_days=body.payment_terms_days,
            deposit_ratio=body.deposit_ratio,
            shops=shops,
            production_start=body.production_start,
            **{**constraint_values, "required_business_types": constraint_values["required_business_types"] or []},
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_context=False, include_input=False),
        ) from exc

    envelope = await run_in_threadpool(allocate, request)
    envelope["context"] = {"projectId": str(selected_id) if selected_id else None,
                           "orderRef": request.order_ref, "inputRevision": body.input_revision,
                           "inputHash": body.input_hash, "orderHash": fingerprint(request.model_dump(mode="json"))}
    if selected_id is not None:
        from fastapi.encoders import jsonable_encoder
        explicit = {**(stored_constraints or {}), **{
            key: jsonable_encoder(constraint_values[key]) for key in CONSTRAINT_FIELDS if key in body.model_fields_set
        }}
        missing = constraint_gaps(explicit)
        missing += [f"resources:{shop.shop_id}" for shop in request.shops if shop.resources is None]
        envelope["missing"] = sorted(set(envelope["missing"] + missing))
        if envelope["missing"]:
            envelope["status"] = "insufficient_data"
        envelope["audit"]["suitabilityVerified"] = not missing

    project_id = None
    if body.persist and DB_ENABLED:
        async with session_scope() as session:
            # A supplied snapshot cannot confirm a resource in the database.
            for shop in request.shops:
                for dependency in shop.resources or []:
                    resource_id = parse_uuid(dependency.resource_id)
                    resource = await session.get(SharedResource, resource_id) if resource_id else None
                    if resource is None or resource.status != dependency.status or dependency.available != (resource.status == "confirmed"):
                        raise HTTPException(409, "Resource snapshot differs from stored availability; reload context")
            payload = request.model_dump()
            payload["_provided"] = list(body.model_fields_set)
            project_id = await save_swarm_proposal(session, payload, envelope["data"])

    envelope["projectId"] = str(project_id) if project_id else None
    envelope["persisted"] = project_id is not None
    return envelope


@router.get("/swarm/{order_ref}")
async def get_swarm(order_ref: str) -> dict:
    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="Reading a stored proposal requires DATABASE_URL")
    async with session_scope() as session:
        project = await load_swarm_project(session, order_ref)
    if project is None:
        raise HTTPException(status_code=404, detail="Unknown order_ref")
    return {"data": project, "kind": "actual", "source": "database", "status": "ok", "missing": []}
