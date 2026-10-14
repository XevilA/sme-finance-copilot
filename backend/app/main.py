"""SME SWARM Finance Engine API.

Calculation is pure and deterministic. Persistence is opt-in: set DATABASE_URL
to store SME profiles, financial records and swarm projects; without it every
endpoint still answers, just without writes. Uploaded workbook bytes are never
stored - only parsed values and upload metadata.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from .db import DB_ENABLED, dispose_engine
from .extraction import ExtractionError, MAX_UPLOAD_BYTES, parse_excel
from .finance import calculate_financials
from .routers import calculate as calculate_router
from .routers import analyze as analyze_router
from .routers import swarm as swarm_router
from .schemas import FinancialInput


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await dispose_engine()


app = FastAPI(title="SME SWARM Finance Engine", version="0.3.0", lifespan=lifespan)
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,https://sme-finance-copilot.vercel.app")
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


# Mounted twice on purpose: /api/* is the backend contract agreed for this
# sprint, /api/v1/* is what the deployed frontend client already calls.
for router in (calculate_router.router, swarm_router.router, analyze_router.router):
    app.include_router(router, prefix="/api")
    app.include_router(router, prefix="/api/v1", include_in_schema=False)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok", "service": "sme-swarm-finance-engine", "persistence": DB_ENABLED}


@app.post("/api/v1/inputs/manual")
def validate_manual(data: FinancialInput):
    return {"status": "ok", "data": data.model_dump(mode="json"), "balanceSheetValid": True}


async def extract_upload(file: UploadFile) -> FinancialInput:
    try:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Workbook exceeds 5 MiB")
        return await run_in_threadpool(parse_excel, content, file.filename or "")
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValidationError as exc:
        # Omit exception contexts and raw financial values from error responses.
        raise HTTPException(status_code=422, detail=exc.errors(include_context=False, include_input=False)) from exc
    finally:
        await file.close()


@app.post("/api/v1/inputs/excel")
async def validate_excel(file: UploadFile = File(...)):
    data = await extract_upload(file)
    return {"status": "ok", "data": data.model_dump(mode="json"), "balanceSheetValid": True}


@app.post("/api/v1/finance/calculate")
def calculate_manual(data: FinancialInput):
    return calculate_financials(data)


@app.post("/api/v1/finance/calculate/excel")
async def calculate_excel(file: UploadFile = File(...)):
    data = await extract_upload(file)
    return await run_in_threadpool(calculate_financials, data)
