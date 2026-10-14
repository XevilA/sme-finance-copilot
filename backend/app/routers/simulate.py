"""POST /api/simulate - Plan A vs Plan B what-if comparison (Module 6)."""

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..repository import parse_uuid, save_simulation
from ..simulate import SimulateRequest, simulate

router = APIRouter(tags=["simulate"])


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
