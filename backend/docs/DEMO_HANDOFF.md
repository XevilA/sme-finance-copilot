# Demo readiness and frontend handoff

This guide summarizes what the current prototype can demonstrate and where the UI must show an unavailable or incomplete state. `GET /api/v1/capabilities` is authoritative for runtime operations. The current production instance uses PostgreSQL with synthetic seed records; authentication enforcement is off, so it is suitable for a public demo with synthetic data only.

**Concurrent-test status:** the automated suite verifies function and database correctness, not load capacity. No concurrent-user load test has been run, so the prototype is suitable for supervised testing with synthetic data, but must not be represented as capacity-tested for a large simultaneous audience. Database-backed endpoints share the demo catalogue and depend on the hosted PostgreSQL connection limit. Check `/health` before the event and keep a demo operator available to handle retries or temporary unavailable states.

**Live smoke check (2026-10-18):** `/health` reported `persistence=true`, `bootstrap=off`, `auth.enforced=false`, and `auth.secretConfigured=false`. `GET /api/v1/funding/options?amount=50000` returned HTTP 200 with `status=ok` and `source=stored_record`, confirming the deployed Funding route could query its PostgreSQL catalogue at check time. `/api/v1/simulator/context` and a `persist=false` `/api/v1/simulate/order` preview both returned HTTP 200; the preview used `order-what-if/v2` and returned `insufficient_data` with four missing order-context fields (`buyer_coordinates`, `collection_schedule`, `max_distance_km`, `required_business_types`). Industry Trends returned HTTP 200 with `status=unavailable`, provider timeout, and no cached articles. A backend follow-up now returns the effective `retryAfterSeconds` after provider failures so clients can respect the backoff; this improves retry behavior but does not restore an unavailable upstream feed. Do not present Industry Trends as live-ready until a later successful provider fetch is observed. No saved simulation was written to the public database during this check.

## Eight feature areas

| # | Feature | Prototype status | Group-test status | Frontend behavior |
| --- | --- | --- | --- | --- |
| 1 | Statement validation and Excel import | Available for supported `.xlsx` formats; multi-statement extraction keeps statements separate and flags inconsistent periods/currencies | Suitable for supervised synthetic-data trials; upload throughput under concurrency is untested | Show validation errors and source periods; never imply that mixed statements form one verified SME record |
| 2 | Financial calculations and grading | Available for metrics supported by supplied fields; absent inputs remain unavailable | Stateless analysis is suitable for a supervised pilot; capacity is untested | Render each metric status and missing fields; do not fill unknown values with zero |
| 3 | AI business explanation | Available in deterministic rules mode with evidence; forecast claims require dated events and confirmed coverage | Default rules flow avoids external model calls; capacity is untested | Label `aiMode: rules`; show evidence and limitations; do not present it as generated advice |
| 4 | Funding matcher | Matching/evaluation endpoints are implemented; live results depend on an accepted statement and catalogue coverage | Conditional on database health; concurrent catalogue load is untested | Show no-match/insufficient-data states honestly; applying for funding is unavailable |
| 5 | SWARM order allocation | Allocation preview is available; output depends on order requirements, shop capacity, and resource data | Preview uses shared catalogue data; concurrent database load is untested | Label as preview; show unmet requirements/deficit; resource reservation is unavailable |
| 6 | What-if simulator | Supported order scenario recomputation is available; saved replay requires database | Preview can be tried; concurrent saved writes/replay have not been load-tested | Identify scenario inputs and assumptions; only expose saved replay when capability says available |
| 7 | Industry trends | Endpoint exists, but live signals depend on configured provider and successful fetch | Limited by shared cache/provider rate limits; stale or unavailable results may appear | Show unavailable/empty/stale states; headline signals are not verified financial forecasts |
| 8 | Database, API, and authentication | PostgreSQL persistence and API are available; login routes exist but demo auth enforcement is off | Not ready for real customer data or a capacity claim; no user isolation, and connection limits are unverified | Do not expose real customer data; do not claim user isolation or secure production access |

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
