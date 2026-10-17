# Excel import on the existing Vercel project — 17 October 2026

## Root cause

The production SPA had no API function, and its bundle defaulted to mock mode.
`/api/v1/capabilities` returned `text/html` (the SPA), not JSON. Merely setting
`VITE_USE_MOCK=false` would therefore turn the original warning into an API error.

The supplied translated workbook also differs from the canonical `Financials`
field/value template. Its sections must be previewed independently; combining
different currencies, years or sheets silently is invalid.

## Implementation

* `api/index.py` loads the existing FastAPI backend. `vercel.json` pins the Vite
  framework, builds with real API mode and same-origin `/api/v1`, and routes API
  requests before the SPA fallback. Python 3.12 and runtime dependencies ship
  at the repository root. `.vercelignore` and function exclusions omit local
  secrets, virtualenvs, uploads, customer templates and worktrees.
* Bootstrap is off in this function. Without an explicitly configured database,
  calculations/import/analysis work statelessly. No database is provisioned and
  no paid model is enabled. Saved projects/simulations still require a database;
  they must not be claimed as persisted when `persistence=false`.
* New read-only `POST /api/v1/upload/preview` accepts multipart `file`. A canonical
  workbook returns `{format:"financials",input,source:"supplied_input",persisted:false}`.
  A supported multi-statement workbook returns `{format:"statements",statements,
  source,status,grading,warnings,persisted:false}`. Each record retains sheet,
  section, column, period, currency, scale, fields, cells and checks. No DB writes
  or model calls occur, including on rejection. Existing `/upload` is unchanged.
* The browser allows 4 MiB (room under Vercel's multipart request limit); direct
  backend preview remains bounded to 5 MiB, with the existing 25 MiB expanded
  workbook bound. Invalid/unsupported input is 422; oversized input is 413.
* File import previews multi-statement records. Users explicitly select one
  column per section, same sheet/year/THB, with consistent known end dates, and
  confirm the business/period. Invalid/placeholder records and USD calculations
  are blocked. Selected known fields replace the draft, then manual review and
  backend validation precede analysis. Unknown fields and dates remain absent.
* Revenue and cash labels now refer to the supplied period, so annual revenue
  is not presented as a monthly average and closing cash is not called today's.

## Supplied workbook (structural findings only)

12 separate records were read successfully. English sections and the Thai
balance sheet are empty templates with placeholder years. Thai income records
are available for Buddhist years 2562 and 2561; Thai cash-flow records are USD
millions and have different period context. Choose one income year, then supply
the actual business balance sheet and exact start/end dates. Never insert a
synthetic balance sheet or combine the USD cash-flow table to manufacture a grade.
No private workbook values or uploaded bytes are committed.

## Verification

Local tests: preview/parser suite 25 passed; deployment checks 20 passed;
statement selection TypeScript assertions and frontend invariants passed.
Full no-database regression before the additional deployment assertion:
433 passed, 122 skipped. Browser upload of the supplied workbook on localhost
reached the real 12-record selection view, including the two eligible income
columns and blocked USD/template records. Production verification is recorded
separately after deployment; local success is not deployment evidence.

Vercel references: [Python functions](https://vercel.com/docs/functions/runtimes/python/api-directory),
[runtime](https://vercel.com/docs/functions/runtimes/python).
