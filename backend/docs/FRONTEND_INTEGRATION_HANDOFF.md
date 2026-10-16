# สถานะและงานส่งต่อ Backend / AI ↔ Frontend

อัปเดต 2026-10-16 (Asia/Bangkok) · ตรวจ runtime source `48d9385` + validation regression repair ในรอบนี้ ·
อัปเดตเอกสารและแก้ validation regression; คง src/UI เดิม

## ข้อตกลงล่าสุดจากผู้ใช้และทีม

ผู้ใช้อนุญาตให้แก้ frontend เพื่อให้ทำงานร่วมกับ backend/AI ได้แล้ว **ไม่จำกัดห้าไฟล์เดิม**.
ข้อตกลงนี้แทนข้อห้าม frontend และข้อยกเว้นสอง/ห้าไฟล์ในเอกสารเก่า

- CODEX เน้น math engine, AI/rules, database, API, adapters และ integration tests.
- แก้ client, types, store, hooks, props, handlers, validation และการแสดงข้อมูล/สถานะ
  ใน component เดิมได้ตามความจำเป็นของ integration โดยไม่ขอสิทธิ์รายไฟล์ซ้ำ
- คง CSS, Tailwind, สี, spacing, layout, animation design, component hierarchy และ routing.
  ไม่สร้างหน้า/flow ใหม่หรือ redesign เพื่อหลบปัญหา API
- ทีม frontend รับงาน presentation/UX/UI ต่อภายหลัง โดยใช้ API และขอบเขตข้อมูลที่ทดสอบแล้ว.
  ปัญหาที่เป็น backend/contract ไม่โยนให้ทีม frontend คำนวณหรือเดาตัวเลขเอง
- ไม่มีสิทธิ์ใหม่ในการยืนยันทรัพยากรแทนเจ้าของ ลงนาม ส่งคำขอสินเชื่อ หรืออนุมัติทุนจริง.
  การกดปุ่มธุรกิจต้องใช้ contract/actor/สถานะจริง ไม่ใช่ success toast อย่างเดียว

## ผลตรวจปัจจุบัน

| รายการ | ผล |
| --- | --- |
| pytest พร้อม PostgreSQL | 510 passed / 3 skipped, 26.93s |
| pytest ไม่มี DATABASE_URL | 410 passed / 103 skipped, 16.12s |
| เส้นทางหลัก | 36 ใต้ `/api/*` พร้อม v1 aliases; อีก 4 v1-only และ `/health` |
| ฐานข้อมูล / frontend read contracts | 27 tables / 16 contracts ผ่าน HTTP |
| Build | 1955 modules; CSS `index-DEindwiw.css`; JS `index-CBenrrOQ.js` |
| Regression scripts | `test-import-wiring.mjs` และ `test-page-wiring.mjs` ผ่าน |
| ข้อจำกัดการทดสอบ | Starlette/httpx warning และ JS bundle >500kB; live LLM/news ไม่ถูกเรียกซ้ำ |

รอบนี้เริ่มตรวจแล้วพบว่า server/Docker ยังไม่เปิด จึงเปิด Docker/PostgreSQL เดิมและ
`backend\run.cmd` ก่อนตรวจซ้ำ ไม่ reset/reseed volume และไม่เปลี่ยน `.env`.
3 DB skips = login ที่ต้องมี `DEMO_LOGIN_PASSWORD` 2 เคส และเคสสำหรับ DB-disabled 1 เคส.
Build และ HTTP ผ่านเป็นหลักฐาน integration บางส่วน **ไม่ใช่หลักฐานว่าทุกปุ่มในเว็บทำงานครบ**.

### Regression ที่แก้ระหว่างอัปเดตสถานะ

ก่อน push พบ main เพิ่ม `e5098cc` และ `48d9385` จึงรวมทั้งสอง commit ไว้.
การเติม omitted/null เป็น 0 ทำให้ตัวอย่างเดิมมี total_expenses=0 แต่มีรายการค่าใช้จ่าย
จึงถูกปฏิเสธ; 8 เทสต์แรกของ AI ล้มก่อนถึง provider. อีกจุดแปลง NaN/Infinity เป็น 0.
แก้โดยคืน validation เดิม: required ยังต้องส่ง, optional ไม่ทราบเป็น None,
nonfinite ถูกปฏิเสธ. คง inventory และ Excel aliases ของทีมไว้ แต่ inventory เป็น nullable.
FinancialInput มี **39 top-level fields (7 required / 32 optional)**; Import ปัจจุบันรับ
38 fields จึงยังไม่มีช่อง inventory และยังไม่มี stock/DIO math. ไม่เปลี่ยน src/UI.

เพิ่ม regression tests **16 เคส**: unknown เทียบ known zero, nonfinite, required amounts,
ตัวอย่าง grade B/75 และ inventory aliases. ไม่แก้หรือลด assertion ของ test เดิม.
ผลสุดท้าย DB **510 passed / 3 skipped (26.93s)**, ไม่มี DB **410 / 103 (16.12s)**;
targeted validation/Excel/AI **49 passed**. รีสตาร์ต backend แล้ว HTTP analyze ได้ B/75,
inventory manual=200, NaN=422 และ required assets หาย=422; HTTP tester flow และ
client/style guard scripts ผ่านอีกครั้ง. ไม่เรียก live provider หรือ deploy ใหม่.

## สถานะทั้งแปดโมดูล

| โมดูล | มีอะไรใช้งานจริงแล้ว | ข้อจำกัดก่อนส่งต่อว่าครบ |
| --- | --- | --- |
| 1. Validation / Excel | manual validation, template XLSX, upload; 39 FinancialInput fields (Import 38); Import POST จริง | `.xlsx` template ≤5 MiB เท่านั้น; Column Mapping ยังเป็นภาพตัวอย่าง, inventory รับที่ backend แล้ว แต่ไม่มีช่อง Import/stock/DIO math |
| 2. Math / grading | Decimal metrics + grading; calculate/analyze ใช้ข้อมูลเดียวกัน; Overview ใช้ผลจริง | types ของ Overview ยังไม่ประกาศ nullable/margin ครบ; ต้องตรวจ unknown ทั้งหน้าที่เหลือ |
| 3. Analyst / forecast | rules มี evidence; optional LLM จัดลำดับ findings; dated forecast + expense history ผ่าน API | Import ส่ง `use_llm:false` ไม่มี SME identity; Cashflow/Funding ไม่ได้เปลี่ยนตาม accepted import อัตโนมัติ |
| 4. Funding matcher | backend จัดอันดับ debt/equity และ GET options จริง | ปุ่มสมัครทุนยัง toast-only; matcher ไม่ใช่การสมัคร/อนุมัติสินเชื่อ |
| 5. SWARM | allocation, resource eligibility, Radar POST, candidate swap preview | ข้อจำกัดโครงการยังเก็บไม่ครบ; preview ไม่ใช่ quota/resource reservation |
| 6. Simulator | statement A/B และ order A/B; 4 controls POST; save full input/results ผูก project | ไม่มี API/UI โหลด saved simulation; Chaos เป็น playback; ไม่มี scenario analysis findings/forecast เต็มกิจการ |
| 7. Industry trends | route, cache/gate/backoff และ unavailable path มีแล้ว | ข่าวสดยังไม่เคยยืนยันสำเร็จจากเครือข่ายนี้; ยังไม่ต่อหน้าเว็บ/AI panel ให้ใช้ข่าวเป็นหลักฐาน |
| 8. DB / API / auth | persistence, HMAC tokens, scrypt, revoke, throttle | tester enforcement=false, devHeader=false, AUTH_SECRET ยังไม่ตั้ง; frontend ไม่ส่ง auth headers |

ผล HTTP ตัวอย่างสังเคราะห์รอบนี้: template grade B; Rung gap 45,000; forecast minimum
29,700 และ first shortfall 2026-10-18; synthetic SWARM cost 28,000; statement scenario
revenue 275,000. ห้ามนำชุดนี้ไปปนกับ demo บน Hero ที่เป็น 300 กล่อง/วัน 6 ร้าน.

## งานลำดับถัดไปของเรา — backend/AI และ wiring ก่อนงานดีไซน์

| ลำดับ | งาน / เจ้าของ | เกณฑ์รับงาน |
| --- | --- | --- |
| P0-1 | CODEX: ผูก SME/project/input revision ให้ตรงกันข้าม API และ store | Overview/Health/Cost/AI/Funding/Cashflow/Shop Finance ไม่สลับกลับ default SME เงียบ ๆ; ไม่ผูกชื่อร้าน free text กับ UUID เดโม; แก้ input แล้วไม่อ้างผลเก่าเป็นผลใหม่ |
| P0-2 | CODEX: ทำ contract/types, empty/error states และ CORS auth ให้ตรง runtime | `source`, null, `missing`, `kind`, partial series และ UUID ถูกต้อง; valid zero ต่างจาก unknown; HTTP failure ไม่ค้าง skeleton หรือแสดงสำเร็จ; browser Authorization preflight ผ่านก่อนต่อ token |
| P0-3 | CODEX + ทีมข้อมูล: จัดเก็บ/อ่าน order constraints และ collection schedule | อ่าน required business types, buyer coordinates/radius และ resource dependencies ของ project เดียวกัน; แยก missing จาก known-empty; packaging ไม่ถูกยืนยันว่าเป็นร้านอาหาร |
| P0-4 | CODEX: แยก read/preview/write ให้ชัดสำหรับปุ่มที่ยังเป็น demo | API ที่มีอยู่ต่อจริง; ถ้ายังไม่มี backend operation ให้แสดง unavailable ด้วยสถานะเดิม ไม่ toast ว่าสมัคร/ลงนาม/ส่งออกแล้ว; ไม่สร้าง endpoint สมมติในเอกสาร |
| P1-1 | CODEX: ครบวงจร simulation save/read/replay | บันทึกได้และอ่านด้วย ID/บริบทโครงการถูกต้อง; input/results/audit/version ตรวจซ้ำได้; UI ใช้ control เดิมเมื่อมี contract จริง |
| P1-2 | CODEX: เชื่อม AI context ของ SME/งวดเดียวกับหน้าจอ | ส่ง forecast/expense history เฉพาะ SME เดียวกัน; coverage ไม่ทราบต้องเป็น missing; แสดง rules/model/fallback ตามผลจริง; evidence ชี้ตัวเลขที่แสดงอยู่ |
| P1-3 | CODEX + ทีม: ตกลงขอบเขตปุ่มธุรกิจจริงก่อนเพิ่ม write API | application/signature/funder request ต้องมี request/response, actor, persistence, status transitions และ read-back; ไม่มีการยืนยันธุรกรรมด้วย client state อย่างเดียว |
| P1-4 | CODEX: ให้ resource removal / Chaos ใช้ scenario engine | วัดผลหลังเปลี่ยน resource/team/timing จาก backend; ไม่บวกต้นทุนหรือยืนยันแผนสำรองด้วยสูตร/ข้อความคงที่บนหน้า |
| P2 | ทีมโฮสต์ + CODEX: deploy/unmock และ provider verification | backend URL/CORS ตรง origin; Vercel env ถูกต้อง; ตรวจข่าวจาก host จริงผ่าน gate; ไม่อ้างผล LLM เก่าหรือผล mock เป็น live run ใหม่ |

P0-4 ไม่ได้ให้ถือว่าทุกปุ่มต้องสร้างธุรกรรมจริงภายใน hackathon. ต้องบอกความสามารถตาม
ที่มี: preview/read-only/unavailable หรือ operation ที่มีหลักฐานบันทึกและอ่านกลับจริง.
งานเหล่านี้มีสิทธิ์แก้ wiring แล้ว; ข้อมูลจริงและนิยามธุรกรรมที่ยังไม่มีเป็นข้อจำกัดคนละเรื่อง.

## ช่องว่าง integration ที่ตรวจจาก source โดยตรง

- `backend/app/main.py` อนุญาต CORS header แค่ Content-Type. ตรวจ OPTIONS จริงจาก
  localhost:5173 ขอ authorization,content-type ได้ HTTP400 Disallowed CORS headers.
  token transport ใน browser ยังมี backend blocker แม้ token unit tests ผ่าน; ยังไม่แก้ในรอบนี้

- `src/api/client.ts`: accepted analysis อยู่ในหน่วยความจำแท็บ; ใช้เฉพาะ Overview,
  Health, Cost, AI explanation. Cashflow/Funding/Sales/Shop Finance ยังเป็น GET ของ DB.
  `analyze()` ไม่ส่ง `sme_id`/`schedule_complete_through` และตั้ง `use_llm:false`.
  การแก้ draft ยังไม่ invalidate accepted snapshot; snapshot เปลี่ยนเมื่อ analyze สำเร็จหรือ reload.
- `src/api/contracts/types.ts`: Envelope ยังไม่มี `source`; BusinessOverview ยังประกาศ
  scalar/diff เป็น number และไม่มี `netProfitMargin` แม้ backend คืน null/margin แล้ว.
  นี่เป็นงาน contract/wiring ที่ทำได้ภายใต้สิทธิ์ใหม่ ไม่ใช่การ redesign
- `backend/app/adapters.py`: Cost view ยังใช้ zero placeholders เมื่อคำนวณไม่ได้.
  POST analyze ด้วย 7 required fields จริงคืน costPerUnit/profitPerUnit/breakevenUnits=0
  พร้อม insufficient_data และ missing ของ metrics เหล่านั้น. Core metric unknown ไม่ใช่ศูนย์;
  ต้องแก้ adapter/types/consumer คู่กันใน P0-2 ไม่อ้างว่า unknown ทุก widget รองรับครบแล้ว
- `ChaosPlayback.tsx`: Play เดิน phase ด้วย timer; apply contingency แค่ toast/navigation.
  `UnlockPage.tsx`: detach อยู่ใน store และรวม additionalCost ใน browser ไม่ได้ POST engine.
- `FundingPage.tsx`: handleApply เป็น toast; `ShopFinancePage.tsx`: sign เป็น local boolean
  กับ toast; `FunderPage.tsx`: request info เป็น toast; `ProjectsPage.tsx`: export เป็น toast.
  จาก route inventory ยังไม่มี operation สำหรับ application/signature/info request/report export.
- `useAppStore.ts`: saveSimulationPlan เดิมยังเป็น toast-only ถึงแม้ SimulatorPage ใหม่
  จะใช้ POST จริงแล้ว. อย่าใช้ helper เดิมเป็นหลักฐาน persistence
- `HeroAssembly`, AppHeader/sidebar และ Story Mode ยังมีบริบทสาธิตคงที่. แก้การ bind
  ข้อมูลให้ตรง source ได้แล้วโดยคงหน้าตาเดิม; presentation และ choreography ส่งทีม frontend.
- อย่าใช้ legacy mock เป็น financial acceptance: order ราคา 85 กับ proposal revenue
  240,000 ไม่ตรงกับ 3,000 × 85 = 255,000. invariant script ทดสอบชุดคงที่ ไม่รับรองทุก mock view

## สัญญาข้อมูลสำคัญ

ดู [API contract matrix](../../docs/API_CONTRACT_MATRIX.md) สำหรับ endpoint ที่มีจริง.
`/inputs/manual` และ `/finance/calculate` รับ FinancialInput ตรง ๆ; `/calculate` กับ
`/analyze` รับ `{input: ...}`; upload เป็น multipart `file`; `units_sold` และงวดเป็น integer.
เงิน/rates รับ decimal strings; optional ที่ไม่รู้ให้ละไว้ ไม่ส่งเป็น 0.

- `source` ระบุที่มา ไม่ใช่การยืนยันว่าข้อมูล seed เป็นข้อมูลลูกค้าจริง.
- `status` ตาม `missing`; ถ้า missing ไม่ว่างต้องไม่อ้าง ok. ดูสถานะระดับ metric/grading ด้วย
  เพราะ calculate status ระดับบนครอบคลุม 8 metrics เดิม ไม่ใช่ทุก business metric.
- series ที่ไม่มีหลักฐานคืน `[]` พร้อมชื่อใน missing; scalar unknown คืน null.
- ข้อนี้เป็น contract ที่ต้องรักษา; legacy cost/catalog placeholders ยังไม่สอดคล้องทั้งหมด
  ตาม audit ด้านบน. ห้ามตีความ placeholder 0 เป็นค่าที่คำนวณได้เพียงเพราะ request HTTP200
- เก็บ SME/project/inputHash/context coverage ให้ตรงกัน; inputHash ครอบคลุมงบเท่านั้น
  จึงไม่พอเป็น cache key ของ forecast/expense history ที่เปลี่ยนได้.
- `/forecast` อาจสร้าง projected cash_events เมื่อ project_obligations=true (default).
  ใช้ false เมื่อต้องการอ่านเฉพาะ events ที่มีอยู่; ไม่เรียก GET นี้โดยคิดว่าไม่มี write side effect.
- SWARM/order simulation ใช้ finite-order cash schedule; minimumShopCash เป็นร้านที่ต่ำสุด
  ไม่โอน surplus ข้ามร้าน และกำไรคือก่อนค่าใช้จ่ายอื่น ไม่ใช่ net profit ทั้งกิจการ.
- project ปัจจุบันเป็น 1,000/วัน 30 วัน. รถ required ของสองร้านอาหารยัง offered/unavailable.
  ได้ข้อเสนอ 450/1,000 จาก Sahai (packaging) จึงขาด 550 และยังยืนยัน eligibility ทางธุรกิจไม่ได้.
  ทีมต้องให้เงื่อนไข/พิกัด/วันรับเงินจริง; ห้ามเดาหรือเปลี่ยน offered เป็น confirmed เพื่อให้ผ่าน

## AI ที่ต้องส่งต่อให้ชัด

Math, grade, findings และ evidence เป็น deterministic backend. LLM optional รับเฉพาะ
ผลที่คำนวณแล้วเพื่อจัดลำดับ finding IDs ภายใน severity; เปลี่ยนตัวเลข/grade/หลักฐานไม่ได้.
provider ใช้ store=false, max_output_tokens=600; failure ใช้ rules + aiWarning.
GET `/ai/explain` ใช้ rules; ไม่ใช่ chatbot/LLM call. ผล model สดครั้งก่อนอยู่ใน
[LIVE_PROVIDER_VERIFICATION.md](LIVE_PROVIDER_VERIFICATION.md) วันที่ 2026-10-15.
รอบนี้ไม่เรียก paid LLM หรือ news provider และไม่อ้างว่าทดสอบ live ใหม่

Forecast 30/60/90 วันต้องมี schedule_complete_through ที่ยืนยันจริง. ส่วนที่ครบไม่พอ
ให้แสดง conditional/missing ไม่ตีความเป็นเงินสดยืนยัน. Scenario ต้องมีวิธีเปลี่ยน cash
events ของตัวเองก่อนสร้าง Plan B findings; ห้ามนำ baseline forecast มายืนยัน scenario.

## เกณฑ์ส่งต่อทีม frontend

1. แต่ละ action ระบุว่า read, preview, write หรือ unavailable พร้อม endpoint/body ที่ตรวจแล้ว.
2. มีตัวอย่าง known-value, incomplete/null, invalid, network failure, rules/fallback และ read-back.
3. ใช้ UUID จาก DB และ SME/project เดียวกัน; ไม่มี demo success หรือ stale response ทับข้อมูลใหม่.
4. ไม่มีสูตรเงิน/grade/funding ใน component; backend เป็นผู้คำนวณและคืนหลักฐาน.
5. Build ผ่านและเทียบ CSS/style กับ baseline; รายงาน module count และ asset hashes.
   จำนวน modules/JS hash เปลี่ยนได้ตาม wiring; CSS เปลี่ยนต้องตรวจว่าแตะดีไซน์หรือไม่.
6. อัปเดต progress, §4 และ handover พร้อม commit/push main ทุก block. ทีม frontend
   เริ่มงาน presentation ต่อได้จาก contract ที่มีหลักฐาน ไม่ใช่คำว่า API ตอบ 200 อย่างเดียว
