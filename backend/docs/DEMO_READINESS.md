# CODEX remaining work and demo readiness

## Update: 2026-10-15

The historical audit below described commit 87c8d64. CLAUDE subsequently completed
the Role 2 frontend contracts, RBAC demo layer, simulator infrastructure, and
catalog data at 99c2aab, with a 225-test baseline. Its old 404 and missing-Role-2
findings below are historical, not the current API state.

CODEX has now implemented finite-order SWARM exposure and business/distance
eligibility, pure debt/equity ranking, dated 30/60/90-day forecasts and projected
obligations, and news ingestion with stale/unavailable states. See
`CODEX_HANDOFF.md` for exact function signatures, result shapes, schema requests,
and the protected-file boundary. Final regression coverage is 308 passing tests
with Postgres, including the original baseline and the updated finite-order expectations.

Current integration gates:

- CLAUDE must update allocation seed values and reseed. Reference values are in
  `SWARM_RESEED_VALUES.json`; existing stored allocations still use the old formula.
- Forward new SWARM eligibility/schedule inputs and map core validation errors to 422.
- Wire funding/investor ranking and persistence, forecast inputs/coverage, and news
  storage/fetch coordination into the already established API contracts.
- Keep rules mode disclosed: there are no OpenAI credits; live LLM is unverified.
  Valid JSON and failure recovery were tested through mock HTTP transport only.
- Live news probes returned 429 and timeout. Unavailable state is working;
  successful fresh headline retrieval is not claimed.
- The API is running locally on port 8000, with real HTTP health/docs/P0 checks.
  Hosted deployment and a fully integrated website rehearsal remain team work.

## Historical audit: 2026-10-14

Reviewed on 2026-10-14 (Asia/Bangkok) against implementation commit `87c8d64`.
Role source: `AI_DEVELOPMENT_GUIDELINES.md`. All implementation work stays in
`backend/`; existing frontend styling, components, and layouts remain unchanged.
The demo date has not been provided. Priorities below are dependency order, not deadlines.

## Verified baseline

- Latest full backend suite: 148 passed, with one Starlette/httpx deprecation warning.
- In-process API smoke check: `/api/analyze` returns HTTP 200 and synthetic grade B / 75.00.
- Unbalanced financial input returns HTTP 422.
- Supplied workbook extraction produces 12 statement-period records with cell provenance.
  It contains placeholder balance tables and separate THB income / USD-million cash flow
  sections. It is not one validated SME dataset and produces no combined grade.
- Original workbook and extraction report remain local and excluded from Git.
- `OPENAI_API_KEY` and `OPENAI_MODEL` were both unconfigured during this review.
  Model output validation/fallback has mocked tests; live provider behavior is unverified.
- Source frontend client defaults to mock mode. Public deployment configuration and
  deployed backend availability were not verified in this review.

## CODEX module status

| Module | Status | Remaining work |
| --- | --- | --- |
| 1: extraction and validation | Core implemented | Select/normalize a consistent business, reporting period, and currency for real workbook analysis; supply missing debt/reserve inputs. |
| 2: financial math and A-D grade | Implemented, demo policy | Keep same-period CFADS/debt inputs, average asset/equity balances, and disclosed normalized grading targets. Prepare validated demo datasets. |
| 3: business analysis | Partial | Add dated 30/60/90-day cash forecasts and expense-history comparisons. Expand evidence-backed explanations. Current LLM only prioritizes existing findings. |
| 4: funding matcher | Not implemented | Build debt/investor matching, eligibility filters, risk reasons, and post-loan repayment checks. Funding database tables are not a matching engine. |
| 5: SWARM | Partial | Correct/confirm order cash-exposure assumptions; add business-type, resource, and distance eligibility/ranking; strengthen shop validation. Capacity, cost/profit, deposits, and per-shop funding gaps exist. |
| 7: industry trends | Not implemented | Fetch news from configured sources, preserve dates/links, deduplicate, and produce relevant opportunity/risk findings with stale/unavailable states. |

## P0: correct SWARM exposure before using funding recommendations

`app/swarm.py` currently uses:

```text
working_capital = assigned_units_per_day * unit_cost * (production_days + payment_terms_days)
```

For a single finite order of 40 units/day, 10 production days, cost THB 70/unit,
and 30 payment-term days, the smoke check produced:

```json
{"totalOrderCost": 28000, "workingCapitalNeeded": 112000, "fundingGap": 112000}
```

The formula adds production cost during payment-wait days after the stated order
production period. Confirm whether the intended product is a finite order or a
continuously producing business. For the existing single-order request, model
dated production costs, deposits, buyer collections, and committed funding;
calculate the peak cumulative cash deficit. Do not add unstated future production.
If other obligations are included, require them as explicit dated inputs.
Existing tests establish consistency with the current formula, not this business assumption.

Acceptance: test zero/long payment terms, staged collections, deposits, partial
orders, and cash reserves against an independently computed cash schedule.
Reject duplicate shop IDs and capacity usage above total capacity. Preserve
deterministic tie-breaking and disclose unallocated capacity.

## P1: complete the demo pipeline

1. Finish SWARM distance and eligibility: shop/buyer coordinates, maximum radius,
   business/resource compatibility, declared distance method, and explicit exclusions.
   Return assigned quantity, distance, cost, profit, and funding gap per shop.
2. Build 30/60/90-day forecasts from dated receivables, payables, operating costs,
   installments, and opening cash. Return minimum cash, first shortfall date,
   period-end balances, and assumptions. Missing schedules must not become zero.
3. Build funding matching using requested amount, grade, sector, tenor, product
   constraints, and explicit provider data. Compare loans and equity separately.
   Recompute proposed installments and DSCR for the same reporting period;
   return rejection reasons and avoid treating a match as financing approval.
4. Expand analysis from computed evidence and dated expense baselines. Configure
   the chosen provider/model locally, then verify valid JSON, timeout, invalid
   output, and credential failure. Calculations and grades stay deterministic.
5. Implement news/trend ingestion and analysis with source attribution. Demonstrate
   unavailable/stale source behavior without inventing live headlines.

## CLAUDE handoff: required for a real website demo

CLAUDE owns module 6 (simulator), module 8 (database/API/access control), backend
hosting, and integration through existing hooks/props or backend adapters.
Coordinate contracts without editing original visual UI code.

The current local frontend GET contracts returned HTTP 404 in the smoke check:

| Frontend contract | Handoff |
| --- | --- |
| `/api/v1/health/indicators` | Adapt validated analysis indicators to the existing envelope. |
| `/api/v1/ai/explain?page=health` | Adapt evidence-backed explanation and disclose rules/model mode. |
| `/api/v1/funding/options` | Expose computed funding matches. |
| `/api/v1/swarm/proposal` | Serve the active computed proposal; the existing stored-order lookup is not an active-proposal contract. |
| `/api/v1/cashflow/timeline` | Expose the dated forecast timeline. |

Other original frontend contracts also require reconciliation; the five above
are the minimum pipeline handoff, not a claim that the rest already work.
Basic financial/SWARM persistence exists. API authentication/RBAC enforcement,
simulation execution, and these adapters are not established by the current code.
Do not switch mock mode off until the required adapters and hosted base URL work.

## Demo acceptance checklist

- Use clearly labelled synthetic, consistent THB data for one SME and period;
  supply opening balances, debt service, revenue/expenses, operating cash outflow,
  and dated project cash movements. Include one healthy and one distressed case.
- Show input validation, deterministic metrics, A-D grade, supported findings,
  cash shortfall, eligible funding, and per-shop SWARM allocation in sequence.
- Prepare an insufficient-capacity case, a distant/ineligible shop, and a duplicate-shop rejection.
- Show a simulator A/B change in sales, costs, collection delay, or team membership
  and verify the recalculated forecast, grade, repayment coverage, and funding gap.
- Exercise missing inputs, mixed currencies, an unbalanced worksheet, provider
  failure, and unavailable news. Keep a disclosed rules mode for provider outages.
- Verify persistence if demonstrated, role access controls, deployed API health,
  frontend response contracts, and original visual layout before the final rehearsal.
- Run meaningful regression tests after implementation changes. Rehearse the
  entire website flow against the hosted backend; passing isolated unit tests
  does not establish end-to-end demo readiness.

Readiness at the original audit: deterministic backend analysis could be demonstrated through
API docs. The requested full AI/funding/SWARM/forecast website demo is not ready yet.
