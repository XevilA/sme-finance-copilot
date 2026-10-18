# SME Finance Copilot

SME Finance Copilot is a prototype financial assistant for small businesses. It imports supported Excel statements, validates financial inputs, calculates explainable metrics, surfaces evidence-based findings, and previews funding and order scenarios. The project uses a React/TypeScript frontend and a modular FastAPI backend with optional PostgreSQL persistence.

> This prototype is a decision-support demo. It does not approve credit, submit funding applications, sign agreements, reserve resources, or replace accounting and professional credit review. The public demo uses synthetic records and does not enforce authentication; do not enter customer financial data.

## Quick start

Requirements: Node.js, pnpm, and Python 3.12 or newer.

```powershell
pnpm install
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Start the API in one terminal:

```powershell
backend\run.cmd
```

Start the frontend in another terminal:

```powershell
pnpm dev -- --host localhost --port 5173
```

Open `http://localhost:5173`. The API serves `http://127.0.0.1:8000/health` and interactive documentation at `http://127.0.0.1:8000/docs`.

By default, local frontend mode uses synthetic demo data. To connect it to the local API, create `.env.local` in the repository root:

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Restart Vite after changing environment values. Leave `DATABASE_URL` empty for stateless analysis. Funding catalogues, stored order context, and saved simulation reads need a PostgreSQL database. Set server credentials only in `backend/.env` or the deployment provider's environment settings. Never put secrets in `VITE_*` variables.

## Architecture

- `src/api/client.ts` is the frontend API adapter. `src/api/contracts/types.ts` and `src/api/activeAnalysis.ts` define shared response contracts and the active financial-input context.
- `src/features/` contains focused React screens. `src/hooks/useEnvelope.ts` coordinates loading, retries, and stale-result handling.
- `backend/app/routers/` defines HTTP routes. `schemas.py` validates requests; `finance.py`, `grading.py`, `analysis.py`, `forecasting.py`, and `matching.py` hold separate financial and AI logic; `repository.py` and `db.py` handle persistence.
- `backend/parsers/` and `backend/app/extraction.py` parse workbooks without executing spreadsheet formulas. Uploaded workbook bytes are not stored.

The backend uses decimal arithmetic for money. Missing evidence remains missing instead of being silently replaced with zero. The default AI mode is deterministic rules-based analysis: findings cite calculated evidence. Optional server-side model mode may prioritize existing findings only; it does not compute financial values or approve funding.

## Validation

Run from the repository root:

```powershell
pnpm build
pnpm test:invariants
node_modules/.bin/tsx scripts/test-statement-import.ts
node_modules/.bin/tsx scripts/test-data-availability.tsx
backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini -q
```

Database-dependent backend tests are skipped when `DATABASE_URL` is unset. Run the persistence and end-to-end database checks against a dedicated test database, not the public demo database. A stateless test run does not certify database integration.

For the full backend suite, install/start Docker Desktop or Docker Engine and run the isolated PostgreSQL test runner:

```powershell
backend/.venv/Scripts/python.exe backend/scripts/test_with_postgres.py
```

It starts PostgreSQL on loopback port 55432 with schema and synthetic fixtures, overrides any `DATABASE_URL` from `.env`, runs pytest, then removes the temporary database container. On macOS/Linux, use `backend/.venv/bin/python backend/scripts/test_with_postgres.py`.

## Frontend developer: read only these two docs

1. [Frontend Integration: API and AI](docs/frontend-integration.md) — start here for setup, the upload-to-analysis flow, AI behavior, and how to connect screens through `apiClient`.
2. [API Contract Matrix](docs/API_CONTRACT_MATRIX.md) — use as a lookup when you need the exact endpoint, request fields, response context, persistence behavior, or error codes.

These two files are the complete frontend handoff. Backend math/deployment notes and project/proposal documents are supporting references and are not required to start frontend integration.

