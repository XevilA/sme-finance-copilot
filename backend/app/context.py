"""Explicit statement identity and bounded evidence, without shared latest state."""

import hashlib
import json
import uuid
from datetime import date, timedelta

from fastapi import HTTPException
from pydantic import Field, model_validator
from sqlalchemy import select

from . import catalog
from .db import DB_ENABLED, session_scope
from .forecasting import forecast_cashflow
from .models import SmeProfile, SwarmProject
from .obligations import load_expense_history
from .schemas import FinancialInput, StrictModel


def fingerprint(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class StatementRequest(StrictModel):
    input: FinancialInput
    sme_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    input_revision: str | None = Field(default=None, min_length=1, max_length=100)
    expected_input_hash: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    schedule_complete_through: date | None = None

    @model_validator(mode="after")
    def check_revision(self):
        if self.expected_input_hash is not None and self.expected_input_hash != fingerprint(self.input.model_dump(mode="json")):
            raise ValueError("expected_input_hash does not match the supplied statement")
        return self


async def verify_identity(request: StatementRequest) -> None:
    if request.sme_id is None and request.project_id is None:
        return
    if not DB_ENABLED:
        raise HTTPException(503, "Explicit stored identity requires DATABASE_URL")
    async with session_scope() as session:
        if request.sme_id is not None and await session.get(SmeProfile, request.sme_id) is None:
            raise HTTPException(404, "Unknown sme_id")
        if request.project_id is not None and await session.get(SwarmProject, request.project_id) is None:
            raise HTTPException(404, "Unknown project_id")


def metadata(request: StatementRequest, *, evidence: dict | None = None) -> dict:
    context = {
        "smeId": str(request.sme_id) if request.sme_id else None,
        "projectId": str(request.project_id) if request.project_id else None,
        "inputRevision": request.input_revision,
        "inputHash": fingerprint(request.input.model_dump(mode="json")),
        "periodStart": request.input.period_start.isoformat(),
        "periodEnd": request.input.period_end.isoformat(),
        "scheduleCompleteThrough": request.schedule_complete_through.isoformat() if request.schedule_complete_through else None,
    }
    return {"context": context, "inputHash": context["inputHash"],
            "contextHash": fingerprint({**context, "evidence": evidence})}


async def scoped_evidence(request: StatementRequest) -> tuple[dict | None, list[dict] | None]:
    await verify_identity(request)
    if request.sme_id is None:
        return None, None
    async with session_scope() as session:
        events = await catalog.load_cash_events(session, request.sme_id, project_id=request.project_id)
        # Compare only observations available by this statement's closing date.
        # No October expense is used to explain a September imported statement.
        history = await load_expense_history(session, request.sme_id, through=request.input.period_end)
    if request.input.cash_balance is None:
        return None, history
    forecast = forecast_cashflow(
        events, opening_cash=request.input.cash_balance, as_of=request.input.period_end,
        minimum_cash_reserve=request.input.minimum_cash_reserve,
        schedule_complete_through=request.schedule_complete_through,
    )
    return forecast, history
