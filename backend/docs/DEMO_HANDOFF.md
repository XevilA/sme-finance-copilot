# Demo readiness and frontend handoff

This guide summarizes what the prototype can demonstrate and where the UI must show an unavailable or incomplete state. `GET /api/v1/capabilities` is authoritative for runtime operations. The live smoke check below was run against `https://sme-finance-copilot-prototype.vercel.app/`. The separate `https://sme-finance-copilot.vercel.app/` domain shown in tester screenshots may be a different Vercel deployment; confirm the exact test URL and build with the organizer before testing. The checked deployment used PostgreSQL with synthetic seed records and had authentication enforcement off, so use synthetic data only.

**Concurrent-test status:** the automated suite verifies function and database correctness, not load capacity. No concurrent-user load test has been run, so the prototype is suitable for supervised testing with synthetic data, but must not be represented as capacity-tested for a large simultaneous audience. Database-backed endpoints share the demo catalogue and depend on the hosted PostgreSQL connection limit. Check `/health` before the event and keep a demo operator available to handle retries or temporary unavailable states.

**Live smoke check (2026-10-18):** `/health` reported `persistence=true`, `bootstrap=off`, `auth.enforced=false`, and `auth.secretConfigured=false`. `GET /api/v1/funding/options?amount=50000` returned HTTP 200 with `status=ok` and `source=stored_record`, confirming the deployed Funding route could query its PostgreSQL catalogue at check time. `/api/v1/simulator/context` and a `persist=false` `/api/v1/simulate/order` preview both returned HTTP 200; the preview used `order-what-if/v2` and returned `insufficient_data` with four missing order-context fields (`buyer_coordinates`, `collection_schedule`, `max_distance_km`, `required_business_types`). Industry Trends returned HTTP 200 with `status=unavailable`, provider timeout, and no cached articles. The backend fix for returning the effective `retryAfterSeconds` is on `main`, but the live response checked after that push still returned `retryAfterSeconds=null`; redeployment and a fresh live check are outstanding. This fix improves client backoff reporting but does not restore an unavailable upstream feed. Do not present Industry Trends as live-ready until a later successful provider fetch is observed. No saved simulation was written to the public database during this check.

## Eight feature areas

| # | Feature | Pitch/demo status | What is verified | Boundary to state clearly |
| --- | --- | --- | --- | --- |
| 1 | Statement validation and Excel import | **Usable for supported `.xlsx` files** | Import and parsing flow are implemented; multiple statements stay separate and validation reports period/currency issues | Supervised prototype testing only; upload throughput under concurrent use is untested. Do not combine mixed statements into one verified SME record. |
| 2 | Financial calculations and grading | **Usable for supplied, supported fields** | Deterministic metrics calculate from available inputs; missing inputs remain unavailable | This is a prototype assessment, not a lender decision. Never display unknown values as zero. |
| 3 | AI business explanation | **Usable in evidence-based rules mode** | Default flow returns rule-based findings and supporting evidence without requiring an external LLM | Identify it as rules mode, not free-form AI advice. Forecasts require complete dated-event coverage. |
| 4 | Funding matcher | **Usable; database confirmed in live smoke check** | Hosted `/funding/options` returned HTTP 200, `status=ok`, `source=stored_record` from the PostgreSQL catalogue | Results rank the synthetic catalogue and depend on database health and data coverage. This does not submit an application or approve credit. |
| 5 | SWARM order allocation | **Preview usable with complete inputs** | Allocation preview can evaluate order requirements against available shop/resource data | Preview uses shared synthetic catalogue data. Show deficits; do not claim a reservation or completed transaction. Concurrent catalogue load is untested. |
| 6 | What-if simulator | **Preview works; this live sample is incomplete** | Live `persist=false` request returned HTTP 200 with `order-what-if/v2` | The checked project lacked four required context fields and correctly returned `insufficient_data`. Supply confirmed inputs; saved replay depends on PostgreSQL. Concurrent writes/replay are untested. |
| 7 | Industry trends | **Not ready to pitch as a working live feed** | Last live request returned `status=unavailable` after an upstream timeout, with no cached articles | The retry-reporting fix is committed, but the live deployment had not shown it at the last check. Provider recovery and a successful fresh fetch are still needed. |
| 8 | Database, API, and authentication | **API and PostgreSQL work; demo is unauthenticated** | Live `/health` reported `persistence=true`; funding query read a stored catalogue row | `auth.enforced=false` and `auth.secretConfigured=false`. No tester isolation or real-customer-data protection is provided. Do not use real financial data. |

**Audience and capacity:** The backend suite passed **555 tests, with 1 intentional skip** for the database-disabled case. This verifies functional behavior, not Vercel/PostgreSQL throughput. No concurrent-user load test has been run. Present the app as a supervised synthetic-data prototype; do not promise reliable service for a large group testing simultaneously.

The latest frontend update (`0c9cd21`) passed `pnpm build` and all 10 frontend invariants. It displays available imported statement totals on Cash Flow and Sales pages, while retaining the missing-detail notice. These checks do not verify that the latest commit has finished deploying to every Vercel domain; confirm the deployed build before the test session.

### Workbook-only pages: expected behavior

Cash Flow and Sales are not broken when they show a missing-detail state. A statement total cannot establish dated cash movements, and period revenue cannot establish product or channel shares. On an accepted imported statement, the UI displays the reported aggregate values it actually received, labels the statement period, and keeps the missing-detail explanation. The cash timeline still needs confirmed dated receipts/payments; the product/channel breakdown still needs itemized product and channel records. Uploading the same summary workbook again cannot supply those details.

## WeBank tester run sheet

Use the organizer-confirmed test URL and a synthetic workbook only. Record the URL, test time, browser/device, page, visible status, and a sanitized screenshot or request ID for any unexpected result. Never include API tokens, credentials, or real customer financial data in a bug report.

| Step | Test | Expected result |
| --- | --- | --- |
| 1 | Open `/health`; then read `/api/v1/capabilities` | Health reports current persistence/auth settings. Use capabilities to determine enabled actions; do not infer availability from a page title. |
| 2 | Preview and analyze a supported synthetic `.xlsx` | Validation identifies the selected statement and its period/currency. Multiple statements remain separate. An incomplete analysis can return a grade, but must list missing evidence. |
| 3 | Open Cash & Cash Flow after importing a totals-only workbook | Reported cash/flow totals appear when present. The dated timeline remains unavailable without confirmed dated cash events and a matching business identity. No totals are spread across days. |
| 4 | Open Sales & Products after importing a totals-only workbook | Reported revenue/expense totals appear when present. Product and channel breakdowns remain unavailable unless itemized records exist; no mix is estimated. |
| 5 | Open Funding Match with the database healthy | Funding options may be ranked against the synthetic stored catalogue. A result is not an application or approval. If persistence is off/unhealthy, record the unavailable response. |
| 6 | Run a SWARM or What-if preview with explicit synthetic order inputs | Preview returns a proposal/comparison or an explicit missing-data state. Do not claim resources are reserved. `persist=false` must not write a saved simulation. |
| 7 | Open Industry Trends | A successful feed requires a successful provider fetch or usable cache. If it shows timeout/unavailable/empty, record that state; do not report it as a successful live signal. |
| 8 | Several testers perform low-volume functional checks | The demo is unauthenticated and has no tester isolation. Use synthetic data only. No load-test capacity is certified; record slow responses/errors and stop if failures repeat. |

When reporting a defect, include the page and step, expected vs actual status, sanitized response fields (`status`, `source`, `missing`), and whether `/health` showed persistence enabled. Do not attach a real financial workbook.

## Connect the frontend

The deployed frontend should use `VITE_API_BASE_URL=/api/v1` and `VITE_USE_MOCK=false`; `vercel.json` forwards `/api/*` to the FastAPI function. Locally, keep the frontend and backend origins configured for the development setup. Do not set the API base URL to a developer's machine in a deployed build.

On startup, call `/health` and `/capabilities`. Use the existing `apiClient` and typed contracts in `src/api/`; do not build a second fetch layer. For each response, preserve the envelope's `source`, `status`, `missing`, and availability fields. A `200` response does not guarantee a complete calculation. Disable or explain actions whose capability is unavailable rather than showing a success toast.

Keep all credentials server-side: `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, and provider credentials must never use `VITE_*`. The present demo has no enforced login, tenant isolation guarantee, or authorization boundary suitable for customer data.

## Demo checklist

1. Open the deployed app and confirm `/health` reports the service healthy and persistence enabled.
2. Import a supported workbook. Check the parsed statement period, currency, validation result, and source before opening the analysis pages.
3. Review Financial Health and AI Explain. Confirm the visible findings cite evidence and clearly identify missing data; rules mode should not be described as an LLM response.
4. Run a SWARM or simulator preview using explicit scenario inputs. Show output as a preview and call out any unmet requirements or missing source fields.
5. Open Funding and Industry Trends to demonstrate their empty/unavailable states when no usable statement/catalogue/provider result exists.
6. Use Reset after scenario tests. Do not demonstrate application, signature, export, reservation, or arbitrary chaos actions as completed transactions.

## Local verification and known limits

Run the checks from the repository root:

```powershell
backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini -q
pnpm build
pnpm test:invariants
```

The public demo's auth enforcement is disabled and database records are synthetic. The demo does not perform real funding applications, agreement signing, resource reservation, or report export. A provider outage can leave Industry Trends empty. A forecast is not confirmed through 30/60/90 days unless schedule completeness is explicitly supplied and the dated events support it. These limits should be visible in any demo recording or handoff.
