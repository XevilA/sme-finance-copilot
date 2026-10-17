# Frontend integration handover — 17 October 2026

Branch `codex/demo-frontend`, based on main `9eebb41`. Worktree
`.worktrees/demo-frontend`. Owned here: `src/**`, the frontend wiring scripts
`scripts/test-*-wiring.mjs`, `backend/docs/progress.md` and this file. No
Codex-owned backend file, backend test, contract matrix or readiness document
was changed.

The website now runs against the real backend: import → calculation →
overview/health/cost/AI → funding → SWARM → simulator → save and read a plan
back. Where the backend has no evidence or no operation, the page says so
instead of showing a figure or a success message.

## 1. Commits and changed paths

| Commit | Scope |
| --- | --- |
| `719e616` | Data context, contract types, API client, Cost and Import |
| `30b4bd2` | Funding evaluation, SWARM constraints, simulator save/read/replay |
| `e52752b` | Unsupported actions become real operations or explicit unavailable |
| `6028b4c` | App chrome and hero diagram bound to stored project data |
| `a628b32` | Annual-rate unit fix and a render-time state update fix |

Head of branch: **`a628b32`**. 33 files changed, 2,183 insertions,
658 deletions against `9eebb41`.

```
scripts/test-import-wiring.mjs           src/features/ai-panel/AIPanel.tsx
scripts/test-page-wiring.mjs             src/features/cashflow/CashflowPage.tsx
src/api/activeAnalysis.ts        (new)   src/features/cashflow/TimeTravelScrubber.tsx
src/api/client.ts                        src/features/cost/CostPage.tsx
src/api/contracts/types.ts               src/features/funder/FunderPage.tsx
src/api/mock/seedData.ts                 src/features/funding/FundingPage.tsx
src/components/signature/FundingChip.tsx src/features/health/HealthPage.tsx
src/components/signature/ResourceTile.tsx src/features/import/ImportPage.tsx
src/components/ui/AppHeader.tsx          src/features/overview/HeroAssembly.tsx
src/components/ui/AppSidebar.tsx         src/features/overview/OverviewPage.tsx
src/components/ui/CommandPalette.tsx     src/features/projects/ProjectsPage.tsx
src/components/ui/MobileDrawer.tsx       src/features/reports/StoryModeModal.tsx
src/components/ui/StateRenderer.tsx      src/features/sales/SalesPage.tsx
src/hooks/useEnvelope.ts         (new)   src/features/shop-finance/ShopFinancePage.tsx
src/store/useAppStore.ts                 src/features/simulator/ChaosPlayback.tsx
                                         src/features/simulator/SimulatorPage.tsx
                                         src/features/swarm/SwarmPage.tsx
                                         src/features/unlock/UnlockPage.tsx
```

## 2. How the data context works

`src/api/activeAnalysis.ts` holds one accepted analysis per browser tab with
its identity, opaque input revision and input hash. `src/hooks/useEnvelope.ts`
is the single loader every page uses.

- **Identity travels with the request.** `analyze`, `calculate`,
  `funding/evaluate` and `forecast/preview` all receive the same normalized
  input and the same `input_revision`. An absent identity stays `null`; the
  free-text shop name never becomes an SME id.
- **Editing the draft retires the result.** The accepted analysis is marked
  stale, keeps its own numbers and evidence, and is rendered behind the stale
  banner with a re-analyse action. It is never replaced by stored seed data.
- **Stale replies are dropped.** Every load carries a sequence number and the
  context epoch it started under; an older reply is discarded rather than
  allowed to overwrite a newer one. SWARM scans and the simulator debounce use
  the same guard, and in-flight actions reject a second click.
- **An aggregate cannot invent dated or per-item evidence.** Once a statement
  is imported, Cashflow, Sales products and Sales channels return an explicit
  unavailable envelope (`source: "none"`) naming what is missing, because the
  statement has no dated cash events and no product or channel split, and the
  stored default SME belongs to a different statement.

## 3. API contracts consumed

| Endpoint | Where | Notes |
| --- | --- | --- |
| POST `/inputs/manual` | Import | Validation, balance check; HTTP 422 detail is shown per field |
| POST `/calculate` | Import | With `input_revision`; `persist=false` |
| POST `/analyze` | Import → Overview/Health/Cost/AI | Accepted into the tab context with its revision |
| POST `/funding/evaluate` | Funding | Grades the imported statement, not a stored seed SME |
| POST `/forecast/preview` | Funding (cash-needed date) | Null plus `cash_forecast` in missing without an SME |
| GET `/capabilities` | Funding, ShopFinance, Funder, Projects, Unlock, Simulator | Drives every unavailable state |
| GET `/simulator/context` | SWARM, Simulator, Unlock | Supplies `projectId`, `constraints`, `missing` |
| GET `/projects/{id}/constraints` | SWARM | Stored snapshot; unknown ≠ explicit empty |
| POST `/swarm` | SWARM | `persist=false` preview, with `project_id` |
| POST `/simulate/order` | Simulator, Unlock | Four controls plus `remove_shops` / `unavailable_resource_ids` |
| GET `/simulations` | Simulator | Scoped by project; reports replayable count |
| GET `/simulations/{id}` | Simulator | Read-back before success is claimed |
| POST `/simulations/{id}/replay` | Simulator | Confirms the snapshot reproduces |
| GET `/overview` `/health/indicators` `/cost/breakdown` `/ai/explain` | Pages | Used when no analysis has been accepted |
| GET `/cashflow/timeline` `/shops` `/order` `/swarm/proposal` `/shops/{id}/finance` `/funding/options` `/unlock/resources` `/simulator/chaos` `/sales/products` `/sales/channels` `/funder/projects` `/projects` | Pages, chrome, palette | Stored records |
| GET `/analysis/template.xlsx` | Import | Binary download |
| `/auth/login` `/auth/logout` `/auth/me` | Client only | Transport is ready; no login UI exists yet |

Token transport is in place: a stored token is sent as
`Authorization: Bearer …`, and HTTP 401 and 403 produce distinct messages.
CORS preflight for `authorization, content-type` from `localhost:5173` returns
200. No credential is embedded anywhere, and the header role selector is
labelled as a view filter, not a sign-in.

## 4. Verified browser flows (VITE_USE_MOCK=false, live API)

All of the following were run in a browser against `http://127.0.0.1:8000`.

1. **Valid manual import.** Eleven fields entered by hand → `/inputs/manual`
   200 → `/calculate` 200 → `/analyze` 200 → Overview switched from
   `stored_record` to `source: supplied_input` showing revenue ฿250,000,
   expense ฿200,000, net profit ฿50,000, margin 20%, cash ฿80,000, usable
   ฿50,000 against a ฿30,000 reserve, with "ข้อมูลที่ยังขาด 28 รายการ".
   Period-over-period deltas read "ยังไม่มีข้อมูลเทียบงวดก่อน", not zero.
2. **Incomplete input.** Cost showed the insufficient-data state listing
   `cost_per_unit`, `contribution_per_unit`, `breakeven_units`, `fixed_costs`,
   `variable_cost_per_unit`, `cost_lines`, `investment_cash_schedule`. This is
   the page that previously called `.toLocaleString()` on a null fixed cost.
3. **Changed draft.** Editing a field put Overview behind
   "ผลลัพธ์ล้าสมัย" with a re-analyse action while keeping the previous
   result's own numbers; the missing list gained
   `input_revision_superseded_by_draft`. Re-analysing cleared it.
4. **Funding on the imported statement.** With working capital ฿150,000,
   deposit ฿20,000 and committed funding ฿10,000, `/funding/evaluate` returned
   a ฿70,000 gap and four ranked products (Grant 65%, Invoice Factoring 29%,
   PO Financing 28%, Term Loan 0%) with real installments. Before those fields
   were supplied the page showed the unavailable state naming
   `requested_amount`, because an unknown gap is not a zero gap.
5. **SWARM preview.** Header read "ยังไม่ได้บันทึกประเภทงานที่ต้องการ ·
   ยังไม่ได้บันทึกรัศมีที่ยอมรับ"; the version row reported "ข้อมูลโครงการที่
   ยังขาด 4 รายการ"; allocation was 450/1,000 with a 550/day deficit and only
   Sahai Packing assigned, because both food shops lack the required truck.
   Readiness read "ยังรับรองความเหมาะสมไม่ได้ (ขาด 4 เงื่อนไข)".
6. **Simulator save, read and replay.** Price 120, cost 50, deposit 50%,
   terms 10 gave Plan B profit ฿945,000 and minimum shop cash ฿1,200,000.
   Saving reported "บันทึกและตรวจซ้ำแล้ว · Simulation ID:
   `99bca7b6-77d1-4aad-b50c-58ced25c7058` · engine order-what-if/v2 ·
   resultHash `917832af154c…` · replay ได้ผลเท่าเดิม". Read back out of band:
   `source: database`, the same result hash, the scenario stored with both new
   optional fields, Plan B profit 945000.0, and the scoped list grew to three.
7. **Resource outage.** Detaching the shared kitchen called
   `/simulate/order` with `unavailable_resource_ids` and reported the engine's
   own comparison: "กำลังผลิตที่จัดสรรได้ 450 (เดิม 450) · ขาดกำลังผลิต 550
   ต่อวัน (เดิม 550) · กำไรของออเดอร์ ฿607,500 (เดิม ฿607,500) · ทุนที่ขาด ฿0
   (เดิม ฿0) · เป็น preview ไม่เปลี่ยนการจัดสรรหรือสถานะทรัพยากรจริง".
8. **API failure.** With the network forced to fail, Projects showed
   "การประมวลผลไม่สำเร็จ · เชื่อมต่อ backend ไม่ได้ กรุณาตรวจ API URL และ
   CORS" with a working retry; no skeleton was left spinning and no success
   was reported. Retry recovered the page.
9. **Invalid input.** A broken balance sheet produced two HTTP 422 responses
   and the toast "body: Value error, Balance sheet mismatch: assets -
   liabilities - equity = 288889". The user stayed on Import.
10. **Unavailable actions.** ShopFinance's sign button is disabled with title
    `business_contract_required`; Projects' export button is disabled with the
    backend's reason; the four acceptance tiles show only stored flags with no
    invented counterparty names.
11. **AI panel.** Shows "กฎเกณฑ์ (deterministic)", policy `demo-v1`, real
    evidence refs from the engine, and disabled canned questions titled
    "ยังไม่มี endpoint ถาม-ตอบ".

The browser console is clean after the final fix. Two defects were found and
fixed during these runs: the annual rate was printed as a percent although the
API serves a decimal fraction, and the draft revision was published from inside
a state updater, producing a React render-phase update warning.

## 5. Build and test evidence

| Check | Result |
| --- | --- |
| `pnpm build` | **1957 modules** (baseline 1955) |
| CSS asset | **`index-DEindwiw.css`**, 60.41 kB — byte-identical to baseline |
| JS asset | **`index-8VRLbCAL.js`**, 551.02 kB (baseline `index-CBenrrOQ.js`, 513.40 kB) |
| `tsc --noEmit` | clean |
| `node scripts/test-page-wiring.mjs` | PASS — **sixteen** page style guards (was four) |
| `node scripts/test-import-wiring.mjs` | PASS — contract, context, invalidation, capabilities, failures |
| `pnpm test:invariants` | 10 invariants pass on the legacy fixture |
| Warning | JS bundle >500 kB, unchanged in kind from baseline |

The CSS hash is unchanged, so no Tailwind class, colour, spacing or shadow
moved. One new state in `StateRenderer` initially emitted a single extra
utility (`bg-slate-50/60`); it was rewritten with an existing class so the
stylesheet returns to the baseline byte for byte. The style guard was widened
from four files to sixteen and compares the `className` and `style` JSX
attributes of every page touched here against `269e3d2`; it caught three
accidental hierarchy changes during this work, all of which were reverted.
Module and JS-hash growth comes from the new context module, the shared hook
and the added wiring.

## 6. Still unavailable or demo-only

Declared unavailable by `GET /api/v1/capabilities` and rendered as such, with
the backend's own reason shown:

- Funding application, agreement signing, funder document request, report and
  PDF export, resource reservation.
- Arbitrary narrative Chaos effects. The playback reads the stored scenario
  catalogue and says so; its figures are the catalogue's, not a recomputation.
  Applying a contingency navigates and states that nothing was activated.

Not backed by the backend, and labelled accordingly:

- **Story Mode** is a pre-written narrative. Its figures illustrate the script;
  the closing slide no longer presents an on-time rate, a logistics saving or
  an NPL figure as measured outcomes. Binding it to live data is a
  presentation task for the frontend team.
- **Buy-versus-share comparison** on SME UNLOCK reads unavailable: purchase
  quotes and confirmed usage hours are not stored anywhere.
- **Investment appraisal** on Cost needs `investment_cash_schedule`; the API
  returns an empty plan list, so payback, NPV and IRR are not shown.
- **Cost categories** are returned by `/cost/breakdown` but the page has no
  place to render them. Adding one is new UI, so it was left out.
- **Cashflow deposit slider** is disabled: no endpoint recomputes a
  statement-level dated cash series. The Simulator's deposit control does
  recompute, within order scope.
- **Live industry news** is unavailable at the provider and is not surfaced.

## 7. Remaining backend and team dependencies

1. **SME identity for an imported statement.** The frontend has no way to bind
   an imported statement to an SME id, so `sme_id` is always null. That is why
   Cashflow and the dated forecast stay unavailable after an import, and why
   the funding grade comes back null. A selector or a login that yields a real
   identity unblocks Cashflow, the forecast view and the funding grade at once.
2. **Order constraints for the real project.** `required_business_types`,
   `max_distance_km`, `buyer_coordinates` and `collection_schedule` are still
   unknown for `PO-STP-2026-091`, so SWARM cannot certify suitability. The
   write endpoint exists; the values must come from the owner.
3. **Required truck.** Both food shops are excluded because their required
   cold truck is `offered`, not `confirmed`. Nothing here changes that status.
4. **Business transaction contracts.** Until an actor, a persisted state and a
   read-back exist for application, signature, information request, export and
   reservation, those buttons stay disabled.
5. **Login UI.** Token transport, 401/403 handling and `/auth/me` are wired,
   but there is no sign-in screen; adding one is new UI.
6. **Hosting.** No deployment was made or verified. Vercel still needs
   `VITE_API_BASE_URL` and `VITE_USE_MOCK=false`, and the backend host URL must
   be in `CORS_ORIGINS`.

## 8. Sunday demo checklist

Run in `cmd.exe` at `D:\code-project\sme-finance-copilot`.

```bat
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
```

Second terminal, at the repository root:

```bat
set "VITE_USE_MOCK=false"
set "VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1"
pnpm exec vite --host localhost --port 5173 --strictPort
```

Use `localhost:5173`; that origin is the one in the backend's `CORS_ORIGINS`.
Before the demo, confirm the API answers:

```bat
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/v1/capabilities
```

Then walk the flow:

1. **Overview** — the header names the stored order and buyer; the hero shows
   the stored proposal's shops, working capital, capacity and funding gap.
2. **Import → กรอกเอง 8 หมวด** — section 1: currency `THB`, kind `actual`,
   period `2026-09-01` to `2026-09-30`, revenue `250000`, cash `80000`,
   reserve `30000`. Section 2: total expenses `200000`. Section 4: assets
   `1000000`, liabilities `600000`, equity `400000`. Section 5: working
   capital `150000`, buyer deposit `20000`, committed funding `10000`.
   Submit. Expect a grade in the toast and the missing-evidence count.
3. **Overview** — source reads `supplied_input` with the numbers just entered.
4. **Cost** — insufficient data listing the exact missing field names. To show
   a populated Cost page instead, also fill section 8 (`units_sold`,
   `unit_price`, `variable_cost_per_unit`, `fixed_costs`) and re-analyse.
5. **Funding** — gap ฿70,000 with four ranked products. Open "4. ดูเอกสารที่
   ต้องเตรียม" to show the disabled submit and the backend's reason.
6. **Cashflow** — the unavailable state. This is the honest answer: a period
   total has no dated cash events, and the demo SME's table is not used.
7. **SWARM** — Radar Scan. Expect 450/1,000, a 550/day deficit, one shop
   assigned, and the four missing project conditions.
8. **Simulator** — price 120, cost 50, deposit 50%, terms 10. Expect Plan B
   profit ฿945,000 and minimum shop cash ฿1,200,000. Save, and read the toast:
   simulation id, engine, result hash and the replay result.
9. **SME UNLOCK** — detach the kitchen and read the engine's A/B comparison.
10. **Back to Import**, change one field, return to **Overview** to show the
    stale banner, then re-analyse.

Failure cases worth showing: a broken balance sheet (section 4, equity
`111111`) gives a 422 with the mismatch amount; stopping `backend\run.cmd`
gives the connection error state with a working retry.

Do not show: Story Mode as evidence of outcomes, the buy-versus-share panel,
investment appraisal, or any disabled business action as if it completed.
