# Frontend Integration Guide

This guide is for frontend contributors who are improving the presentation while keeping the existing backend integration working. The UI can be redesigned, but use the shared API client and contracts instead of calling endpoints ad hoc or rebuilding financial calculations in React.

## Quick start

Requirements: Node.js, pnpm, and Python 3.12+ for the API. Install frontend dependencies and start the UI:

```powershell
pnpm install
pnpm dev -- --host localhost --port 5173
```

For local API-backed development, create `backend/.env` from `backend/.env.example`, leave optional secrets empty, and configure the frontend in a root `.env.local`:

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Start the API in another terminal using `backend\run.cmd`. It listens on port 8000. `localhost:5173` is allowed by the local CORS defaults. The app is also available in mock mode by leaving `VITE_USE_MOCK` unset or setting it to `true`.

For the deployed Vercel prototype, `vercel.json` builds with `VITE_USE_MOCK=false` and `VITE_API_BASE_URL=/api/v1`; the `/api/*` rewrite sends requests to the FastAPI function. Do not change the production API base to a developer's localhost. Vite environment variables are public build-time values: never put a database URL, model key, auth secret, or other credential in a `VITE_*` variable. Keep secrets only in the backend host's environment configuration.

## Where to work

| Need | File or location |
| --- | --- |
| App shell and route selection | `src/App.tsx` |
| API base, transport, endpoint methods | `src/api/client.ts` |
| Response and request TypeScript contracts | `src/api/contracts/types.ts`, `src/api/activeAnalysis.ts` |
| Shared loading/error/context state | `src/hooks/useEnvelope.ts` |
| Feature screens | `src/features/<feature>/` |
| Shared navigation and controls | `src/components/ui/` |
| Existing spacing/color/type tokens | `tailwind.config.js`, `src/index.css` |
| Backend routes and data limitations | `docs/API_CONTRACT_MATRIX.md` |
| Backend local setup and examples | `backend/README.md`, `backend/examples/` |

Call backend operations through `apiClient` from `src/api/client.ts`; use the matching exported type from `src/api/contracts/types.ts`. A normal read page should use `useEnvelope<T>` so loading, errors, stale requests, and accepted-analysis context stay consistent. Use `useAnalysisContext()` when a screen must display whether the imported analysis is current or stale. Keep components presentational where possible and pass typed data/state as props.

Example read pattern:

```tsx
const load = useCallback(() => apiClient.getOverview(), []);
const { envelope, loading, error, reload } = useEnvelope<BusinessOverview>(load);
```

For writes or calculations, use the existing `apiClient` method and preserve its request context. Do not bypass the client with a raw `fetch` from a page: the client centralizes API base URL, timeout, auth-token transport, error messages, and analysis revision handling.

## Main workflow and API endpoints

All paths below are relative to the configured `/api/v1` base URL. The client currently exposes these primary workflow operations:

| User action | Client method | HTTP endpoint | Notes |
| --- | --- | --- | --- |
| Preview uploaded workbook | `apiClient.previewStatement(file)` | `POST /upload/preview` | Multipart field `file`; `.xlsx`, 4 MiB website limit; preview does not persist. |
| Validate/calculate uploaded workbook | `apiClient.uploadStatement(file)` | `POST /upload?persist=false` | Multipart field `file`; `.xlsx`, up to 5 MiB backend limit. |
| Analyze submitted financial input | `apiClient.analyze(input, shopName?, context?)` | `POST /analyze` | Stateless analysis; returns metrics/views/evidence and accepts the analysis for this tab. |
| Evaluate funding for the same input | `apiClient.evaluateFunding(input, options)` | `POST /funding/evaluate` | Stateless evaluation; needs the funding catalogue database. |
| Preview a dated forecast | `apiClient.previewForecast(input, context?)` | `POST /forecast/preview` | Preview only; dated SME/project cash-flow evidence is required. |
| Preview entered cash events | `apiClient.previewCashflow(input)` | `POST /cashflow/preview` | Requires opening cash, reserve, as-of date, and dated receipts/payments 1–90 days ahead; simulated and never persisted. |
| Preview product/channel margins | `apiClient.previewSales(input)` | `POST /sales/preview` | Requires complete product cost/revenue/units/turnover and channel gross sales/fees; simulated and never persisted. |
| Check supported operations | `apiClient.getCapabilities()` | `GET /capabilities` | Drive unavailable/disabled UI actions from this response. |
| Download workbook template | `apiClient.downloadTemplate()` | `GET /analysis/template.xlsx` | Uses authenticated client transport when a token exists. |

The `FinancialInput` type lives in `src/api/activeAnalysis.ts`; the shared response `Envelope<T>` is in `src/api/contracts/types.ts`. Financial values use decimal strings in backend request contracts when precision matters. Always follow the exact endpoint-specific contract in `docs/API_CONTRACT_MATRIX.md` and backend Pydantic schemas.

## Data and UI rules

- Respect `Envelope.status`, `missing`, `kind`, `source`, `asOf`, and `evidenceRefs`. Do not treat a response as verified real-world data just because the server returned it.
- Preserve `actual`, `forecast`, and `simulated` labels in the UI. Keep unavailable values `null`; do not replace unknown values with zero, invented dates, or fabricated evidence.
- Pass the same normalized financial input and its context/revision to analysis-dependent requests. A shop name typed into a form is not an SME identity.
- Treat `GET /capabilities` and an operation's returned availability as authoritative. Some prototype actions (such as applying for funding, signing, resource reservation, news, and export) are not implemented as completed transactions.
- Excel preview is stateless. The workbook bytes are not stored. Do not send real financial files to an endpoint other than the user-approved product flow.
- Render HTTP errors as recoverable UI states; `422` means invalid input, `413` means too large, and `503` can mean a database-backed catalogue is unavailable. Keep retry/reload available when useful.
- Preserve keyboard access, reduced-motion support, responsive layouts, and the existing visual system when changing screens.

## Checks before handoff

```powershell
pnpm build
pnpm test:invariants
python -m pytest -c backend/pytest.ini -q
```

Use synthetic fixtures from `backend/examples/` for development and screenshots. Do not commit `.env`, `.env.local`, backend upload files, database dumps, or API credentials. `.gitignore` excludes the environment files and runtime upload directory.

## Troubleshooting

- **Mock/demo mode warning:** set `VITE_USE_MOCK=false`, set `VITE_API_BASE_URL`, then restart Vite; environment values are read at startup/build time.
- **Connection or CORS error:** verify the API responds at `http://127.0.0.1:8000/health`, use frontend port 5173, and ensure `CORS_ORIGINS` includes `http://localhost:5173`.
- **Database-disabled state:** calculation and analysis can run statelessly, but database-backed catalogues and saved records may return unavailable. Check `/health` and `GET /api/v1/capabilities`.
- **TypeScript errors after UI changes:** prefer the shared contract types; do not weaken them with `any` to conceal nullable or unavailable backend data.
