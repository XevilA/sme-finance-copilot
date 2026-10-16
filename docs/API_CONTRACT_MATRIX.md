# API Contract Matrix — Backend / AI ↔ Frontend

อัปเดต 2026-10-16 · ตรวจ source `48d9385` + validation regression repair ในรอบนี้ และ HTTP จริง · base URL `/api/v1`.
นี่คือ contract ที่มีอยู่ ไม่ใช่ design wishlist. รายการ `/import/upload`, `/import/validate`,
`/import/confirm` เดิมไม่มี route จริง ให้ใช้ upload/manual/analyze ด้านล่าง.
ดู [แผนส่งต่อ](../backend/docs/FRONTEND_INTEGRATION_HANDOFF.md) สำหรับงานที่ยังไม่ implement.

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
