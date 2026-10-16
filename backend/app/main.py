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

from . import bootstrap
from .db import DB_ENABLED, dispose_engine
from .extraction import ExtractionError, MAX_UPLOAD_BYTES, parse_excel
from .finance import calculate_financials
from .rbac import auth_status
from .routers import calculate as calculate_router
from .routers import catalog as catalog_router
from .routers import insights as insights_router
from .routers import match_funding as match_funding_router
from .routers import frontend as frontend_router
from .routers import analyze as analyze_router
from .routers import auth as auth_router
from .routers import simulate as simulate_router
from .routers import swarm as swarm_router
from .routers import upload as upload_router
from .routers import contextual as contextual_router
from .schemas import FinancialInput


BOOTSTRAP_RESULT: dict = {"mode": "not_run"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    # A deployed instance starts against an empty database, so the schema is
    # applied here rather than requiring a manual migration step. Controlled by
    # DB_BOOTSTRAP; a failure is reported through /health instead of taking the
    # process down, so the cause is visible rather than a crash loop.
    global BOOTSTRAP_RESULT
    try:
        BOOTSTRAP_RESULT = await bootstrap.run()
    except Exception as exc:
        BOOTSTRAP_RESULT = {"mode": bootstrap.mode(), "applied": [], "error": type(exc).__name__}
    yield
    await dispose_engine()


app = FastAPI(title="SME SWARM Finance Engine", version="0.3.0", lifespan=lifespan)
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,https://sme-finance-copilot.vercel.app")
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])


# Mounted twice on purpose: /api/* is the backend contract agreed for this
# sprint, /api/v1/* is what the deployed frontend client already calls.
# frontend_router goes first: its literal /swarm/proposal must be matched
# before swarm_router's /swarm/{order_ref}, which would otherwise capture
# "proposal" as an order reference and 404.
for router in (frontend_router.router, catalog_router.router,
               calculate_router.router, swarm_router.router,
               analyze_router.router, upload_router.router, simulate_router.router,
               match_funding_router.router, insights_router.router,
               auth_router.router, contextual_router.router):
    app.include_router(router, prefix="/api")
    app.include_router(router, prefix="/api/v1", include_in_schema=False)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    """Readiness probe. Reports whether the schema bootstrap succeeded, so a
    deployment that came up against an empty database is visible here."""
    return {
        "status": "ok",
        "service": "sme-swarm-finance-engine",
        "version": app.version,
        "persistence": DB_ENABLED,
        "bootstrap": BOOTSTRAP_RESULT,
        "auth": auth_status(),
    }


@app.post("/api/v1/inputs/manual")
def validate_manual(data: FinancialInput):
    return {"status": "ok", "data": data.model_dump(mode="json"), "balanceSheetValid": True,
            "source": "supplied_input", "missing": []}


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
    return {"status": "ok", "data": data.model_dump(mode="json"), "balanceSheetValid": True,
            "source": "supplied_input", "missing": []}


@app.post("/api/v1/finance/calculate")
def calculate_manual(data: FinancialInput):
    return calculate_financials(data)


@app.post("/api/v1/finance/calculate/excel")
async def calculate_excel(file: UploadFile = File(...)):
    data = await extract_upload(file)
    return await run_in_threadpool(calculate_financials, data)
