"""Stateless per-request analysis; no shared global business state.

A request may name a stored SME, and then that SME's expense history and cash
events are read as analysis context. Nothing is written, and nothing is carried
between requests.
"""

import json
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from openpyxl import Workbook
from pydantic import Field, ValidationError
from starlette.concurrency import run_in_threadpool

from .. import adapters, catalog
from ..ai_provider import apply_model_priorities
from ..analysis import build_analysis
from ..db import DB_ENABLED, session_scope
from ..extraction import ExtractionError, MAX_UPLOAD_BYTES, parse_excel
from ..forecasting import forecast_cashflow
from ..obligations import load_expense_history
from ..repository import parse_uuid
from ..schemas import FinancialInput, StrictModel

router = APIRouter(tags=["analyze"])


class AnalyzeRequest(StrictModel):
    input: FinancialInput
    use_llm: Annotated[bool, Field(strict=True)] = False
    # Which stored SME this statement belongs to. With it, the SME's own expense
    # history and cash events are loaded as analysis context; without it neither
    # is queried, and the response says so rather than calling them empty.
    sme_id: str | None = None
    schedule_complete_through: date | None = None


async def analysis_context(
    data: FinancialInput, sme_id: str | None, schedule_complete_through: date | None
) -> tuple[dict | None, list[dict] | None]:
    """The two optional build_analysis inputs, for the SME the caller named.

    Same rules as the GET contracts: one SME, `None` when nothing was queried,
    and a forecast continued from this statement's own date and closing cash
    with coverage asserted by the caller rather than inferred.
    """
    owner = parse_uuid(sme_id)
    if owner is None or not DB_ENABLED:
        return None, None
    async with session_scope() as session:
        events = await catalog.load_cash_events(session, owner)
        history = await load_expense_history(session, owner)
    if data.cash_balance is None:
        return None, history
    forecast = await run_in_threadpool(
        lambda: forecast_cashflow(
            events,
            opening_cash=data.cash_balance,
            as_of=data.period_end,
            minimum_cash_reserve=data.minimum_cash_reserve,
            schedule_complete_through=schedule_complete_through,
        )
    )
    return forecast, history


async def analyze_input(
    data: FinancialInput, use_llm: bool, sme_id: str | None = None,
    schedule_complete_through: date | None = None,
) -> dict:
    forecast, history = await analysis_context(data, sme_id, schedule_complete_through)
    result = await run_in_threadpool(
        lambda: build_analysis(data, forecast=forecast, expense_history=history)
    )
    if use_llm:
        result = await apply_model_priorities(result)
    # status follows missing here as it does in every other envelope, so a
    # comparison that came back insufficient cannot ride out under `ok`.
    return adapters.with_context_gaps(result, forecast)


@router.post("/analyze")
async def analyze(request: AnalyzeRequest):
    return await analyze_input(
        request.input, request.use_llm, request.sme_id, request.schedule_complete_through
    )


@router.post("/analyze/excel")
async def analyze_excel(file: UploadFile = File(...), use_llm: bool = False):
    try:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Workbook exceeds 5 MiB")
        data = await run_in_threadpool(parse_excel, content, file.filename or "")
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors(include_context=False, include_input=False)) from exc
    finally:
        await file.close()
    return await analyze_input(data, use_llm)


@router.get("/analysis/example")
def analysis_example():
    path = Path(__file__).resolve().parents[2] / "examples" / "analysis_input.json"
    data = FinancialInput.model_validate(json.loads(path.read_text(encoding="utf-8")))
    return {"data": data.model_dump(mode="json"), "kind": "simulated", "status": "ok", "asOf": data.period_end.isoformat()}


@router.get("/analysis/template.xlsx")
def analysis_template():
    data = analysis_example()["data"]
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Financials"
    sheet.append(["field", "value"])
    for key, value in data.items():
        if value is None:
            continue
        if isinstance(value, dict):
            for subkey, subvalue in value.items():
                sheet.append([f"{key}.{subkey}", subvalue])
        else:
            sheet.append([key, value])
    sheet.column_dimensions["A"].width = 34
    sheet.column_dimensions["B"].width = 25
    sheet.freeze_panes = "A2"
    content = BytesIO()
    workbook.save(content)
    workbook.close()
    return Response(content.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="analysis-template.xlsx"'})
