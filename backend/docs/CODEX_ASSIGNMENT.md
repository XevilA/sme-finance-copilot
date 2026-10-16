# CODEX ASSIGNMENT — 2026-10-16 (one-day handover)

Claude is away until Saturday. For this one day you own **both lanes**: the math
and AI modules you normally own, and Claude's lane too — the database, the API
routes, the adapters and the frontend integration. Nothing is off limits because
of the lane split today. The UI rules below still apply in full.

Base commit: `82a355f` on `main`. Working tree was clean and in sync with origin
when this was written.

> **Authorization amendment, 2026-10-16:** The user explicitly answered
> "อนุญาต" to adding wiring in OverviewPage.tsx, SimulatorPage.tsx and SwarmPage.tsx,
> plus correcting Import file type/size copy. The allowed src paths are now exactly
> src/api/client.ts; src/features/import/ImportPage.tsx;
> src/features/overview/OverviewPage.tsx; src/features/simulator/SimulatorPage.tsx;
> src/features/swarm/SwarmPage.tsx. Preserve all styling/layout/structure/routing.
> This supersedes the two-path limit in section 4, which records the original brief.
> Current measured results and unresolved UI demo components: CODEX_HANDOFF.md,
> 2026-10-16 section. All figures at 82a355f below remain historical.

---

## 1. Read these first, in this order

| # | File | Why |
| --- | --- | --- |
| 1 | `backend/docs/AI_DEVELOPMENT_GUIDELINES.md` | The ground rules, the role split, and **§4 is the live remaining-work list grouped by impact**. §3 has the current counts. |
| 2 | `backend/docs/progress.md` | Claude's log, newest round at the top. The current-status table is at the top; each round below keeps its own historical numbers on purpose. |
| 3 | `backend/docs/CODEX_HANDOFF.md` | Your own handover notes, newest at the top, including what you asked Claude to wire and what Claude wired back. |
| 4 | `backend/docs/ANALYSIS_CONTRACT.md` | The `build_analysis` contract, including the forecast acceptance rules and the `expense-history/v1` policy. |
| 5 | `backend/docs/DEPLOY.md` | Railway steps and the pre-test checklist. Read §"เช็กลิสต์ก่อนทีม frontend มาทดสอบ" before changing anything the tester will touch. |
| 6 | `backend/docs/LIVE_PROVIDER_VERIFICATION.md` | What has and has not been proven about the live news provider. |

**Do not trust any status claim from memory, including the ones in this file.**
The docs are kept accurate but the code is the source of truth. Verify before you
build on a claim.

---

## 2. How to run

Windows `cmd.exe`. `VAR=x command` does **not** work here; configuration lives in
`backend\.env`.

```
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
python -m pytest -c backend/pytest.ini -q
```

Verified at `82a355f`: **477 pass + 3 skip** with PostgreSQL, **378 pass + 102
skip** without. 34 routes under `/api/*`, each also served under `/api/v1/*`.
27 tables; `schema.sql`, `seed.sql` and `seed_obligations.sql` are all idempotent.

Demo UUIDs are fixed: Baan Suan `11111111-1111-4111-8111-111111111111` (grade A,
healthy), Rung Charoen `22222222-2222-4222-8222-222222222222` (grade D,
distressed, 45,000 funding gap), Sahai Packing
`33333333-3333-4333-8333-333333333333`, demo order `PO-STP-2026-091`.

---

## 3. The eight features: where each one actually stands

All eight answer over HTTP today. Claude re-verified every row below against the
running app at `82a355f` — these are measured, not assumed.

| # | Module | Endpoint | Status |
| --- | --- | --- | --- |
| 1 | Data validation / Excel | `POST /api/upload` | **Works.** `GET /api/analysis/template.xlsx` → 200, 5,781 bytes; posting that file back to `/api/upload` → 200 with computed metrics. A corrupt file → 422 `"Invalid or unreadable .xlsx workbook"`. |
| 2 | Math engine + grade A–D | `POST /api/calculate`, `POST /api/v1/finance/calculate` | **Works.** Verified `liquidity = 0.7500` from a hand-built input. |
| 3 | AI analyst + forecast | `POST /api/analyze`, `GET /api/forecast` | **Works.** Returns `findings`, `grading`, `indicators`, `explanation`, `aiMode`. Forecast carries `projectedFromObligations`. |
| 4 | Funding matcher | `POST /api/match-funding`, `GET /api/v1/funding/options` | **Works.** Debt and equity separated; Rung Charoen resolves to the real 45,000 gap. |
| 5 | SWARM allocator | `POST /api/swarm` | **Works**, now including resource eligibility and `audit.eligibility` per shop. |
| 6 | What-if simulator | `POST /api/simulate` | **Works.** 11 levers, Plan A/B. |
| 7 | Industry trends | `GET /api/industry/trends` | **Route works; the provider does not.** Answers `sourceStatus: "unavailable"`, `sourceError: "timeout"` — GDELT TLS handshake times out from this network. This is environmental, not a code fault. |
| 8 | Backend / DB / RBAC | 34 routes, 27 tables | **Works**, including signed tokens, scrypt passwords, login throttle, and token revocation by session and by account. |

**So the eight features are not broken. They are unreachable from the web UI.**
That distinction is the whole of section 4.

---

## 4. 🔴 The user's bug report — diagnosed, and it is not where it looks

Reported by the user, verbatim:

> ตอนนี้คือระบบมันเหมือนยังลากไฟล์มาใส่ไม่ได้ ละรันคำนวณต่อไม่ได้ด้วย ต่อให้กรอกข้อมูลเองก้ไม่คำนวณให้อะ
> แล้วช่องกรอกข้อมูลไม่ครบ ประมาณนี้

Claude investigated this before writing the assignment. **The backend is not the
cause.** Three findings, each verified:

1. **`src/api/client.ts` contains no write path at all.** It has sixteen
   read-only `GET` wrappers and nothing else — no upload, no calculate, no
   analyze, no manual-input `POST`. Nothing in the frontend can reach
   `/api/upload`, `/api/calculate` or `/api/analyze`, because no function exists
   that calls them.
2. **`src/features/import/ImportPage.tsx` is a visual mock.** 280 lines, zero
   network calls. Its `isAnalyzing` / `analysisStep` state animates a progress
   sequence and then stops. Dragging a file in was never wired to anything, so
   it will not work whether or not a backend is running.
3. **Every client call is behind `USE_MOCK`**, which is
   `import.meta.env.VITE_USE_MOCK !== "false"` — so it defaults to **on**. Even
   the sixteen read paths serve bundled fixtures until that variable is set to
   the literal string `"false"`.

"ช่องกรอกข้อมูลไม่ครบ" is the same root cause seen from the form side.
`FinancialInput` takes **7 required** fields — `currency`, `kind`,
`period_start`, `period_end`, `assets`, `liabilities`, `equity` — and **31
optional** ones. The optional ones are what drive most of the dashboard, and the
engine deliberately returns `null` instead of assuming zero when one is absent.
Concretely: supply `revenue`, `cost_of_goods_sold` and `operating_expenses` but
omit `interest_expense` and `tax_expense`, and `net_profit` comes back `null` —
correctly, because it was never given enough to compute. A form that collects
only a few fields will therefore render a dashboard full of blanks, exactly as
the user describes.

### ⚠️ This cannot be fixed without editing files under `src/` — and that is approved

The missing piece is inside `src/`, which the standing rule puts off limits. The
user was asked directly and **granted a narrow exception in chat on 2026-10-15**,
in these words:

> อนุมัติให้ Codex แก้ src/api/client.ts กับ src/features/import/ImportPage.tsx
> ได้เท่าที่เป็นการ wiring ห้ามแตะดีไซน์

So this is settled: wiring those two files is authorised, redesigning anything is
not. You do not need to ask again, and you must not widen it.

**You may edit exactly these two files, and only for wiring:**

- `src/api/client.ts` — add the `POST` wrappers: upload (multipart), calculate,
  analyze, manual input. Follow the shape of the existing sixteen functions and
  keep `USE_MOCK` working so mock mode still runs with no backend.
- `src/features/import/ImportPage.tsx` — bind the form to real state, add the
  missing input fields, and call the new client functions on submit.

**You may not**, in these or any other file: change CSS, Tailwind classes,
colours, spacing, layout, component structure, routing, or any existing visible
copy. Add only the labels new input fields genuinely need. Touch no other file
under `src/`.

**The bundle fingerprint will change, and that is expected here.** Every build so
far has been `1955 modules` with `index-DEindwiw.css` / `index-DrkwTzbk.js`, and
that pair has been the project's tripwire for accidental UI edits. Wiring
`client.ts` into the app legitimately changes the JS hash. **Report the new
module count and both hashes in your commit message**, and confirm the CSS hash
is unchanged — if the CSS hash moves, you touched styling and must undo it.

The exception covers those two paths and nothing else. If you find that the fix
genuinely needs a third file under `src/`, **stop and say which file and why**
rather than editing it — the permission above was given for two files on the
strength of this diagnosis, and a third would mean the diagnosis was incomplete.

---

## 5. Also worth doing, in this order

1. **A good-file upload test through the real route.** The template round-trip
   above was done by hand today and is not in the suite. Add it.
2. **Fill `latitude` / `longitude` in `sme_profiles`** only if the team supplies
   real coordinates. **Do not invent them from province names** — the distance
   filter excludes a shop without coordinates deliberately, and a guessed
   position is worse than an exclusion. If no data arrives, leave it.
3. **Set a password for `admin@example.test`.** It is seeded with none, so
   `POST /api/auth/revoke` cannot be exercised by anyone:
   `python backend/scripts/set_password.py admin@example.test`
4. **Try the live news fetch from a deployed host** if the deploy happens, since
   egress differs there and that is the remaining hypothesis for the TLS timeout.

---

## 6. Request shapes that will cost you an hour if you guess

These are measured, not remembered. A frontend developer will hit all of them.

- **Two different body shapes for the same data.** `/api/calculate` and
  `/api/analyze` expect the input **wrapped**: `{"input": { ...fields... }}`.
  `/api/v1/finance/calculate` and `/api/v1/inputs/manual` take the **flat**
  object. Sending flat to the wrapped pair returns
  `422 {"loc": ["body","input"], "msg": "Field required"}`. Consider whether the
  flat form should be accepted on both — if you change this, it is an API
  contract change and belongs in the commit message.
- **`units_sold` must be a JSON integer, not a string.** `"7000"` → 422
  `int_type`. Money fields accept strings. An HTML form yields strings for
  everything, so the client must coerce that one field.
- **A missing optional field yields `null`, never zero.** This is intentional and
  must stay. Do not default anything to zero to make a screen look complete.
- **`period_start` / `period_end` are ISO dates**, and `kind` is one of
  `actual` / `forecast` / `simulated`.
- **Balance sheet is validated:** `assets = liabilities + equity`, or 422
  `"Balance sheet mismatch"`.

### Gotchas inside the stack

- A managed Postgres hands out `postgresql://`, which SQLAlchemy maps to a
  **synchronous** driver. `db.py::normalise_database_url` pins asyncpg and moves
  `sslmode` into a connect argument. Paste the host's URL unmodified.
- asyncpg validates a parameter against the column type **before** any SQL-side
  `CAST` runs, so dates, UUIDs and money must be real Python objects in the
  parameter dict, not strings.
- Postgres cannot infer a type for a bare `NULL` branch in a `CASE` and reads the
  whole expression as text. Cast explicitly.
- `ON CONFLICT DO NOTHING` cannot repair a row another code path created first.
  Use `DO UPDATE` wherever a demo seed has to converge.
- **Route order matters:** literal paths must be registered before parameterised
  ones, or `/swarm/{order_ref}` swallows `/swarm/proposal`.
- `requirements.lock.txt` is a flat pinned list, and a missing runtime dependency
  breaks the container while the local venv hides it. A test fails if one drops out.
- A heredoc in this shell breaks on an apostrophe. Use a file-writing tool for
  anything containing one.
- `load_shop_resources` requires a keyword-only `project_id` with no default. An
  unscoped read returns the same resource once per project and `ShopCapacity`
  rejects duplicate ids — this was a live bug, not a theoretical one.

---

## 7. Blocked on the team, not on code — do not try to work around these

- **Deploying the backend to Railway.** `Dockerfile`, `railway.json` and the
  startup schema bootstrap are done and were verified by building the image and
  running the container against a real Postgres. Only creating the service on the
  team's account remains, and it needs their credentials. **This is still the one
  blocker for a live web demo.**
- **Unmocking the frontend**, which follows the deploy: two Vercel variables,
  `VITE_API_BASE_URL` and `VITE_USE_MOCK=false`, then redeploy. There is no third
  variable; `VITE_BACKEND_URL` belonged to `src/services/api.ts`, which was
  deleted in `44db2f2`.
- Keep `RBAC_ENFORCED=false` and `AUTH_DEV_HEADER=false` for the tester. The
  frontend sends no auth headers, and `/funder/projects` is the one route bound to
  `resolve_principal`, so enforcement would 401 that screen alone.

---

## 8. How to work

- **Verify with real calls and real output before claiming anything works.** Hit
  the endpoint, read the row back. Do not report success from having written the
  code. Claude found a real bug this week that passing tests did not catch, and
  you found one in Claude's gate the same way.
- **When a test fails because behaviour deliberately changed, rewrite the test
  and say so in the commit. Never weaken an assertion to make it pass.**
- **Nothing invented.** A series the data cannot support is served empty with its
  name in `missing`, `status` follows `missing` so it can never claim ok while
  data is absent, and every response carries `source`. This is the rule the whole
  project is built on — the recent envelope work exists only to uphold it.
- **Say when something you were asked to do is wrong**, and say what you found
  that nobody asked about. Several real bugs here were caught exactly that way.
- Keep `backend/docs/progress.md` and the §4 list in
  `AI_DEVELOPMENT_GUIDELINES.md` current, with every number checked against the
  code rather than carried over.
- Finish each block of work with `git add`, `git commit` and `git push` to `main`.
  Write the commit message so the reasoning survives, not just the diff.

---

## 9. What to leave for Claude on Saturday

Append a section to `backend/docs/CODEX_HANDOFF.md` with: what you changed, the
measured test counts, the build's module count and both asset hashes, anything
you decided that could reasonably have gone the other way, and anything you
deliberately did not do. If you chose not to wire `src/`, say so there plainly so
it is the first thing Claude reads.
