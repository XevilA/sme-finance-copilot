# CODEX implementation handoff

## Block 1: finite-order SWARM cash exposure

The business assumption changed from continuous production through credit days
to a finite order. Production costs occur only on days 1..duration_days. The
initial deposit is received on day 0; the remaining invoice is collected on
delivery day plus payment terms, unless explicit collection fractions are supplied.
Costs precede buyer collections on the same day. Working capital is the peak
cumulative deficit excluding the initial deposit; funding gap includes the
deposit once and subtracts usable cash above the reserve.

The 40 units/day, 10-day, THB 70/unit, 30-day-credit example now needs THB 28,000,
not THB 112,000. The two existing formula-specific tests were updated because
the business assumption changed. All 241 tests passed with Postgres at this block.
The `allocate()` envelope, shop rows, and audit keys are unchanged; engine and
proposal version values are now `v2`.

### CLAUDE actions

- Recalculate and update `db/seed.sql` allocation amounts, then reseed using the
  team's approved process. Existing stored allocations still contain old values.
  No database reset or seed-file modification was performed by CODEX.
- Forward optional `SwarmRequest` inputs through `SwarmBody` and simulator inputs:
  `production_start` (ISO date), `collection_schedule` (day_index/fraction pairs
  summing to 1 of the invoice balance after deposit), `required_business_types`,
  `buyer_coordinates` (latitude/longitude), and `max_distance_km`.
- Forward `ShopCapacity.business_type` and `.coordinates`. Existing `sector` can
  supply business_type. Add nullable numeric latitude/longitude columns to
  `sme_profiles`; validate latitude -90..90 and longitude -180..180. No DB schema
  changes were made by CODEX. No coordinates are invented from province text.
- Catch `ValidationError` when constructing `SwarmRequest` inside the route and
  return HTTP 422, or duplicate its shop-id uniqueness validator on `SwarmBody`.
  Core duplicate-id validation currently occurs after `SwarmBody` validation.
- `shop_eligibility(shop, request)` returns eligible, distance_km, and reasons.
  Distance is Haversine straight-line km, not driving distance. A required radius
  excludes shops without coordinates. Business type is an exact case-insensitive
  match. Eligible candidates rank by cost, distance, available capacity, then id.
- `app/order_cash.py::finite_order_schedule()` exposes dated movements if a
  production_start is supplied; otherwise day_index is relative and date is null.

Frontend files, adapters, catalog, repository, models, routers, RBAC, and SQL files
were not edited.

## Block 2: funding and investor ranking

```python
from app.matching import match_funding, match_investors

def match_funding(data: FinancialInput, grade: dict, requested_amount: Decimal,
                  products: list[dict]) -> list[dict]: ...

def match_investors(data: FinancialInput, grade: dict, requested_amount: Decimal,
                    investors: list[dict], *, sector: str | None = None,
                    investment_horizon_months: int | None = None) -> list[dict]: ...
```

`products` accepts the exact camelCase rows from `load_funding_products()`.
Investor rows support database snake_case and camelCase. Both functions are pure,
validate candidates, reject duplicate IDs, and sort deterministically by status,
descending score, then ID. Positive requested amounts are required.

Funding result shape (all money and ratios are decimal strings):

```json
{
  "product_id": "catalog-id",
  "match_score": 91,
  "match_reason": "Meets supplied numerical screening criteria; verify documents and provider conditions",
  "status": "eligible",
  "monthly_payment": "888.49",
  "period_installments": "1",
  "additional_period_debt_service": "888.49",
  "post_funding_dscr": "1.9425",
  "missing": [],
  "notice": "Demo ranking of supplied numerical criteria only; not credit approval or an investment offer. Verify documents and provider conditions.",
  "policy_version": "funding-match-demo-v1",
  "assumptions": ["Declared demo scoring and repayment assumptions"]
}
```

The dictionary also documents the complete assumptions at runtime. The post-loan
DSCR stress test uses monthly PMT multiplied by calendar-month equivalents of
the same input reporting period, capped at loan tenor. A whole calendar year
has 12 installments, a whole month has one, and partial months are proportional.
This is a stress model, not an inferred first-payment date or lender schedule.
New coverage must meet the higher of product min_dscr and demo floor 1.0.
Scores weight coverage 45%, grade 25%, financing cost 20%, disbursement speed 10%.

Grant products have zero repayment and add no debt service. In particular,
CLAUDE should use the matcher's zero grant payment instead of treating a 0%-rate
grant as an amortizing loan. Existing adapters were not changed. Existing hard
amount eligibility is preserved, with the additional post-funding coverage test.

Investor results use `investor_id` instead of `product_id`, with match_score,
match_reason, status, missing, notice, policy_version, and assumptions. They have
no monthly_payment or proposed debt-service fields. Ticket, target sector,
minimum grade, optional existing DSCR, and declared demo risk appetite are
screened separately from debt. Missing sector, grade, or horizon produces
requires_info; valuation, dilution, and investment approval are not inferred.

CLAUDE can wire POST /api/match-funding, map snake_case results into the existing
frontend matchScore/matchReason fields, use the returned status, and persist
to funding_matches/investor_matches. No ranking route or DB access was added.

## Block 3: dated 30/60/90-day forecasts

```python
from app.forecasting import forecast_cashflow, project_cash_events

def forecast_cashflow(events: list[dict] | None, *, opening_cash: Decimal | None,
                      as_of: date, minimum_cash_reserve: Decimal | None = None,
                      schedule_complete_through: date | None = None,
                      include_simulated: bool = False) -> dict: ...

def project_cash_events(*, as_of: date, sme_id: str, project_id: str | None = None,
                        receivables: list[dict] | None = None,
                        payables: list[dict] | None = None,
                        operating_costs: list[dict] | None = None,
                        installments: list[dict] | None = None) -> dict: ...
```

Forecast input accepts exact camelCase `load_cash_events()` rows or snake_case
cash_events dictionaries. Always call the catalog with a specific SME ID;
catalog dictionaries omit tenant IDs, so scope cannot be verified after mapping.
The opening cash snapshot includes movements through as_of; past/as-of rows
are not applied again. Calculations use end-of-day net cash, not inferred
intraday order. No synthetic daily movements are inserted between event dates.

Result keys include `minimum_cash`, `minimum_cash_date`, `first_shortfall_date`,
`first_negative_date`, `first_reserve_breach_date`, `period_end_balances` keyed
by `"30"`, `"60"`, `"90"`, `timeline`, `missing`, `status`, and `assumptions`.
Money is serialized as decimal strings. Shortfall is below the specified cash
reserve, or negative bank cash when no reserve is supplied. Unknown reserves
remain null and are never silently asserted to be zero.

`schedule_complete_through` must be explicitly confirmed by the caller. Without
complete coverage, main forecast fields for those horizons remain null and
status is insufficient_data. `conditional_minimum_cash`,
`conditional_first_shortfall_date`, and `conditional_period_end_balances` show
only what the supplied schedule implies. They must not be displayed as a full
forecast. A missing or unconfirmed empty schedule is declared in missing;
it never becomes a zero forecast. An explicitly complete empty schedule may
legitimately preserve a known cash snapshot without future movements.

The seven demo events, replayed as of 2026-09-30 with THB 5,000,000 opening cash
and explicit coverage through 2026-12-29, yield minimum cash THB 3,370,000 on
2026-10-25 and 30/60/90-day endings THB 3,370,000 / 3,370,000 / 5,770,000.
The 2026-11-30 buyer collection is day 61 and is not counted in day 60.

Projected obligation DTO: `{id, due_date, amount, title, partner?}`. Supply only
outstanding source obligations. Unknown category (`None`) differs from a known
empty category (`[]`). Overdue rows require a real rescheduled date; they are
reported in overdue/missing instead of moved to an invented future day.
The generator returns `{events, missing, overdue, status}`. Each event has a
stable UUID, sme_id, project_id, event_date, day_index, type, title, amount,
is_inflow, partner, status=projected, impact_reason. Day indices are relative to
the supplied as_of. IDs remain stable when amounts or due dates are corrected.

CLAUDE should upsert generated rows by id, convert ISO event_date to a DATE as
needed, and preserve the tenant/project association. No additional DB columns
are required. Never assert completeness while source categories are unknown.
No DB reads/writes or route changes were added by CODEX. `build_analysis()`
keeps its signature and result shapes; its unknowns now direct callers to this
forecast function rather than claiming the module does not exist.
