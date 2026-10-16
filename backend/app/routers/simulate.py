"""Statement and finite-order Plan A/B comparisons (Module 6)."""

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..repository import parse_uuid, save_simulation
from ..simulate import SimulateRequest, simulate
from ..order_simulation import OrderSimulationRequest, simulate_order
from ..repository import load_project_id
from ..context import fingerprint, metadata
from ..project_context import load_order_context, selected_project

router = APIRouter(tags=["simulate"])


@router.get("/simulator/context")
async def order_context(project_id: uuid.UUID | None = None, order_ref: str | None = None) -> dict:
    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="Order context requires DATABASE_URL")
    async with session_scope() as session:
        project = await selected_project(session, project_id, order_ref)
        request, missing = await load_order_context(session, project)
        as_of = project.updated_at.isoformat()
    return {"data": request.model_dump(mode="json"), "kind": "actual",
            "projectId": str(project.id), "contextHash": fingerprint(request.model_dump(mode="json")),
            "constraints": project.constraints,
            "source": "database", "status": "insufficient_data" if missing else "ok", "missing": missing, "asOf": as_of,
            "analyzedAt": datetime.now(timezone.utc).isoformat(), "unit": "THB"}


@router.post("/simulate/order")
async def run_order_simulation(request: OrderSimulationRequest) -> dict:
    try:
        result = await run_in_threadpool(simulate_order, request)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_context=False, include_input=False)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    simulation_id = None
    project_id = None
    if request.project_id is not None or (request.persist and DB_ENABLED):
        if not DB_ENABLED:
            raise HTTPException(503, "Project identity requires DATABASE_URL")
        async with session_scope() as session:
            project_id = await load_project_id(session, request.baseline.order_ref)
            if request.project_id is not None and request.project_id != project_id:
                raise HTTPException(409, "project_id and baseline.order_ref differ")
    context = {"projectId": str(project_id) if project_id else None,
               "smeId": str(request.sme_id) if request.sme_id else None,
               "orderRef": request.baseline.order_ref,
               "orderHash": fingerprint(request.baseline.model_dump(mode="json")),
               "inputRevision": request.input_revision, "inputHash": request.input_hash,
               "engine": result["engine"]}
    result["context"] = context
    result["contextHash"] = fingerprint(context)
    if request.persist and DB_ENABLED:
        async with session_scope() as session:
            simulation_id = await save_simulation(
                session, request.sme_id, "order_what_if", request.model_dump(mode="json"), result["data"],
                project_id=project_id, replay_version=result["engine"], context=context,
            )
    result["simulationId"] = str(simulation_id) if simulation_id else None
    result["persisted"] = simulation_id is not None
    return result


@router.post("/simulate")
async def run_simulation(request: SimulateRequest) -> dict:
    if request.project_id is not None:
        if not DB_ENABLED:
            raise HTTPException(503, "Project identity requires DATABASE_URL")
        async with session_scope() as session:
            await selected_project(session, request.project_id)
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
                request.model_dump(mode="json"),
                envelope["data"], project_id=request.project_id,
                replay_version=envelope["engine"], context={**metadata(request)["context"], "engine": envelope["engine"]},
            )

    envelope["simulationId"] = str(simulation_id) if simulation_id else None
    envelope["persisted"] = simulation_id is not None
    envelope.update(metadata(request))
    return envelope
