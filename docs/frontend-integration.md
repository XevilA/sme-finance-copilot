# Frontend Integration: API and AI

This guide is the handoff contract for frontend engineers connecting the SME Finance Copilot UI to the FastAPI and financial-analysis services. Keep presentation in React and use the shared API client; financial calculations, grading, funding matches, and AI findings belong to the backend.

## 1. Run the application

Requirements: Node.js, pnpm, and Python 3.12 or newer. From the repository root:

```powershell
pnpm install
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
```

Copy `backend/.env.example` to `backend/.env`. Leave `DATABASE_URL` empty for stateless local analysis; database-backed catalogue and saved-record operations will report unavailable. Start the API and frontend in separate terminals:

```powershell
backend\run.cmd
```

```powershell
pnpm dev -- --host localhost --port 5173
```

The API is at `http://127.0.0.1:8000`; its interactive schema is at `/docs`. Create a root `.env.local` for API-backed frontend work:

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Restart Vite after changing environment values. The deployed Vercel build uses `VITE_API_BASE_URL=/api/v1` and the same-origin API rewrite. Never put credentials in `VITE_*` variables: browsers can read them.

## 2. Use the shared transport and response contract

Import `apiClient` from `src/api/client.ts` and types from `src/api/contracts/types.ts` or `src/api/activeAnalysis.ts`. The client centralizes the base URL, timeout, optional bearer token, error conversion, demo-mode guard, and accepted-analysis context. Do not create page-specific `fetch` calls or reimplement a financial formula in the browser.

Most reads return an envelope with these fields:

```ts
type Envelope<T> = {
  data: T;
  kind: "actual" | "forecast" | "simulated";
  status: "ok" | "insufficient_data" | "unavailable" | "stale" | "error";
  missing: string[];
  source: string;
  asOf?: string;
  evidenceRefs?: Array<{ id: string; label: string; targetId?: string }>;
};
```

Preserve `status`, `missing`, `source`, `kind`, and evidence in the UI. A successful HTTP response can still be incomplete. Keep unknown numbers `null`; do not turn them into zero or present synthetic seed records as the customer's data. Use `useEnvelope` and `useAnalysisContext` from `src/hooks/useEnvelope.ts` to handle loading, retry, stale requests, and accepted-analysis changes consistently.

## 3. Import, analyze, and show the AI result

The import flow is a preview followed by an explicit selection/confirmation. The browser preview endpoint accepts `.xlsx` files up to 4 MiB so the request fits the website host's body limit:

```ts
const preview = await apiClient.previewStatement(file);
```

`preview.format === "financials"` contains one normalized `FinancialInput`. `preview.format === "statements"` contains extracted statement candidates with source/period details; do not merge candidates with different periods or currencies. Use `statementDraft(selectedStatements)` from `src/api/statementImport.ts` to map supported THB statement fields, then collect any still-required dates and fields from the user before creating the strict `FinancialInput`. The workbook preview is read-only and does not save the original file.

Run analysis on the selected input and keep the returned result as the active tab context:

```ts
const revision = crypto.randomUUID();
const analysis = await apiClient.analyze(input, companyName, {
  input_revision: revision,
});

const explanation = analysis.views.explanation;
const health = analysis.views.indicators;
const overview = analysis.views.overview;
```

The input must include `currency: "THB"`, `kind`, ISO date strings, and a balanced balance sheet (`assets = liabilities + equity`, within THB 0.01). Money should be sent as decimal strings. Unknown optional fields must be omitted or remain `null`; use `0` only when zero is known. The backend validates the request and returns HTTP 422 with field-level errors for invalid data.

The current AI is an evidence-based deterministic rules engine. `analysis.data.aiMode` is `rules`; its findings may only refer to available computed facts. Display the finding severity, evidence IDs, unknowns, and limitations. Do not label it an LLM response. Optional server-side model mode may reorder existing finding IDs; it cannot calculate figures, add findings, assign a grade, or approve a loan. If provider configuration is absent or the response is invalid, the API falls back to rules and includes an `aiWarning`.

For an imported statement, render `analysis.views.explanation` (or call `apiClient.getAIExplanation(pageId)` after the analysis has been accepted). The standalone `/ai/explain` endpoint resolves a stored statement and is not a substitute for analyzing the user's newly imported input.

## 4. Keep downstream operations on the same analysis

The accepted input and its revision/hash keep dashboard views aligned. Pass that same input and context to dependent operations; never silently fall back to a different stored SME record.

```ts
const requestContext = {
  input_revision: revision,
  expected_input_hash: analysis.inputHash,
};

const funding = await apiClient.evaluateFunding(analysis.data.input, requestContext);
const forecast = await apiClient.previewForecast(analysis.data.input, requestContext);
```

Funding evaluation requires the PostgreSQL funding catalogue. A no-match or `missing` result is a valid outcome, not an error or an approval. Forecasting requires dated cash events for the explicitly identified SME/project and explicit schedule coverage; a statement total alone cannot establish a 30/60/90-day forecast.

Order preview and what-if simulation are separate from a financial statement:

```ts
const order = await apiClient.getOrderContext();
const proposal = await apiClient.assembleSwarm(order.data);
const comparison = await apiClient.simulateOrder(order.data, {
  unit_price: "120",
  cost_per_unit: "50",
  deposit_ratio: "0.5",
  payment_terms_days: 10,
}, false);
```

Show these results as previews. Preserve missing order requirements and resource eligibility reasons. Do not claim an order has been reserved, funding has been applied for, or a contract has been signed.

## 5. Runtime capabilities and unavailable actions

At page startup, read `apiClient.getCapabilities()` and use each `available` flag to render or disable actions. The runtime `/api/v1/capabilities` response is authoritative. In the current prototype, deterministic analysis, order preview, explicit order resource-outage simulation, and saved simulation replay when the database is configured are supported. Funding application, agreement signature, funder information request, report export, resource reservation, and arbitrary narrative chaos effects are not implemented as completed transactions.

Production currently uses synthetic seed records and does not enforce authentication. Authentication routes and token helpers do not establish an authorization boundary while `RBAC_ENFORCED=false`. Never enter or upload customer/production financial data in the public demo. Keep real credentials server-side in host environment variables such as `DATABASE_URL`, `AUTH_SECRET`, and optional `OPENAI_API_KEY`.

## 6. Error handling and checks

`apiClient` converts common transport failures to `ApiError` with an HTTP `status` and readable message. Keep retry controls for transient failures and avoid success notifications until the operation has actually succeeded.

| Result | Frontend behavior |
| --- | --- |
| `422` | Show field/input validation details; let the user correct the workbook or scenario. |
| `413` | Explain the website upload size limit and ask for a smaller workbook. |
| `503` | Show the database/provider-backed feature as temporarily unavailable; preserve the input. |
| `401` / `403` | Show sign-in/permission state; do not retry as a generic network error. |
| status `0` | Show connection/timeout guidance and a retry action. |
| HTTP 200 with `missing` or incomplete status | Render a partial/unavailable state; do not show a complete-result success message. |

Before handoff, run from the repository root:

```powershell
pnpm build
pnpm test:invariants
node_modules/.bin/tsx scripts/test-statement-import.ts
node_modules/.bin/tsx scripts/test-data-availability.tsx
backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini -q
```

The default backend command skips tests that need PostgreSQL when `DATABASE_URL` is unset. For the full suite, start Docker Desktop/Engine and run the disposable, loopback-only test database runner:

```powershell
backend/.venv/Scripts/python.exe backend/scripts/test_with_postgres.py
```

On macOS/Linux, use `backend/.venv/bin/python backend/scripts/test_with_postgres.py`. The runner loads only synthetic schema/seed data, overrides any `DATABASE_URL` from `.env`, and tears down its temporary database after pytest exits. Never point test fixtures at the public demo database.

## Contract references

- API route/request details: [API contract matrix](API_CONTRACT_MATRIX.md)
- Financial formulas and AI provenance: [Backend API and math](../backend/docs/API_AND_MATH.md)
- Demo feature boundaries: [Demo handoff](../backend/docs/DEMO_HANDOFF.md)
- Shared frontend adapter and state: `src/api/client.ts`, `src/api/activeAnalysis.ts`, `src/hooks/useEnvelope.ts`
