"""Scoped saved-plan inspection and deterministic snapshot replay, never reserve."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from ..context import fingerprint
from ..db import DB_ENABLED, session_scope
from ..models import Simulation
from ..order_simulation import ORDER_ENGINE, OrderSimulationRequest, simulate_order
from ..project_context import load_order_context, selected_project
from ..rbac import Principal, resolve_principal
from ..simulate import SimulateRequest, simulate

router = APIRouter(tags=["saved-simulations"])


def scoped(query, project_id, sme_id, order_ref):
    if project_id is None and sme_id is None and order_ref is None:
        raise HTTPException(422, "Supply project_id, sme_id or order_ref to scope saved simulations")
    if project_id is not None:
        query = query.where(Simulation.project_id == project_id)
    if sme_id is not None:
        query = query.where(Simulation.sme_id == sme_id)
    if order_ref is not None:
        query = query.where(Simulation.params["baseline"]["order_ref"].astext == order_ref)
    return query


def access(principal, sme_id):
    if principal.enforced and not principal.may("admin", "analyst") and not principal.owns_sme(sme_id):
        raise HTTPException(403, "Saved simulation is outside this SME scope")


def serialize(row, *, full=True):
    result = {"simulationId": str(row.id), "smeId": str(row.sme_id) if row.sme_id else None,
              "projectId": str(row.project_id) if row.project_id else None,
              "scenarioKey": row.scenario_key, "createdAt": row.created_at.isoformat(),
              "engine": row.replay_version, "context": row.context,
              "replayAvailable": row.replay_version is not None and ("baseline" in row.params or "input" in row.params)}
    if full:
        result.update({"request": row.params, "results": row.results, "resultHash": fingerprint(row.results)})
    return result


async def read_scoped(identifier, project_id, sme_id, order_ref, principal):
    if not DB_ENABLED:
        raise HTTPException(503, "Saved simulation storage requires DATABASE_URL")
    access(principal, sme_id)
    query = scoped(select(Simulation).where(Simulation.id == identifier), project_id, sme_id, order_ref)
    async with session_scope() as session:
        row = await session.scalar(query)
    if row is None:
        raise HTTPException(404, "No saved simulation in this context")
    access(principal, row.sme_id)
    return row


@router.get("/simulations")
async def list_simulations(project_id: uuid.UUID | None = None, sme_id: uuid.UUID | None = None,
                           order_ref: str | None = None, limit: int = Query(default=30, ge=1, le=100),
                           principal: Principal = Depends(resolve_principal)):
    if not DB_ENABLED:
        raise HTTPException(503, "Saved simulation storage requires DATABASE_URL")
    access(principal, sme_id)
    query = scoped(select(Simulation), project_id, sme_id, order_ref)
    async with session_scope() as session:
        rows = (await session.scalars(query.order_by(Simulation.created_at.desc(), Simulation.id.desc()).limit(limit))).all()
    return {"data": [serialize(row, full=False) for row in rows], "source": "database", "status": "ok", "missing": []}


@router.get("/simulations/{simulation_id}")
async def get_simulation(simulation_id: uuid.UUID, project_id: uuid.UUID | None = None,
                         sme_id: uuid.UUID | None = None, order_ref: str | None = None,
                         principal: Principal = Depends(resolve_principal)):
    row = await read_scoped(simulation_id, project_id, sme_id, order_ref, principal)
    return {"data": serialize(row), "source": "database", "status": "ok", "missing": []}


@router.post("/simulations/{simulation_id}/replay")
async def replay_simulation(simulation_id: uuid.UUID, project_id: uuid.UUID | None = None,
                            sme_id: uuid.UUID | None = None, order_ref: str | None = None,
                            input_revision: str | None = None, input_hash: str | None = None,
                            principal: Principal = Depends(resolve_principal)):
    row = await read_scoped(simulation_id, project_id, sme_id, order_ref, principal)
    if not serialize(row)["replayAvailable"]:
        raise HTTPException(409, "Legacy simulation lacks complete replay input/version")
    if row.replay_version.startswith("order-what-if/"):
        request = OrderSimulationRequest.model_validate({**row.params, "persist": False})
        result = await run_in_threadpool(simulate_order, request)
    elif row.replay_version.startswith("what-if-simulator/"):
        request = SimulateRequest.model_validate({**row.params, "persist": False})
        result = await run_in_threadpool(simulate, request)
    else:
        raise HTTPException(409, "Saved engine version is unsupported")
    differences = []
    if result["engine"] != row.replay_version:
        differences.append("engine_version")
    saved_context = row.context or {}
    if input_revision is not None and input_revision != saved_context.get("inputRevision"):
        differences.append("input_revision")
    if input_hash is not None and input_hash != saved_context.get("inputHash"):
        differences.append("input_hash")
    if row.project_id is not None and "orderHash" in saved_context:
        async with session_scope() as session:
            current = await selected_project(session, row.project_id)
            current_request, _ = await load_order_context(session, current)
        if fingerprint(current_request.model_dump(mode="json")) != saved_context["orderHash"]:
            differences.append("live_order_context")
    saved_hash, recomputed_hash = fingerprint(row.results), fingerprint(result["data"])
    return {"data": {"simulationId": str(row.id), "reproduced": saved_hash == recomputed_hash,
                     "savedResultHash": saved_hash, "recomputedResultHash": recomputed_hash,
                     "savedEngine": row.replay_version, "currentEngine": result["engine"],
                     "contextDifferences": differences, "context": row.context,
                     "results": result["data"], "replaySource": "saved_snapshot"},
            "kind": "simulated", "source": "saved_snapshot", "persisted": False,
            "status": "ok" if saved_hash == recomputed_hash and not differences else "stale",
            "missing": []}
