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
