# Financial Analysis v1

The original eight metrics in `calculate_financials` stay compatible. The
`/api/calculate` and `/api/v1/calculate` routes add `businessMetrics` and `grading`.
The existing top-level calculation status describes the original eight metrics;
each additional metric and the grading object carry their own status.

Additional inputs are optional: revenue, cost_of_goods_sold, operating_expenses,
interest_expense, tax_expense, operating_cash_outflow, units_sold, unit_price,
variable_cost_per_unit, fixed_costs, initial_investment and investment_net_gain.
Missing expenses are not zero. When all income-statement fields and net_income
are supplied, they must reconcile within THB 0.01. Units sold must be a
nonnegative integer. Excel uses the same field names and validation contract.

## Business metrics

Gross profit is revenue minus cost of goods sold. Operating profit additionally
subtracts operating expenses. Net profit additionally subtracts interest expense
and tax expense. Total cost includes all four expense categories.
Cost per unit is (cost of goods sold + operating expenses) / units sold;
it excludes interest and tax. Contribution per unit is selling price minus
variable cost per unit. Break-even units round fixed costs / contribution
up to the next whole unit. A nonpositive contribution has no finite break-even.
Simple ROI is investment net gain / initial investment * 100, for the supplied
period. It is not annualized and does not imply an NPV or IRR calculation.
Debt ratio is liabilities / assets. Reserve months use a normalized 30-day
cash operating outflow, not accrual operating expenses or principal repayments.

## Grading policy: demo-v1

All component scores are clamped to 0..100:

| Component | Weight | Normalization |
| --- | --- | --- |
| DSCR | 0.35 | 100 * DSCR / 1.5 |
| Cash flow | 0.30 | 100 * (operating cash flow / revenue) / 0.20 |
| Debt burden | 0.20 | 100 * (1 - liabilities / assets) |
| Cash reserve | 0.15 | 100 * reserve months / 3 |

Period days include both endpoints. Monthly outflow is operating_cash_outflow
* 30 / period_days. Explicit zero principal and interest due with nonnegative
cash available score 100 for debt service; raw DSCR remains undefined, never
infinity. Negative cash available with no debt service is undefined.

The weighted score is rounded half up to two places, then graded: A >=80,
B >=65, C >=50, D <50. Missing or undefined components produce a null grade
and null score; weights are never redistributed. Component formulas, raw
values, scores and policy version are returned for audit. This is a hackathon
policy, not lender approval, an industry benchmark, or a calibrated default
probability. Financial distress is also reported independently of the score.

`examples/analysis_input.json` is synthetic and has grade B, score 75.00.

## Analysis API

`POST /api/analyze` and its `/api/v1/analyze` alias accept:

```json
{
  "input": {"currency": "THB", "kind": "actual", "period_start": "2026-09-01", "period_end": "2026-09-30", "assets": "100000", "liabilities": "60000", "equity": "40000"},
  "use_llm": false
}
```

This minimal request is valid but incomplete: it returns HTTP 200 with
`insufficient_data`, null metrics and a null grade. Invalid balances or
inconsistent supplied net income return HTTP 422. `use_llm` is a strict boolean.
`POST /api/analyze/excel?use_llm=false` accepts the canonical workbook through
multipart field `file`. JSON and Excel run the same validation and analysis.
The upload is capped at 5 MiB and workbook bytes are never persisted.

`GET /api/analysis/example` returns only the fixed synthetic example, marked
`simulated`. `GET /api/analysis/template.xlsx` generates the corresponding
importable workbook in memory. Both also have `/api/v1/` aliases.

An analysis response has the existing Envelope metadata, `inputHash` and
`schemaVersion: analysis-v1`. `data` contains normalized `input`, decimal-string
`metrics`, `grading`, UI-compatible `indicators`, classified `findings`,
`explanation`, `aiMode` and `aiWarning`. Every finding references at least one
available metric by `evidenceIds`. Explanation `dataUsed` includes display
values and `targetElementId` matching health-page cards. Threshold decisions
for DSCR, liquidity and reserve months use unrounded values. Display values
are rounded only at the presentation boundary.

These routes are stateless. Caller data is returned only to the caller and
is not used as a global "latest business" for other clients. SHA-256 fingerprints
describe normalized inputs; they are not anonymization, authentication or an
authorization control. The browser holds the latest result in memory and marks
it stale when inputs change. Results are not retained across a page reload.

## Rules and optional model mode

Rules identify debt service shortfalls, negative cash flow, uncovered working
capital, inadequate reserve coverage, negative equity, period losses and
nonpositive unit margins. Strengths and weaknesses are also recorded when
supported. Rules do not infer late customer payments, transaction anomalies,
industry trends or future cash from unavailable data. Unknowns explicitly
state that a dated 30-90 day forecast and expense-history analysis are outside
this milestone. Good/warning thresholds are declared demo policies; cost,
PMT and break-even cards are informational rather than industry ratings.

Default `aiMode: rules` requires no model credentials. To opt into model-assisted
prioritization, configure backend-only `OPENAI_API_KEY` and `OPENAI_MODEL`, then
send `use_llm: true`. Choose a model that supports Responses API Structured
Outputs. No provider or model is silently substituted. Do not put secrets into
VITE-prefixed variables.

The model receives calculated metrics, the grade and supported findings, not
the workbook or contact details. The request sets `store: false`. Structured
Outputs constrain its response to existing finding IDs. Backend validation
rejects unknown IDs and unexpected fields. The model cannot change metrics,
grades, evidence or recommendation text. It ranks findings within fixed
severity levels and cannot move a low-severity strength above a critical risk.
No findings are dropped. Timeout, refusal, incomplete or invalid output falls
back to rules with a visible `aiWarning`. Errors do not expose provider bodies
or credentials. Live model calls require configured credentials; unit tests
exercise the provider boundary with mocked responses.

Source: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Frontend integration and demo scope

The health page exposes a JSON input, simulated example, Excel upload and
downloadable template. Its real analysis POST calls are independent of the
existing dashboard mock flag. The AI Panel uses the same returned analysis.
Other dashboards and the original import screen retain their existing demo
behavior; no other dashboard is claimed to be integrated in this milestone.

Local Vite development proxies `/api` to `http://127.0.0.1:8000`. For an external
backend, set `VITE_FINANCE_API_BASE_URL` to its `/api/v1` HTTPS URL and configure
the frontend origin in backend CORS. On Vercel, set that variable and rebuild
after deploying the backend. Pushing the frontend code does not deploy FastAPI.

Verification: backend tests cover financial boundaries, known answers,
cross-source equivalence, evidence references, invalid inputs, isolation and
provider fallback. Frontend build and seed invariants pass. Browser testing
checks JSON analysis, invalid balances/stale results, absent credentials and
download-template-to-Excel-upload analysis. The checked example shows B / 75.00.
