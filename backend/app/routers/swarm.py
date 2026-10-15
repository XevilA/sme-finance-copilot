"""POST /api/swarm - allocate one buyer order across SME shops.

Shops can be supplied inline (demo / stateless) or by sme_ids, which are read
from sme_profiles. Inline shops win when both are given.
"""

from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..repository import load_shop_capacities, load_swarm_project, parse_uuid, save_swarm_proposal
from ..schemas import StrictModel
from ..swarm import BuyerCollection, Coordinates, ShopCapacity, SwarmRequest, allocate

router = APIRouter(tags=["swarm"])


class SwarmBody(StrictModel):
    order_ref: str
    buyer_name: str
    target_capacity: float | int | str
    unit: str = "box"
    unit_price: float | int | str
    duration_days: int
    payment_terms_days: int = 30
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
    if not shops:
        if not body.sme_ids:
            raise HTTPException(status_code=422, detail="Provide either shops or sme_ids")
        ids = [value for value in (parse_uuid(item) for item in body.sme_ids) if value is not None]
        if not ids:
            raise HTTPException(status_code=422, detail="sme_ids must be UUIDs")
        if not DB_ENABLED:
            raise HTTPException(status_code=503, detail="sme_ids require DATABASE_URL; send shops inline instead")
        async with session_scope() as session:
            rows = await load_shop_capacities(session, ids)
        if not rows:
            raise HTTPException(status_code=404, detail="No matching sme_profiles")
        shops = [ShopCapacity.model_validate(row) for row in rows]

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
            collection_schedule=body.collection_schedule,
            required_business_types=body.required_business_types,
            buyer_coordinates=body.buyer_coordinates,
            max_distance_km=body.max_distance_km,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_context=False, include_input=False),
        ) from exc

    envelope = await run_in_threadpool(allocate, request)

    project_id = None
    if body.persist and DB_ENABLED:
        async with session_scope() as session:
            project_id = await save_swarm_proposal(session, request.model_dump(), envelope["data"])

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
    return {"data": project, "kind": "actual", "status": "ok", "missing": []}
