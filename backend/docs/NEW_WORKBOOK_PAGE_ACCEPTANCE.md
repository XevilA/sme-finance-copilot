# New workbook and pages 3, 6–13 — 17 October 2026

## Finding

The user supplied a second translated workbook and reported `database_disabled`.
Production `/health` confirms `persistence=false`; the user confirmed there is
no online database. Import cannot create the shop/order/catalogue/project data
these screens depend on. Changing empty responses to invented rows would not
make those screens work with the uploaded business.

The second workbook previews successfully (HTTP 200, 12 records, no persistence).
Unlike the first workbook, its Thai balance sheet has nonzero values and passes
the existing balance-sheet reconciliation checks, but its headings still say
`ปี 1`/`ปี 2`, without actual reporting years. Thai income statements name
Buddhist years 2562/2561. Cash flow is USD, so it must not be merged into THB.
No private amounts or workbook bytes appear in this report or Git.

## Tested production dependencies before the UI repair

| Page | Result and actual prerequisite |
| --- | --- |
| 3 Cash flow | GET timeline 200, missing database; accepted imported totals instead require dated cash events and linked SME identity. Annual totals cannot establish daily timing. |
| 6 Sales | GET products/channels 200, missing database; imported input has no product/channel split. |
| 7 Funding | GET options 200, missing database; contextual funding evaluation also needs the funding catalogue, plus requested amount or calculable gap. |
| 8 SWARM | Order/shops/proposal 200, missing database; order context 503. Needs order, shops, capacity and constraints. |
| 9 Shop finance | No shops to select; prior UI showed "shop not selected", hiding the database cause. Needs stored allocation for a real shop. |
| 10 UNLOCK | Resources 200, missing database. Needs shared-resource records. |
| 11 Funder | Projects 200, missing database and RBAC not enforced. Needs proposals and the actual access contract. |
| 12 Simulator | Chaos catalogue 200, missing database; order context 503. Needs order/shops for computation and DB for durable save/read/replay. |
| 13 Projects | Projects 200, missing database. Needs stored project/history records. |

All nine screens were opened in the production browser before the repair.
No request crashed with HTTP 500. Missing rows are not complete business data.

## Repairs

* Nonempty statements with placeholder years now offer an explicit reporting
  year field. Gregorian/Buddhist conversion is validated, known source years
  cannot be overwritten, and mismatched years/sheets/currencies remain blocked.
  Empty templates and invalid reconciliations remain blocked. A selected year
  does not invent dates; the manual form still needs exact reporting dates and
  rejects an end date outside the selected year. No assumption that `ปี 1`
  means 2562 is applied to the user's data.
* Shared page state distinguishes an absent database from incomplete financial
  fields, including the order-context 503 response. It no longer tells the user
  that importing more Excel data can connect the backend's database.
* The shop-finance page retains the catalogue's missing reasons. Relevant
  missing imported cash-flow/product/channel evidence gets Thai labels.
  An unavailable screen without an import action no longer renders a dead button.

Build, import-selection assertions, server-rendered availability assertions,
frontend invariants and 25 parser/preview tests pass. Production verification of
the repair is recorded after deployment. This does not claim a database has
been provisioned or that missing business records have been created.

## Concrete next integration

Use an online PostgreSQL database reachable from Vercel over TLS. Set its
server-only `DATABASE_URL` in the existing Vercel project, keep `DB_POOL=null`,
apply the repository's idempotent schema through an authorized migration, and
load only explicitly labelled synthetic fixtures for prototype acceptance.
The Vercel function deliberately keeps bootstrap off. Never expose the local
Docker database to the internet or publish its credentials. Keep the user's
workbook out of fixtures and preserve its stateless `persist=false` workflow.

Accept completion only after production health reports persistence enabled,
the 27-table schema is verified, scoped HTTP writes are read back/replayed,
and all screens are rechecked with the correct business context. Pages 3/6
still need dated/product/channel evidence for the imported business even once
PostgreSQL is connected. Existing backend tests and `SUNDAY_ACCEPTANCE.md`
describe the synthetic DB acceptance path.
