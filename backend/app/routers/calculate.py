"""POST /api/calculate - run the deterministic finance engine, optionally persist."""

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..extraction import ExtractionError, MAX_UPLOAD_BYTES, parse_excel
from ..finance import calculate_business_metrics, calculate_financials
from ..grading import grade_financials
from ..repository import parse_uuid, save_financial_record
from ..schemas import FinancialInput, StrictModel
from ..context import StatementRequest, metadata

router = APIRouter(tags=["calculate"])


class CalculateRequest(StatementRequest):
    persist: bool = True


async def run_and_store(data: FinancialInput, sme_id: str | None, persist: bool, source: str) -> dict:
    computed = await run_in_threadpool(calculate_financials, data)
    computed["businessMetrics"] = await run_in_threadpool(calculate_business_metrics, data)
    computed["grading"] = await run_in_threadpool(grade_financials, data)
    # JSON mode: date and Decimal become strings, which is what a JSONB column
    # accepts and what keeps money exact (no float round-trip).
    payload = data.model_dump(mode="json")
    record_id = None
    if persist and DB_ENABLED:
        async with session_scope() as session:
            record_id = await save_financial_record(
                session, parse_uuid(sme_id), payload, computed, source
            )
    return {
        **computed,
        "recordId": str(record_id) if record_id else None,
        "persisted": record_id is not None,
        "echo": {"smeId": sme_id, "source": source, "periodEnd": payload["period_end"]},
    }


@router.post("/calculate")
async def calculate(request: CalculateRequest) -> dict:
    result = await run_and_store(request.input, str(request.sme_id) if request.sme_id else None, request.persist, "manual")
    result.update(metadata(request))
    return result


@router.post("/calculate/excel")
async def calculate_from_excel(
    file: UploadFile = File(...),
    sme_id: str | None = None,
    persist: bool = True,
) -> dict:
    try:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Workbook exceeds 5 MiB")
        data = await run_in_threadpool(parse_excel, content, file.filename or "")
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValidationError as exc:
        # Never echo raw financial values back in an error body.
        raise HTTPException(
            status_code=422, detail=exc.errors(include_context=False, include_input=False)
        ) from exc
    finally:
        await file.close()
    return await run_and_store(data, sme_id, persist, "excel")
