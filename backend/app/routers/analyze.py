"""Stateless per-request analysis; no shared global business state."""

import json
from io import BytesIO
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from openpyxl import Workbook
from pydantic import Field, ValidationError
from starlette.concurrency import run_in_threadpool

from ..ai_provider import apply_model_priorities
from ..analysis import build_analysis
from ..extraction import ExtractionError, MAX_UPLOAD_BYTES, parse_excel
from ..schemas import FinancialInput, StrictModel

router = APIRouter(tags=["analyze"])


class AnalyzeRequest(StrictModel):
    input: FinancialInput
    use_llm: Annotated[bool, Field(strict=True)] = False


async def analyze_input(data: FinancialInput, use_llm: bool) -> dict:
    result = await run_in_threadpool(build_analysis, data)
    return await apply_model_priorities(result) if use_llm else result


@router.post("/analyze")
async def analyze(request: AnalyzeRequest):
    return await analyze_input(request.input, request.use_llm)


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
