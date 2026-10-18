# API, data contracts, and calculations

This is the backend contract for frontend engineers. Routes are available under `/api` and `/api/v1`; the latter is the versioned path used by the deployed frontend. JSON responses normally use an envelope with `data`, `kind`, `status`, `missing`, `asOf`, and `source`. Treat `source`, `status`, and `missing` as data: do not present demo or incomplete values as verified business facts.

## Main routes

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Process, database, bootstrap, and authentication status |
| `GET /api/v1/capabilities` | Runtime availability of operations; use this before enabling action buttons |
| `POST /api/v1/inputs/manual` | Validate a `FinancialInput` JSON body |
| `POST /api/v1/inputs/excel` | Validate an uploaded workbook (`multipart/form-data`, field `file`) |
| `POST /api/v1/finance/calculate` | Calculate financial indicators from a `FinancialInput` |
| `POST /api/v1/finance/calculate/excel` | Parse and calculate from an uploaded workbook |
| `POST /api/v1/analyze` | Deterministic analysis and financial grade |
| `GET /api/v1/overview` | Overview from the latest stored statement or the labelled demo dataset; optional `sme_id` |
| `GET /api/v1/health/indicators` | Evidence-backed health indicators; optional `sme_id` |
| `GET /api/v1/ai/explain?page=overview` | Rules-based explanations with evidence and missing-data notes |
| `GET /api/v1/cost/breakdown` | Cost breakdown for the selected statement |
| `GET /api/v1/forecast` | Dated cash forecast from stored events; coverage must be explicitly confirmed |
| `POST /api/v1/forecast/preview` | Non-persisted forecast preview against a supplied statement |
| `GET /api/v1/industry/trends` | Cached/provider-backed headline signals when the provider is configured and reachable |
| `POST /api/v1/match-funding` | Funding matching for a supplied statement |
| `POST /api/v1/funding/evaluate` | Evaluate a supplied statement against the stored funding catalogue |
| `POST /api/v1/swarm` | Preview an order allocation across available shops/resources |
| `GET /api/v1/swarm/proposal` | Read the latest persisted SWARM proposal |
| `GET /api/v1/simulate/order` and `POST /api/v1/simulate/order` | Load and recompute an order scenario, including supported resource outage inputs |
| `GET /api/v1/simulations` and `POST /api/v1/simulations/{id}/replay` | List and replay saved simulations; database required |

The `auth` routes exist, but authentication is not enforced in the current public demo. Read [feature readiness](DEMO_HANDOFF.md) before relying on operations that create business commitments.

## Financial input and workbook formats

`FinancialInput` requires `currency`, `kind`, `period_start`, `period_end`, `assets`, `liabilities`, and `equity`. `currency` is `THB`; `kind` is `actual`, `forecast`, or `simulated`; dates use ISO `YYYY-MM-DD`. The balance sheet must satisfy `assets = liabilities + equity` within 0.01. Optional values stay missing when unknown; use zero only when zero is known.

The canonical workbook has a `Financials` sheet with `field` and `value` in columns A and B. Thai aliases are supported by the extraction parser. Each field occupies one row. Formulas, Excel errors, duplicate aliases, unknown fields, and extra columns are rejected. The API accepts `.xlsx` up to 5 MiB; expanded ZIP content is limited to 25 MiB, with at most 1,000 ZIP entries and 100 data rows for the canonical parser. No workbook formulas are executed.

The multi-statement parser can extract separate tables from the supplied translated financial-statement format, with source cell references, period, currency, scale, and reconciliation checks. It does not merge unlike periods/currencies into a single `FinancialInput`. Select statements for the same entity, currency, and compatible reporting period before analysis; do not infer grade or debt coverage from incomplete inputs.

Amounts use `Decimal` internally. Send money as decimal strings when possible. Invalid input returns HTTP 422, files over the upload limit return 413, and unavailable database-dependent operations return 503. A successful HTTP response can still be `insufficient_data`; inspect each metric's `status`, `reason`, and `missingFields`.

## Calculation rules

| Metric | Formula | Output |
| --- | --- | --- |
| Free cash flow | `operating_cash_flow - capital_expenditure` | THB |
| Net cash flow | `operating_cash_flow + investing_cash_flow + financing_cash_flow` | THB |
| ROA | `net_income / average_assets * 100` | percent for supplied period |
| ROE | `net_income / average_equity * 100` | percent for supplied period |
| Liquidity | `current_assets / current_liabilities` | ratio |
| Funding gap | `max(0, working_capital_needed - usable_cash - buyer_deposit - committed_funding)` | THB |
| DSCR | `cash_available_for_debt_service / (debt_principal_due + debt_interest_due)` | ratio |
| Loan payment | Periodic annuity payment from principal, annual rate, number of payments, and timing | THB per payment |

Average assets/equity use opening and closing balances. ROA/ROE are not annualized. `usable_cash = max(0, cash_balance - minimum_cash_reserve)`. CAPEX is a positive expenditure for free cash flow; investing cash flow already includes it and is not adjusted again for net cash flow. Funding-gap inputs must represent distinct sources, so deposits or committed financing are not counted twice. DSCR requires cash available for debt service explicitly; it is not silently replaced with CFO or free cash flow.

Zero/invalid denominators produce an undefined result, and missing inputs produce `insufficient_data`, not an assumed zero. Money values are rounded to two decimal places and ratios/percentages to four decimal places. These calculations support a prototype decision aid and do not replace accounting or credit review.

## AI behavior and provenance

The default analysis is deterministic and rules-based. Findings reference supplied or stored evidence, include confidence/limitations, and preserve unknowns. The AI explanation route does not imply an LLM call when `aiMode` is `rules`. Optional model mode is server-configured; never send financial data or credentials to an unconfigured provider. Data sources include `supplied_input`, `stored_record`, `demo_dataset`, and `none`; display the source in the UI.
