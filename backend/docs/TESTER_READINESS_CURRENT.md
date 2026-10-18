# สถานะ prototype ก่อนส่ง tester — 2026-10-18

Production prototype ใหม่: [sme-finance-copilot-prototype.vercel.app](https://sme-finance-copilot-prototype.vercel.app/).
ผู้ใช้เลือกสร้างในบัญชี Vercel ของตน เพราะเว็บเก่าอยู่คนละทีม. Neon PostgreSQL
ออนไลน์, `/health` persistence=true, bootstrap=off, schema 27 ตารางพร้อม fixtures
สังเคราะห์. ตัวเว็บเก่าไม่ได้เชื่อมฐานข้อมูลนี้.

| การตรวจ production | ผล |
| --- | --- |
| Backend routes / frontend GET contracts | 44 / 16 ผ่าน HTTP |
| Upload / manual / calculate / analyze | template ผ่าน, invalid upload 422, B/75 กับ input สังเคราะห์ |
| Funding / SWARM / forecast / simulation | ผ่านด้วย fixture สังเคราะห์ |
| Scoped simulation save/list/read/replay | ผ่านบน production; replay reproduced=true |
| หน้า browser | หน้า 3 และ 6–13 โหลดและแสดงผลตามข้อมูล/ข้อกำหนดที่มี |
| UI/API download | entry JS production 215.42 KB / 65.57 KB gzip; feature pages โหลดตามการเปิด; API region sin1 อยู่ใกล้ Neon, overview/projects 0.29/0.26s; browser หน้า 1, 3, 13 ผ่าน |
| Excel ที่ผู้ใช้ส่ง | Preview อ่าน 12 statements; ยังไม่เลือก/คำนวณ/บันทึกข้อมูลจริง |
| AI | rules/fallback ผ่าน API; ไม่มี paid LLM key และ auth enforcement ปิด |

ไฟล์ Excel มีงบฐานะไทยที่ปีบัญชีไม่ระบุ (`ปี 1`/`ปี 2`), P&L ปี 2562/2561,
และ cash flow สกุล USD. ต้องให้ผู้ใช้ยืนยันปีจริง และเพิ่ม cash-event กับ
product/channel data ก่อนใช้วิเคราะห์หน้า 3/6 ของธุรกิจนั้น. ข่าวสด,
ลงนาม/จัดสรรทุน, resource reservation และ export ยังไม่พร้อมใช้.

หลักฐานและขอบเขตอยู่ใน [CODEX_HANDOFF.md](CODEX_HANDOFF.md) และ
[NEW_WORKBOOK_PAGE_ACCEPTANCE.md](NEW_WORKBOOK_PAGE_ACCEPTANCE.md).

---

# สถานะ backend ก่อนส่ง tester — 2026-10-17 (ประวัติ)

Current runtime **f23c09e**, เริ่มจาก 5422af8, backend branch codex/demo-backend.
Backend รวมเข้า main แล้ว; ผู้ใช้ให้เน้น backend ก่อนเพราะ Claude ติด limit.
**Backend core พร้อมใช้ local prototype วันนี้** ตาม [PROTOTYPE_TODAY.md](PROTOTYPE_TODAY.md).
**Frontend integration และ deployed browser acceptance ยังไม่เสร็จ**.

| ผลตรวจล่าสุด | ค่า |
| --- | --- |
| pytest PostgreSQL | **545 passed / 3 skipped (34.03s)** |
| pytest ไม่มี DB | **426 passed / 122 skipped (10.29s)** |
| Tests เพิ่ม | **35**, ไม่ลด assertions เดิม |
| Main API paths / DB / legacy read contracts | **43 / 27 tables / 16** |
| HTTP/DB synthetic end-to-end | import/calculate/analyze/funding/forecast/SWARM/save/list/read/replay ผ่าน |
| Auth HTTP + DB | synthetic actors/ephemeral secret ผ่าน; demo enforcement คง false |
| Build หลังรวม backend | **1955 modules / index-DEindwiw.css / index-CBenrrOQ.js** |
| Client/style checks | import/page scripts + 4 style guards ผ่าน |
| Live news | **unavailable**, real attempt timeout, 0 articles, backoff 60s |
| Deploy/browser ใหม่ | **ยังไม่ได้ตรวจ/ไม่มี deployment ใหม่** |

| โมดูล | สถานะ | ขอบเขตจริง |
| --- | --- | --- |
| 1 Validation/Excel | **real usable (backend)** | 39 FinancialInput fields, template XLSX <=5 MiB; required/finite/nullable/inventory aliases คงเดิม; Import ยัง 38 ไม่มี auto mapping/DIO |
| 2 Math/grade | **real usable (backend)** | Decimal metrics/evidence/grade; unknown Cost null ไม่ใช่ 0 |
| 3 Analyst/forecast | **partial** | rules, own evidence/scoped dated preview ใช้ได้; optional LLM fallback ผ่าน tests แต่ไม่มี paid live call รอบนี้; frontend shared context ยังไม่ครบ; GET/POST expense period alignment แก้แล้ว |
| 4 Funding | **real usable (evaluation)** | imported input จัดอันดับ debt/equity ได้ เกรด/amount ของ input เดียวกัน; application unavailable |
| 5 SWARM | **partial** | constraints/eligibility/resources preview/persistence พร้อม; real business inputs ยังขาดและรถ required offered, ไม่มี resource reservation/capacity-time contract |
| 6 Simulator | **partial** | four controls, resource outage/shop removal, scoped save/read/replay ใช้ได้; arbitrary Chaos/universal business forecast และ frontend saved-plan wiring ยังไม่พร้อม |
| 7 Industry | **unavailable (live)** | cache/gate/unavailable behavior ทดสอบแล้ว แต่ 0 live articles; ไม่ใช้ lastSuccessAt จาก tests เก่ายืนยันข่าว |
| 8 DB/API/auth | **partial** | persistence + synthetic HTTP tokens/revocation/CORS ผ่าน; demo auth off, frontend login/context integration และ hosting ยังรอทีม |

เร่งด่วนเมื่อ Claude กลับมา: CostPage.tsx:105 เรียก nullable fixed cost ด้วย
.toLocaleString() โดยไม่ guard. Partial Cost API ถูกต้องแล้ว แต่หน้านี้ยัง crash ได้.
Frontend-owned files ไม่ถูกแก้ในรอบนี้. Funding/Cashflow ต้องใช้ POST contextual APIs,
draft changes invalidate accepted snapshot, ต่อ scoped saved reads/replay และ unavailable
capabilities. อย่าอ้างว่าทั้งแปดฟีเจอร์ใช้งานผ่าน browser ครบ.

คำสั่ง cmd.exe และ acceptance วันอาทิตย์ฉบับเต็ม:
[SUNDAY_ACCEPTANCE.md](SUNDAY_ACCEPTANCE.md). Contracts/examples/null/errors/identity:
[API_CONTRACT_MATRIX.md](../../docs/API_CONTRACT_MATRIX.md). ผล/ข้อจำกัดรอบนี้อยู่บนสุด
[CODEX_HANDOFF.md](CODEX_HANDOFF.md). ไม่ reset/reseed volume, ไม่แก้ .env หรือทรัพยากรเดิม.

---

# ประวัติรอบ 2026-10-16 (ไม่ใช่ผลตรวจล่าสุด)

# สถานะก่อนส่ง tester — ตรวจจริง 2026-10-16

ตรวจซ้ำ runtime source `48d9385` + validation regression repair ในรอบนี้ · ทีมอนุญาต frontend wiring ทุกไฟล์ที่จำเป็น
โดยคง UI เดิมแล้ว. ข้อจำกัดห้าไฟล์ในรอบเก่าเป็นประวัติ ไม่ใช่ข้อห้ามปัจจุบัน.
แผนส่งต่อ backend/AI, owner และ acceptance อยู่ใน FRONTEND_INTEGRATION_HANDOFF.md.
รอบนี้แก้เอกสารและ validation regression; ไม่มี src/UI หรือ deployment ใหม่

| ผลวัด | ค่า |
| --- | --- |
| pytest กับ PostgreSQL | 510 passed / 3 skipped |
| pytest ไม่มี DATABASE_URL | 410 passed / 103 skipped |
| targeted validation/Excel/AI หลังแก้สุดท้าย | 49 passed |
| regression tests เพิ่ม / tests เดิม | 16 เพิ่ม / ไม่ลด assertion เดิม |
| เส้นทาง /api/* ไม่รวม v1 aliases | 36 (+ 4 v1-only และ /health) |
| DB / frontend GET contracts | 27 tables / 16 ผ่าน HTTP |
| frontend build | 1955 modules / CSS index-DEindwiw.css / JS index-CBenrrOQ.js |

## เริ่มใน cmd.exe

```bat
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
```

เปิดอีก terminal ที่ repo root:

```bat
set "VITE_USE_MOCK=false"
set "VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1"
pnpm exec vite --host localhost --port 5173 --strictPort
```

ใช้ localhost:5173 ให้ตรง CORS ใน backend\.env · ห้ามใส่ key backend ใน VITE_* ·
ถ้ารัน pytest พร้อม Vite ให้ใช้ basetemp ใต้ node_modules/.cache (สร้าง parent ก่อน)
เพราะ Vite watcher เคย crash จาก pytest temp ใต้ backend/uploads ที่ถูกล้างระหว่างรัน

```bat
if not exist node_modules\.cache mkdir node_modules\.cache
backend\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini -q --basetemp=node_modules/.cache/pytest-tester
node scripts/test-import-wiring.mjs
node scripts/test-page-wiring.mjs
backend\.venv\Scripts\python.exe backend/scripts/verify_tester_flow.py
```

## Browser flows ที่เคยตรวจที่ `4d39680` (รอบนี้ไม่ได้รัน browser ซ้ำ)

1. Import: ดาวน์โหลด template / เลือก .xlsx ไม่เกิน 5 MiB → validate → analyze → Overview.
   Template สังเคราะห์ให้รายได้ 250,000 ค่าใช้จ่าย 200,000 กำไร 50,000 เงินสด 80,000
   หลังสำรอง 50,000 margin 20% และ badge simulated · หมวดกรอกเองรับ 38 top-level
   FinancialInput fields รวม loan; ไม่ส่ง optional ว่างเป็นศูนย์ · balance mismatch แจ้ง error
2. Overview ใช้ค่าจาก response เดียวกัน รวมผลต่างงวดก่อน/unknown · ร่างฟอร์มอยู่ sessionStorage
   แต่ผลสำเร็จอยู่เฉพาะแท็บจน reload; ไม่ผูกชื่อร้าน free text กับ SME ใน DB
3. Simulator: baseline จาก order ที่เก็บใน DB แยกจากงบ import · สี่ controls POST จริง:
   ขาย 120 / ต้นทุน 50 / มัดจำ 50% / เครดิต 10 ได้กำไรออเดอร์ 945,000,
   เงินสดต่ำสุดของร้านที่รับงาน 1,200,000, ขาดกำลังผลิต 550 ต่อวัน · save แล้วมี simulationId
   และเก็บ full baseline/scenario/results + project association · ยังไม่มี UI โหลดแผนที่บันทึก
   กลับมา · เครดิต 366 ปฏิเสธ/save ปิด; 1.1% ได้ min cash 542,820
4. SWARM: Radar Scan คำนวณข้อเสนอจริง; ตาราง/โควตาแสดงตาม engine · รอบนี้ได้ 450/1,000
   ไม่ใช่ 6 ร้าน/ร้านละ 50 · สองร้านอาหารติดรถ required ที่ยัง offered · modal swap ไม่มีร้าน
   ผ่านเงื่อนไขแล้วปิดปุ่ม · ไม่อ้างว่าทดสอบ swap สำเร็จกับร้านจริงซึ่งยังไม่มีผู้สมัครพร้อม

POST ใหม่ `/api/v1/simulate/order` รับ `{baseline: SwarmRequest, scenario: {unit_price,
cost_per_unit, deposit_ratio, payment_terms_days}, persist:false, context_missing:[]}`.
เงิน/rate เป็น decimal strings, เครดิต integer · cost_per_unit=null คงแต่ละร้าน; override
คือสมมติฐานต้นทุนเดียวกันทุกร้าน · `/simulate` เดิมไม่เปลี่ยน · GET `/simulator/context`
ให้ machine fields และ resource dependencies ของ project เดียวกัน ไม่ parse จาก display copy

ยอด Simulator/SWARM เป็นกำไรออเดอร์ก่อนค่าใช้จ่ายอื่นและ cash schedule เฉพาะออเดอร์ ·
minimumShopCash คือร้านที่เงินต่ำสุด ไม่บวกเงินข้ามร้าน · เครดิตเทอมอาจไม่เปลี่ยน cash trough
เมื่อยังรับเงินหลังผลิตครบ แต่วันรับเงิน/ระยะวงจรเปลี่ยน · ไม่ใช่ forecast ทั้งกิจการ 90 วัน

## ยังไม่พร้อมอ้างว่าใช้ทั้งเว็บครบ

- โครงการ DB 1,000/วัน 30 วัน · project ยังไม่เก็บ required_business_types / radius /
  buyer coordinates / collection schedule จึงส่ง missing และยังรับรองความเหมาะสมของ
  Sahai ซึ่งเป็น packaging ไม่ได้ · ต้องเก็บ requirements จริงก่อนรับออเดอร์อาหาร
- SWARM เป็น preview persist=false ไม่จองงาน ไม่จองรถ ไม่เขียนทับ allocations/resources ·
  รายละเอียดเงินรายร้านยังอ่านข้อมูลที่บันทึกไว้ ไม่ใช่ preview · ต้องยืนยันทรัพยากรจริงก่อน
- HeroAssembly / ChaosPlayback / AppShell/sidebar และหน้าที่ยังไม่ต่อ operation ยังมีฉากสาธิต ·
  Chaos Play ไม่ได้เรียก engine และปุ่มแผนสำรองใน child ยังเป็นการนำทาง/แจ้งเตือนสาธิต ·
  Import Column Mapping เป็นตัวอย่าง ไม่มี auto mapping; inventory ยังไม่มี schema
- Drag/drop ผ่าน handler regression; รอบนี้ browser ตรวจ file chooser ไม่ได้ลากจาก OS
- ทีมยังต้องสร้าง Railway service และตั้ง Vercel VITE_API_BASE_URL / VITE_USE_MOCK=false
  พร้อม redeploy · ข่าวสดยังไม่ยืนยัน/TLS เดิม ไม่ retry provider รอบนี้ · ไม่ยิง paid LLM
- AUTH_SECRET ยังไม่ตั้ง, enforcement=false/devHeader=false สำหรับ tester · credential
  admin อยู่เฉพาะ ignored uploads ไม่มีค่าใน repo หรือเอกสาร · ยังไม่อ้างว่า login/admin revoke
  ผ่าน HTTP ด้วยบัญชีนี้ · ดู DEPLOY.md ก่อนใช้ข้อมูลจริง

Mock mode อ่าน fixtures/ฉากได้; การคำนวณ/อัปโหลด/save ไม่ปลอมความสำเร็จ ต้องเชื่อม backend
จริงก่อน · CSS hash เดิมและ style-expression guard ทั้ง 4 หน้าเทียบฐาน 269e3d2 ผ่าน

Browser ของ production mock bundle ผ่าน: Simulator แสดงผลยังไม่มีข้อมูล/save ปิด และ
SWARM Radar แจ้งว่าต้องต่อ backend · mock fixtures เดิมยังมี order ราคา 85 แต่ proposal
รายรับ 240,000 ซึ่งไม่ตรงกับ 3,000 × 85 = 255,000; อย่าใช้ mock ยืนยันตัวเลขการเงิน

## ผล audit และสิ่งที่ต้องปิดก่อนส่ง frontend team

Full tests/build/HTTP/client scripts ตรวจซ้ำผ่านตามตัวเลขในตาราง. Server/Docker ตอนเริ่ม
ไม่เปิด จึงเปิด services เดิมก่อนตรวจ; ไม่ใช่การ deploy ใหม่. source/types/handlers อ่านแล้ว
พบ gap ที่ยังไม่ได้ implement ในรอบเอกสารนี้:

- shared SME/project/input revision ยังไม่ครบทุกหน้า; accepted import ไม่ได้กลายเป็น DB
  identity หรือ forecast ทุกหน้า และการแก้ draft ยังไม่ invalidate accepted snapshot
- Envelope/types ยังไม่ sync source และ Overview nullable/margin ทั้งหมด
- Cost view ยังมี zero placeholders สำหรับ unavailable metrics; minimal analyze จริงคืน
  costPerUnit/profitPerUnit/breakevenUnits=0 พร้อม missing. ต้องแก้ adapter/type/consumer คู่กัน
- CORS รับเพียง Content-Type; auth preflight ขอ Authorization จาก localhost:5173
  ได้ HTTP400 Disallowed CORS headers. ต้องแก้ backend ก่อนต่อ browser token
- apply/sign/info request/export และ resource/Chaos บาง handlers ยังเป็น local/toast;
  Saved simulation มี save แล้วแต่ยังไม่มี API สำหรับ read/list/replay

สิทธิ์ frontend wiring มีแล้ว งานเหล่านี้เป็น backend/integration backlog ไม่ใช่งานที่หยุด
เพราะ “แตะ frontend ไม่ได้”. งาน presentation/design ส่ง frontend team หลัง contract พร้อม
