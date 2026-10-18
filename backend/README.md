# SME Finance Copilot backend

FastAPI service for statement import, deterministic financial calculations, evidence-based analysis, cash-flow forecasting, funding matching, and SWARM order previews. The API is served by the Vercel Python function in production and can run locally for development.

## Run locally

From the repository root, use Python 3.12 or newer:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/run.cmd
```

The service listens on `http://127.0.0.1:8000`. Open `/docs` for interactive API docs and `/health` for service status. Set `DATABASE_URL` in `backend/.env` to enable persistence; `backend/db/` contains the PostgreSQL schema and seed data. Without a database, pure calculations and rules-based analysis still work, while database-backed endpoints report unavailable.

For the Vercel app, the frontend calls `/api/v1`; `vercel.json` routes those requests to the FastAPI function. Keep database URLs, model keys, auth secrets, and all other credentials in server-side environment variables. Never place them in `VITE_*` variables.

## Verify changes

```powershell
backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini -q
pnpm build
pnpm test:invariants
```

The Python tests need the dependencies from `backend/requirements.txt`. Database integration tests need a reachable PostgreSQL database configured with `DATABASE_URL`.

## Read next

- [API, data contracts, and calculations](docs/API_AND_MATH.md)
- [Feature readiness and frontend demo handoff](docs/DEMO_HANDOFF.md)
