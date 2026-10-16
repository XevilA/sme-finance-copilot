"""Statement and finite-order Plan A/B comparisons (Module 6)."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..repository import parse_uuid, save_simulation
from ..simulate import SimulateRequest, simulate
from ..order_simulation import OrderSimulationRequest, simulate_order
from ..catalog import ACTIVE_PROJECT_ORDER
from ..models import SwarmProject, SmeProfile
from ..obligations import load_shop_resources
from ..repository import load_project_id, load_shop_capacities
from ..swarm import SwarmRequest
from sqlalchemy import select

router = APIRouter(tags=["simulate"])


@router.get("/simulator/context")
async def order_context() -> dict:
    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="Order context requires DATABASE_URL")
    async with session_scope() as session:
        project = await session.scalar(select(SwarmProject).order_by(*ACTIVE_PROJECT_ORDER).limit(1))
        if project is None:
            raise HTTPException(status_code=404, detail="No stored order")
        ids = list((await session.scalars(select(SmeProfile.id).order_by(SmeProfile.id))).all())
        rows = await load_shop_capacities(session, ids)
        if not rows:
            raise HTTPException(status_code=404, detail="No candidate shops")
        resources = await load_shop_resources(session, ids, project_id=project.id)
        request = SwarmRequest(
            order_ref=project.order_ref, buyer_name=project.buyer_name,
            target_capacity=project.target_capacity, unit=project.unit,
            unit_price=project.unit_price, duration_days=project.duration_days,
            payment_terms_days=project.payment_terms_days, deposit_ratio=project.deposit_ratio,
            production_start=project.start_date,
            shops=[{**row, "resources": resources.get(row["shop_id"])} for row in rows],
        )
        as_of = project.updated_at.isoformat()
    # These constraints are not stored by the project schema. Disclose them;
    # never infer distance or business requirements from display prose.
    missing = ["buyer_coordinates", "max_distance_km", "required_business_types", "collection_schedule"]
    missing += [f"resources:{shop.shop_id}" for shop in request.shops if shop.resources is None]
    return {"data": request.model_dump(mode="json"), "kind": "actual",
            "source": "database", "status": "insufficient_data", "missing": missing, "asOf": as_of,
            "analyzedAt": datetime.now(timezone.utc).isoformat(), "unit": "THB"}


@router.post("/simulate/order")
async def run_order_simulation(request: OrderSimulationRequest) -> dict:
    try:
        result = await run_in_threadpool(simulate_order, request)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_context=False, include_input=False)) from exc
    simulation_id = None
    if request.persist and DB_ENABLED:
        async with session_scope() as session:
            simulation_id = await save_simulation(
                session, None, "order_what_if", request.model_dump(mode="json"), result["data"],
                project_id=await load_project_id(session, request.baseline.order_ref),
            )
    result["simulationId"] = str(simulation_id) if simulation_id else None
    result["persisted"] = simulation_id is not None
    return result


@router.post("/simulate")
async def run_simulation(request: SimulateRequest) -> dict:
    try:
        envelope = await run_in_threadpool(simulate, request)
    except ValidationError as exc:
        # The scenario pushed the statement outside the input contract (for
        # example cash above current assets). Report the field, not the values.
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Scenario produced an invalid statement",
                "errors": exc.errors(include_context=False, include_input=False),
            },
        ) from exc

    simulation_id = None
    if request.persist and DB_ENABLED:
        async with session_scope() as session:
            simulation_id = await save_simulation(
                session,
                parse_uuid(request.sme_id),
                request.scenario_key,
                request.scenario.model_dump(mode="json"),
                envelope["data"]["delta"],
            )

    envelope["simulationId"] = str(simulation_id) if simulation_id else None
    envelope["persisted"] = simulation_id is not None
    return envelope
