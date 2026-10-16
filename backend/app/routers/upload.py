"""POST /api/upload - ingest a workbook, run the engine, store the result.

The uploaded bytes are never persisted. What is stored is the parsed statement,
its computed metrics and an upload_events row holding filename, size and the
SHA-256 of the content, so a re-upload is recognisable without keeping the file.
"""

import hashlib

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..extraction import ExtractionError, MAX_UPLOAD_BYTES, parse_excel
from ..finance import calculate_business_metrics, calculate_financials
from ..grading import grade_financials
from ..repository import parse_uuid, save_financial_record, save_upload_event
from ..schemas import FinancialInput

router = APIRouter(tags=["upload"])


async def record_rejection(sme_id: str | None, filename: str, size: int, digest: str, reason: str) -> None:
    if not DB_ENABLED:
        return
    async with session_scope() as session:
        await save_upload_event(
            session, parse_uuid(sme_id), None, filename, size, digest, "rejected", reason
        )


@router.post("/upload")
async def upload(file: UploadFile = File(...), sme_id: str | None = None, persist: bool = True) -> dict:
    filename = file.filename or "upload.xlsx"
    try:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()

    size = len(content)
    digest = hashlib.sha256(content).hexdigest()

    if size > MAX_UPLOAD_BYTES:
        if persist:
            await record_rejection(sme_id, filename, size, digest, "Workbook exceeds 5 MiB")
        raise HTTPException(status_code=413, detail="Workbook exceeds 5 MiB")

    try:
        data: FinancialInput = await run_in_threadpool(parse_excel, content, filename)
    except ExtractionError as exc:
        if persist:
            await record_rejection(sme_id, filename, size, digest, str(exc))
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValidationError as exc:
        # Never echo raw financial values back in an error body.
        errors = exc.errors(include_context=False, include_input=False)
        if persist:
            await record_rejection(sme_id, filename, size, digest, "Input contract validation failed")
        raise HTTPException(status_code=422, detail=errors) from exc

    computed = await run_in_threadpool(calculate_financials, data)
    computed["businessMetrics"] = await run_in_threadpool(calculate_business_metrics, data)
    computed["grading"] = await run_in_threadpool(grade_financials, data)
    payload = data.model_dump(mode="json")

    record_id = None
    upload_id = None
    if persist and DB_ENABLED:
        async with session_scope() as session:
            owner = parse_uuid(sme_id)
            record_id = await save_financial_record(session, owner, payload, computed, "excel")
            upload_id = await save_upload_event(
                session, owner, record_id, filename, size, digest, "parsed"
            )

    # Same envelope shape as /api/calculate: data holds the metrics, with
    # businessMetrics and grading beside it.
    return {
        **computed,
        "input": payload,
        "upload": {
            "filename": filename,
            "byteSize": size,
            "contentSha256": digest,
            "uploadId": str(upload_id) if upload_id else None,
            "fileStored": False,
        },
        "recordId": str(record_id) if record_id else None,
        "persisted": record_id is not None,
    }
