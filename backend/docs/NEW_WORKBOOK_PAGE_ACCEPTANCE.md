# New workbook and pages 3, 6–13 — 17–18 October 2026

## Live prototype verification — 18 October

The user selected a separate Vercel prototype because the old deployment is in a
different Vercel team. Current public prototype:
`https://sme-finance-copilot-prototype.vercel.app/`. Its server-only Neon
PostgreSQL connection is live; production `/health` reports `persistence=true`
and `DB_BOOTSTRAP=off`. Database checks show 27 public tables and the synthetic
acceptance fixtures. No real workbook values were added to the database.

The production HTTP acceptance script passed: 44 documented API routes, 16
frontend GET contracts, template download, stateless Excel upload, manual input,
calculation, analysis, invalid upload 422, funding, SWARM, simulation and
forecast. A separate production persistence check saved a synthetic simulation,
read and listed it under its project scope, then replayed it with
`reproduced=true` and no context differences. UI pages 3 and 6–13 were loaded
against this database; the pages show their real prerequisites and explicitly
mark projected or simulated figures. Some business actions remain disabled
because the prototype has no verified contract, authorization, or source data.

The user's `Financial_Statement_Translated(1).xlsx` was uploaded to the new
prototype preview with the user's explicit approval. It read 12 candidate
statements. The six English templates are empty. Two Thai balance sheets have
values and pass reconciliation but only say `ปี 1` / `ปี 2`; the user must set
the actual reporting years before those can be selected. The Thai income
statements are selectable for Buddhist years 2562 and 2561. Two cash-flow
statements are USD and cannot be combined with THB. No statement was selected,
analyzed, or persisted during this preview check. Do not infer that the balance
sheet year 1 is 2562, or merge the USD cash flow into the THB statements.

Saved UI proof: `backend/uploads/prototype-workbook-year-preview.jpg` (ignored by
Git). No workbook bytes, private amounts, or credentials are recorded here.

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

## Prototype integration status and remaining limits

The online PostgreSQL database, production connection, schema, and synthetic
fixtures are now configured on the user's new prototype. The Vercel function
keeps bootstrap off. The old Vercel site remains in another owner's team and is
not this connected deployment. Keep the user's workbook out of fixtures and
preserve its stateless `persist=false` preview workflow.

The prototype database path is accepted: production health, all 27 tables,
scoped save/list/read/replay, and page rendering were verified. Pages 3/6 still
need dated cash events and product/channel evidence for the user's imported
business. Simulation numbers and project examples come from synthetic fixtures;
they do not describe the workbook's business. Existing backend tests and
`SUNDAY_ACCEPTANCE.md` describe the synthetic DB acceptance path.
