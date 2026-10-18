# API Contract Matrix — Backend / AI ↔ Frontend

Latest verified source: `4840723` on `main` (2026-10-18). The complete backend
suite passed against the disposable PostgreSQL test database: **555 passed, 1
skipped**. The single skip is the test that explicitly verifies behavior with
the database disabled; database-backed feature tests ran. The test database
uses synthetic seed data and is removed after the run. Historical block test
counts and branch references below describe their original runs, not this
latest verification. Current frontend instructions are in
[`frontend-integration.md`](frontend-integration.md).

Provider hardening: stable SHA-256-derived advisory transaction lock, held on one
session through fetch, cache/backoff persistence and commit. Concurrency tests
use independent DB sessions and separate Python hash seeds. Provider tests now
use synthetic gate keys/transports; they no longer clear or fake-success the
real GDELT gate. Existing assertions retained; publication-date test additionally
requires a nonempty synthetic article list. One permitted real request on
2026-10-17 at 07:02 Asia/Bangkok timed out: unavailable / 0 articles / backoff 60s,
read back from provider_fetch_state. Historical lastSuccessAt from old tests is
not evidence of live news success. No force refresh, retries or paid LLM calls.

Stored required dependencies are authoritative even when POST swarm receives
inline shops with resources=[]; clients cannot erase a required offered truck.
Saving a mixed known/unknown shop set does not persist only a subset.

The Cost page now renders nullable financial values safely. For all views,
continue to treat an unknown value as `null` and preserve the response's
`missing` fields rather than displaying an invented zero.

Final prototype validation (`f23c09e`): StatementRequest rejects coverage earlier
than input.period_end with 422; unsupported 90-day forecast calendar returns 422
instead of 500. `/capabilities` reports deterministicAnalysis mode=rules and
savedSimulationReplay.available follows DATABASE_URL configuration. This flag is
a configured capability, not a database liveness probe. Current quick start:
[backend README](../backend/README.md); consolidated route and calculation
reference: [API and math](../backend/docs/API_AND_MATH.md).

## Backend integration block 1 — implemented 2026-10-17

Branch `codex/demo-backend`, based on `5422af8`. This section supersedes legacy
notes below for the listed endpoints. Frontend is owned by Claude on
`codex/demo-frontend`; no `src/**` changes are included in this backend block.

**Breaking correction:** all five Cost scalars (`costPerUnit`, `profitPerUnit`,
`breakevenUnits`, `currentMonthlyFixedCost`, `currentMonthlyVariableCost`) are
`number | null`. Known zero remains 0. Unknown is null + missing, never a zero
placeholder. Consumers must render null without invoking `.toFixed()` on it.

| Implemented endpoint | Request location | Result / identity / errors |
| --- | --- | --- |
| POST `/api/v1/analyze` | JSON `{input, shop_name?, use_llm?, sme_id?, project_id?, input_revision?, expected_input_hash?, schedule_complete_through?}` | Existing analysis + views; context on every view; forecast view added. Stateless, no write. Expense observations bounded by input.period_end. |
| POST `/api/v1/funding/evaluate` | JSON `{input, amount?, sector?, sme_id?, project_id?, input_revision?, expected_input_hash?}` | `data:{requestedAmount:string|null, notRequired:boolean|null, grade, gradeScore, funding:[], investors:[], options:[]}`; supplied statement determines grade/DSCR, never stored seed statement. persist=false always. |
| POST `/api/v1/forecast/preview` | JSON `{input, sme_id?, project_id?, input_revision?, expected_input_hash?, schedule_complete_through?}` | Forecast continued from input cash_balance/period_end using dated rows of exactly this SME/project. No projection write. Without SME: data=null, missing=[cash_forecast], insufficient_data. |
| GET `/api/v1/capabilities` | no body/query | Explicit unavailable business transactions and available preview endpoints. |

These routes also exist under `/api`. Existing `POST /match-funding` remains a
legacy **query-parameter** API against stored statements. Imported workflows must
use `/funding/evaluate`, not GET funding/options or legacy match-funding.
No application, signing, information-request, PDF/export or reservation operation
is implemented. Keep those actions unavailable according to `/capabilities`.

`input` is the normalized FinancialInput contract (39 fields). Synthetic full
example: `backend/examples/analysis_input.json`; minimum valid request:

```json
{"input":{"currency":"THB","kind":"simulated","period_start":"2026-09-01","period_end":"2026-09-30","assets":"100000","liabilities":"60000","equity":"40000"},"input_revision":"synthetic-r1"}
```

Send the same normalized input and revision to analysis, funding and forecast.
`amount` is a decimal string. If omitted funding uses **this input's computed
funding_gap** only; unknown gap returns requestedAmount=null + requested_amount
missing, no candidates. Explicit zero returns notRequired=true, no candidates.
Sector is supplied explicitly; omission leaves investor sector evidence missing.
DB catalogue required for funding (503 without DATABASE_URL).

Every contextual response includes:

```json
{"source":"supplied_input","inputHash":"<sha256 normalized input>","contextHash":"<sha256 context plus consumed evidence>","context":{"smeId":null,"projectId":null,"inputRevision":"synthetic-r1","inputHash":"<same hash>","periodStart":"2026-09-01","periodEnd":"2026-09-30","scheduleCompleteThrough":null}}
```

`input_revision` is an opaque client revision, not authentication. Return values
must be discarded if their revision/hash differs from the active draft.
`expected_input_hash` is optional optimistic validation: mismatched or malformed
hash => 422; it is not a credential. Use the hash returned by analyze, since
normalization adds optional null fields. Do not compare contextHash across
different operations: each operation consumes a different evidence set.
UUID identities: malformed 422, unknown 404, named identity without DB 503.
An absent identity stays null, never inferred from a shop name or default SME.
Project scope filters dated events; it does not prove order membership or reserve
resources. Coverage remains an explicit caller assertion; unknown horizons null.

CORS now accepts `Authorization, Content-Type` for each configured origin only;
unlisted origins remain rejected. Auth enforcement settings are unchanged.

GET financial analysis views and POST analyze now both bound expense observations
through the selected statement period_end. Legacy GET defaults still select a
stored statement, so they must not replace accepted imported views.

## Backend integration block 2 — implemented and verified 2026-10-17

| Endpoint | Exact request | Result / errors |
| --- | --- | --- |
| POST `/calculate` | Existing JSON plus `project_id?`, `input_revision?`, `expected_input_hash?`, `schedule_complete_through?` | context/inputHash returned. Existing compute-only behavior for unknown SME is retained: persisted=false. |
| GET `/simulator/context` | query `project_id=<UUID>` and/or `order_ref=<string>`; omit both only for legacy active default | Existing `data:SwarmRequest` plus top-level projectId, constraints, contextHash. Named absent project 404; mismatched selectors 404. |
| GET `/projects/{project_id}/constraints` | UUID path | `data:null` for unknown snapshot, or exact explicit object. missing describes unknown fields. |
| POST `/projects/{project_id}/constraints` | JSON constraint snapshot (example below) | Replace snapshot, persisted=true; no allocation/reservation. Staff only when RBAC enforced; 403 other roles, 404 unknown project, 422 invalid input. |
| POST `/swarm` | Existing JSON plus optional `project_id`, `input_revision`, `input_hash` | project_id/order_ref mismatch 409; stored constraints apply when omitted by client. Preview persist=false never writes. Supplied resource state differing from DB rejected with 409 when persisting. |
| POST `/simulate/order` | `{baseline:SwarmRequest, scenario:OrderScenario, persist:false, context_missing:[], project_id?, sme_id?, input_revision?, input_hash?}` | Existing Plan A/B + engine=order-what-if/v2 and context. Linked input_hash is a reference to imported analysis, not a claim that order baseline equals a financial statement. |
| POST `/simulate` | Existing statement JSON plus StatementRequest context fields | Full request/results/plan analyses/version saved, rather than delta only. Both plans have rules findings based on their own recomputed statement; dated forecast/expense evidence remains missing. |
| GET `/simulations` | **query scope required:** project_id, sme_id or order_ref. Multiple selectors intersect. limit integer 1..100, default 30 | `data:[{simulationId,smeId,projectId,scenarioKey,createdAt,engine,context,replayAvailable}]` newest first. |
| GET `/simulations/{simulation_id}` | UUID path + **same query scope** | `data:{...summary,request,results,resultHash}`; wrong context 404, omitted scope 422. |
| POST `/simulations/{simulation_id}/replay` | UUID path + **query** scope; optional query input_revision/input_hash to compare active context. **No JSON body.** | data includes reproduced, savedResultHash, recomputedResultHash, savedEngine/currentEngine, contextDifferences, context, results, replaySource=saved_snapshot. persisted=false always. |

All paths above have `/api` and `/api/v1` prefixes. Saved storage disabled => 503.
Saved read/list/replay honor SME ownership when enforcement is on; unscoped project
plans require staff. Normal demo enforcement remains off. Project ID is a context
selector, not an authentication mechanism or approval of suitability.

Synthetic constraint snapshot (real requirements must come from the owner):

```json
{"required_business_types":["synthetic_food"],"max_distance_km":null,"collection_schedule":[{"day_index":7,"fraction":"1"}]}
```

SQL NULL / omitted key / required_business_types:null is unknown; explicit []
means no type restriction. Omitted max_distance_km is unknown; explicit null
means no distance limit. Non-null radius requires buyer_coordinates with decimal
latitude/longitude. Collection fractions must sum to one for the invoice balance.
`collection_schedule:null` remains unknown and uses the engine's explicitly
conditional settlement assumption, not an asserted real payment date.
No existing project or offered resource is backfilled/confirmed by migration.
Retained allocations keep their resource links; resources_known records an
explicit dependency-free list, distinct from unknown dependencies.

OrderScenario keeps four existing required/optional controls and adds optional
`remove_shops:string[]` and `unavailable_resource_ids:string[]`. Example:

```json
{"unit_price":"100","cost_per_unit":null,"deposit_ratio":"0","payment_terms_days":5,"remove_shops":[],"unavailable_resource_ids":["synthetic-machine"]}
```

Only IDs present in baseline may be removed/disabled (422 otherwise). Required
resource outage excludes affected shops; preference outage is reported without
inventing additional cost/delay. Unknown resources never become confirmed.
Removing every candidate returns 422 because the engine needs a nonempty
candidate set. Unsupported narrative Chaos, automatic contingency costs,
reservation and resource-capacity scheduling stay unavailable via /capabilities.

Replay uses the saved complete snapshot, not current DB values. Exact deterministic
result equality yields reproduced=true. Live order changes, engine version or
caller-supplied revision/hash differences yield status=stale and explicit
contextDifferences, even when the snapshot reproduces. Legacy partial saves are
readable with replayAvailable=false; replay returns 409. No migration invents
missing historical input/audit/version. Stored results include both order audits
or both statement metrics/grading/findings. Observation timestamps belong to the
response envelope and are excluded from deterministic statement-plan payloads.

Validation evidence: 535 passed / 3 skipped with PostgreSQL, 421 / 117 without DB
(this block's measured run). Real HTTP + DB read-back passed through
`backend/scripts/verify_backend_demo.py`: template import, persisted calculation,
shared input hash, B/75 matching, own dated forecast 70,000 minimum / 85,000 at 90
days, food-only allocation, resource outage, save/list/read/replay, 404/422 cases.
Fixtures are isolated synthetic UUIDs and cleaned after the run.

GET cashflow/timeline no longer combines all SMEs' events with one shop's opening
cash: legacy default selects one SME and returns smeId + missing default selection.
Use forecast/preview for imported closing cash/date and explicit coverage.
Malformed named SME identifiers no longer silently fall back to a demo answer.
Upload persist=false now suppresses rejection-event writes too; persist=true
continues to record rejected upload metadata as before.

อัปเดต 2026-10-16 · ตรวจ source `48d9385` + validation regression repair ในรอบนี้ และ HTTP จริง · base URL `/api/v1`.
นี่คือ contract ที่มีอยู่ ไม่ใช่ design wishlist. รายการ `/import/upload`, `/import/validate`,
`/import/confirm` เดิมไม่มี route จริง ให้ใช้ upload/manual/analyze ด้านล่าง.
ดู [สถานะฟีเจอร์และแผนส่งต่อ](../backend/docs/DEMO_HANDOFF.md) สำหรับงานที่ยังไม่ implement.

FinancialInput ปัจจุบันมี 39 top-level fields (7 required / 32 optional); inventory เป็น
optional nullable และ Excel รองรับชื่อ Inventory/Stock/สินค้าคงเหลือ/สต็อก. Import ยังรับ
38 fields; ยังไม่มีช่อง inventory หรือ stock/DIO math. Unknown ไม่กลายเป็น 0 และ NaN/Infinity
ถูกปฏิเสธ; การเพิ่ม inventory ไม่ได้เพิ่มหลักฐานสำหรับคำนวณ DIO อัตโนมัติ.

## 1. Financial view envelopes และ unknowns

Financial GET views คืน `data`, `kind`, `status`, `missing`, `asOf`, `source`;
โดยทั่วไปมี analyzedAt/evidenceRefs/unit ตาม endpoint. Binary template, auth และ
validation/operation responses มีรูปเฉพาะของตัวเอง อย่า cast ทุก response เป็น view.

```typescript
type FinancialView<T> = {
  data: T;
  kind: "actual" | "forecast" | "simulated";
  status: "ok" | "insufficient_data" | "stale" | "error";
  missing: string[];
  source: string;
  asOf: string;
  analyzedAt?: string;
  evidenceRefs?: { id: string; label: string; targetId: string }[];
};
```

`asOf` เป็นวันที่/เวลาเมื่อมีข้อมูล; offline/catalog บางคำตอบยังเป็น string ว่าง ไม่ควรแสดง
Invalid Date. source ปัจจุบันเช่น stored_record, database, supplied_input, demo_dataset, none.
source ที่อ่านจาก DB ไม่ได้ทำให้ seed กลายเป็นข้อมูลลูกค้าจริง.
Scalar unknown เป็น null, series ที่ไม่มีหลักฐานเป็น [] และมีชื่อใน missing.
missing ไม่ว่างต้องไม่อ้าง ok; grading/metric มี sub-status ให้ตรวจแยก.

**Legacy gap ที่ยังไม่ได้แก้:** Cost adapter ยังคืน costPerUnit/profitPerUnit/breakevenUnits=0
เมื่อไม่มีข้อมูล พร้อม insufficient_data/missing (ตรวจ POST analyze ขั้นต่ำจริงแล้ว).
นี่เป็น placeholder ไม่ใช่ known zero. ต้องปรับ adapter/types/หน้าที่รับผลคู่กันก่อนอ้างว่า
runtime รองรับ null ทุก widget; source ของ engine ยังแยก unavailable ถูกต้อง

**Type gap ที่ยังต้องแก้:** `src/api/contracts/types.ts` ยังไม่มี source ใน Envelope;
BusinessOverview ยังเป็น number สำหรับ scalar/diff และไม่มี netProfitMargin แม้ backend
คืน null/margin แล้ว. ตัวอย่างข้างบนอธิบาย runtime contract ไม่ได้แปลว่า types.ts แก้แล้ว.

## 2. Read contracts 16 เส้นทางที่ client มีจริง

| View | GET path หลัง base URL | Payload / บริบทจริง |
| --- | --- | --- |
| Overview | `/overview` | BusinessOverview; scalar/diff nullable, netProfitMargin; kind ตาม input |
| Cashflow | `/cashflow/timeline` | CashflowDay[] จาก dated events; รับ sme_id, ไม่แผ่ยอดรวมเป็นรายวัน |
| Shops | `/shops` | Shop[] พร้อม UUID จริง; ไม่กำหนดจำนวนร้านตายตัว |
| Order | `/order` | SwarmOrder หรือ null; active stored order ตาม ACTIVE_PROJECT_ORDER |
| Stored proposal | `/swarm/proposal` | SwarmProposal ที่บันทึก; ไม่ใช่ POST preview ล่าสุด |
| Shop finance | `/shops/{shop_id}/finance` | ShopFinance หรือ null; UUID จริง, optional order_ref เพื่อ pin โครงการ |
| Funding options | `/funding/options` | FundingOption[]; sme_id/amount optional; default หา SME ที่มี gap ไม่ใช่ imported input |
| UNLOCK catalogue | `/unlock/resources` | UnlockResource[]; read ไม่ใช่ reservation/detach transaction |
| Chaos catalogue | `/simulator/chaos` | ChaosScenario[] ที่เก็บไว้; การอ่าน scenario ไม่ได้ run simulation |
| Health | `/health/indicators` | HealthIndicator[]; value nullable, trend ไม่มีหลักฐานต้องว่าง |
| Cost | `/cost/breakdown` | CostBreakdown; ไม่มี dated investment schedule ไม่สร้าง NPV/IRR |
| Products | `/sales/products` | ProductSales[] จาก catalogue; ไม่ได้คำนวณ product breakdown จากงบที่ import |
| Channels | `/sales/channels` | ChannelSales[] จาก catalogue; ไม่มีแถวไม่แต่ง channel split |
| Funder | `/funder/projects` | FunderProject[]; route ใช้ resolve_principal, อย่าเปิด enforcement โดยยังไม่ต่อ token |
| Projects | `/projects` | ProjectRecord[] ที่บันทึก; ไม่สร้างไฟล์ report/export |
| AI panel | `/ai/explain?page={id}` | AIResponse จาก rules; รับ sme_id/coverage; GET นี้ไม่เรียก LLM |

Overview/Health/AI รับ sme_id และ schedule_complete_through; Cost รับ sme_id.
Client ปัจจุบันยังไม่ได้ส่งบริบทเหล่านี้ครบทุก getter. acceptedAnalysis แทน GET ของ
Overview/Health/Cost/AI ในแท็บหลัง analyze สำเร็จ; getter อื่นยังอ่าน DB/default.
ห้ามคิดว่าการสลับ page ทำให้ทุกหน้าผูก imported input เดียวกันแล้ว

## 3. Input / engine / write endpoints ที่มีจริง

| Method / path | Request จริง | ผล / ข้อจำกัด |
| --- | --- | --- |
| GET `/analysis/template.xlsx` | ไม่มี body | binary XLSX template Financials |
| POST `/inputs/manual` | FinancialInput แบบ flat | validated data / balanceSheetValid; ไม่ใช่ analyze |
| POST `/finance/calculate` | FinancialInput แบบ flat | v1-only legacy calculate; ไม่ใช่ wrapped CalculateRequest |
| POST `/upload?persist=false` | multipart file, .xlsx ≤5 MiB | input, metrics, businessMetrics, grading, upload metadata; fileStored=false |
| POST `/calculate` | `{input: FinancialInput, sme_id?:string, persist?:boolean}` | metrics/businessMetrics/grading; persisted/recordId ตาม write จริง |
| POST `/analyze` | `{input, shop_name?, use_llm?, sme_id?, schedule_complete_through?}` | data + views Overview/Health/Cost/AI, source/inputHash; stateless |
| POST `/swarm` | order terms + shops inline หรือ sme_ids; persist=false สำหรับ preview | allocation totals/shops/stuckReasons + audit.eligibility; ไม่รับสมาชิก 6 ร้านตายตัว |
| GET `/simulator/context` | ไม่มี body | SwarmRequest machine fields จาก active project/shops/resources; 503 ถ้าไม่ตั้ง DATABASE_URL |
| POST `/simulate` | `{input, scenario, swarm?, sme_id?, persist?, scenario_key?}` | statement Plan A/B, metrics/grading/delta; ไม่ได้สร้าง analysis findings ใหม่ |
| POST `/simulate/order` | `{baseline, scenario:{unit_price,cost_per_unit,deposit_ratio,payment_terms_days}, persist:false, context_missing:[]}` | order Plan A/B, audit, scope=order_only; persist=true เก็บ full replay input/results + simulationId |
| POST `/match-funding` | query sme_id, amount?, project_id?, persist?; ไม่มี JSON body | จัดอันดับ debt/equity จาก stored SME; ไม่ใช่ loan application |
| GET `/forecast` | query sme_id, as_of?, project_obligations?, schedule_complete_through? | dated forecast/conditional values; default project_obligations=true อาจ upsert cash events |
| GET `/industry/trends` | query sector?, force_refresh? | provider/cache status + articles/signals; ยังไม่ยืนยันข่าวสดสำเร็จ ไม่ force ระหว่าง acceptance ปกติ |

`/calculate/excel`, `/analyze/excel` ใช้ multipart file; v1-only `/inputs/excel` และ
`/finance/calculate/excel` ยังมี. Main router paths มีทั้ง `/api` และ `/api/v1` aliases.
Auth มี POST `/auth/login`, `/auth/logout`, `/auth/revoke-all`, `/auth/revoke` และ
GET `/auth/me`; token/revoke ไม่ใช่การสลับ role ใน AppHeader

## 4. Validation, precision และ scope

- 7 required FinancialInput fields: currency, kind, period_start, period_end, assets,
  liabilities, equity. optional ว่างให้ละ ไม่แปลงเป็น 0. assets=liabilities+equity ภายใน tolerance.
- เงิน/rate ใช้ decimal strings; units_sold/จำนวนงวด/เครดิตเป็น JSON integers.
  deposit_ratio เป็น 0..1 ไม่ใช่เปอร์เซ็นต์ 0..100. cost_per_unit=null ใน order scenario
  คงต้นทุนแต่ละร้าน; override คือสมมติฐานเดียวกันทุก candidate แล้วจัดสรรใหม่.
- Input ผิด HTTP422; workbook เกินขนาด HTTP413. HTTP200 + insufficient_data เป็น partial
  result ให้ใช้ส่วนที่มีหลักฐานและบอกส่วนที่ขาด ไม่ค้าง skeleton ทั้งหน้า.
- Order profit เป็นก่อนค่าใช้จ่ายอื่น; minimumShopCash คือเงินต่ำสุดของร้านที่รับงาน
  ไม่ใช่ผลรวม surplus ข้ามร้านหรือ forecast ทั้งกิจการ 90 วัน.
- SWARM persist=false ไม่จอง quota/resources; persist=true เปลี่ยน stored allocations.
  Calculate/upload persistence ต้องมี SME จริง; ชื่อ free text ไม่ใช่ identity.
- Preview/default/sample ไม่ใช่ plan ที่ผู้ใช้ลงนามแล้ว. เมื่อ input/context เปลี่ยนต้องไม่ใช้
  stale response หรือ generic default SME มาทับผลล่าสุด

## 5. ปุ่มที่ยังไม่มี backend operation

Funding application, agreement signing, funder document request, report/PDF export,
resource-detach recomputation และ Chaos apply ยังมี handler ฝั่ง UI/demo.
Saved simulation มี POST save แต่ยังไม่มี GET read/list/replay endpoint.
ห้ามต่อกับ path เดาหรือแจ้ง success จาก timer/local state.
ให้ CODEX ทำ backend contract + tests/read-back หรือ wiring unavailable ที่ตรงความจริง
ก่อนส่งทีม frontend ทำ presentation; ดู backlog/acceptance ใน handoff

AI evidence ใช้ evidenceIds/dataUsed.targetElementId จากผล SME/input เดียวกับตัวเลข.
Animation/Story/Phase เป็น presentation ไม่ใช่หลักฐานว่า engine หรือ write ถูกเรียกแล้ว

## Excel preview addition — 2026-10-17

`POST /api/v1/upload/preview` (also `/api/upload/preview`): multipart `file`,
read-only, no SME/project identity required. `format=financials` returns validated
`input`; `format=statements` returns separate scoped records and no combined
FinancialInput/grade. `persisted=false` always. Invalid/unsupported files: 422;
over 5 MiB: 413. Browser limit: 4 MiB on Vercel. Selection is transferred to the
manual review form, then submitted to the existing manual validation/analyze
contracts. See [workbook and input rules](../backend/docs/API_AND_MATH.md#financial-input-and-workbook-formats).
