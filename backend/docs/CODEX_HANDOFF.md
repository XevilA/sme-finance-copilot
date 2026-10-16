# การส่งมอบงานของ CODEX

## รอบ CODEX 2026-10-16 — ข้อตกลงใหม่และตรวจสถานะ Backend/AI integration

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

- ผู้ใช้แจ้งว่าทีมให้แก้ frontend เพื่อเชื่อม backend/AI ได้แล้วโดยคง UI เดิม; ยกเลิก
  two/five-file limit สำหรับ wiring ที่จำเป็น. CODEX เน้น backend/AI/contracts/adapters/
  integration ก่อนทีม frontend รับ presentation ต่อ ไม่หยุดขอสิทธิ์รายไฟล์ซ้ำ
- รอบนี้อัปเดตเอกสารและแก้ validation regression ที่พบใน main ใหม่ โดยคง src/UI เดิม.
  สถานะสุดท้ายอ้าง source `48d9385` + validation regression repair ในรอบนี้; รายละเอียดและผลหลังแก้อยู่ด้านล่าง
- เพิ่ม FRONTEND_INTEGRATION_HANDOFF.md: ทั้งแปดโมดูล, owner/priority, API vs demo action,
  request shapes, AI/rules/evidence และ exit criteria ก่อนส่งทีม frontend
- เขียน CODEX_ASSIGNMENT และ API_CONTRACT_MATRIX ใหม่ให้ตรง source: เอา `/import/*`
  ที่ไม่มีจริงออก; เพิ่ม upload/manual/analyze/order-simulator contracts และ pending writes
- แก้ guidelines §1/§2/§4 และ ANALYSIS_CONTRACT: frontend wiring อนุญาตแล้ว, draft ยังไม่
  invalidate accepted snapshot, import views ไม่ครอบคลุมทุก page, GET AI explain ใช้ rules.
  LLM optional มีที่ backend ไม่ใช่ทุกครั้งที่เปิด panel จะเรียกโมเดล
- ตรวจ handler จริง: Funding apply, ShopFinance sign, Funder info request, Projects export,
  Chaos apply และ legacy store save ยังมี toast/local state. ยังไม่มี backend operations
  สำหรับ transaction เหล่านี้; เป็น backlog ของ backend+integration ไม่ใช่งานแต่ง UI
- พบ backend integration gap เพิ่ม: CORS main.py อนุญาต Content-Type เท่านั้น.
  OPTIONS จาก localhost:5173 ขอ authorization,content-type ได้ **400 Disallowed CORS headers**.
  บันทึกเป็น P0 ก่อน browser auth integration; **ยังไม่ได้แก้ CORS ในรอบเอกสารนี้**
- ตรวจ minimal analyze จริง: Cost view คืน costPerUnit/profitPerUnit/breakevenUnits=0
  ทั้งที่ missing/insufficient_data. บันทึก legacy adapter/type/consumer gap ไว้ใน P0;
  ยังไม่แก้ Cost adapter หรืออ้างว่า null handling ครบทุก widget
- เริ่มตรวจพบ local server/Docker ไม่เปิด; เปิด Docker/Postgres เดิมและ backend\run.cmd
  แล้วตรวจซ้ำ ไม่มี reset/reseed volume, ไม่แก้ .env. DB test run แรกหยุดเพราะ DB ยังไม่พร้อม;
  ไม่นับเป็นผลผ่าน. ผลหลัง service พร้อม: **494 passed / 3 skipped** (30.21s), ไม่มี DB
  **394 passed / 103 skipped** (23.44s). Warning Starlette/httpx เดิม
- HTTP verify_tester_flow ผ่าน: **36 main routes, 27 tables, 16 read contracts**;
  Rung gap 45,000, forecast minimum 29,700 / first shortfall 2026-10-18,
  synthetic swarm cost 28,000 และ scenario revenue 275,000. ไม่ยิง live news หรือ paid LLM
- Build ตรวจซ้ำ: **1955 modules**, CSS **index-DEindwiw.css**, JS **index-CBenrrOQ.js**;
  bundle >500kB warning เดิม. test-import-wiring และ test-page-wiring ผ่าน
- ปรับ DEPLOY/README/tester guide ให้แยก local/host, config จริง, cmd.exe, CORS/auth,
  partial data และ historical provider evidence. ไม่อ้าง deploy/image rebuild/browser E2E ใหม่
- งานถัดไปที่ต้องปิด: shared identity/input context, nullable/source types + error states,
  CORS auth preflight, stored order constraints, truthful business action states, saved plan read,
  AI context และ resource/Chaos engine integration. ข้อมูลจริง/transaction scope/host ยังต้องทีม
- หลักตัดสินใจ: ไม่เปลี่ยน behavior ที่พบระหว่าง audit เงียบ ๆ, ไม่เปลี่ยน fixture ให้ดูผ่าน,
  ไม่ยืนยันรถ/เกณฑ์ธุรกิจแทนทีม และไม่เริ่ม redesign. ประวัติด้านล่างคงสถานะ ณ รอบนั้นไว้

---

## รอบ CODEX 2026-10-16 — Overview, order Simulator และ SWARM wiring

- ฐาน `269e3d2` · ผู้ใช้อนุญาตเพิ่ม OverviewPage.tsx / SimulatorPage.tsx / SwarmPage.tsx
  และข้อความชนิด/ขนาดไฟล์ใน Import · frontend รวม 5 ไฟล์ที่อนุญาตเท่านั้น ·
  style-expression guard เทียบกับฐานผ่านทุกหน้า ไม่เปลี่ยน CSS/Tailwind/layout/routing
- Overview ใช้ยอด เงินสำรอง อัตรากำไร badge และรายการแนะนำจากผลจริง · unknown เป็น null
  รวมผลต่างงวดก่อน ไม่เดาศูนย์ · **เขียน assertion เดิมของ previous-period diff ใหม่เป็น null
  โดยเจตนา** เพราะพฤติกรรมเดิมแสดงค่าที่ไม่มีหลักฐานเป็นศูนย์ ไม่ใช่ลดความเข้มของเทสต์
- เพิ่ม GET `/api[/v1]/simulator/context`: order และ candidate shops แบบ machine fields
  จาก DB, Decimal เป็น string, resource dependencies กรอง project_id เดียวกัน ·
  ข้อจำกัดที่ schema ยังไม่เก็บประกาศ missing ไม่อ่านเครดิต/มัดจำย้อนจากข้อความแสดงผล
- เพิ่ม POST `/api[/v1]/simulate/order` แยกจาก statement `/simulate` เดิม:
  body `{baseline: SwarmRequest, scenario: {unit_price, cost_per_unit, deposit_ratio,
  payment_terms_days}, persist: false, context_missing: []}` · เงินเป็น decimal strings,
  payment_terms_days เป็น integer · cost_per_unit=null คงต้นทุนแต่ละร้าน; กำหนดค่าเมื่อใด
  ใช้ค่านั้นกับผู้สมัครทุกร้านและจัดสรรใหม่ · ไม่เปลี่ยนสัญญา endpoint เดิม
- ใช้ finite-order schedule ของ engine คำนวณเงินสดต่ำสุดของ **ร้านที่ต่ำที่สุด** ไม่รวมเงิน
  ข้ามร้าน และไม่อ้างว่าเป็น forecast เงินสดทั้งกิจการหรือกำไรสุทธิหลังค่าใช้จ่ายอื่น ·
  เครดิตเทอมเลื่อนวันรับเงิน/ความยาววงจร แต่ไม่จำเป็นต้องเปลี่ยนยอด cash trough เมื่อ
  รับเงินหลังผลิตครบอยู่แล้ว · ไม่มีการสร้าง series 90 วันจากยอดรวม
- Simulator debounce 300ms, ละทิ้งผลตอบกลับที่ล้าสมัย, ปิด save ระหว่างคำนวณ/เมื่อ input
  ไม่ผ่าน · save POST จริง เก็บ full baseline/scenario/results ใน simulations และผูก project
  ถ้าพบ order_ref · ไม่มีหน้าเรียกแผนที่บันทึกกลับมาใน UI รอบนี้ แต่ข้อมูล replay อยู่ครบ
- SWARM ปุ่ม Radar POST จริงและแสดง quota/deficit/cost/profit/funding gap จาก engine ·
  swap ใช้ผู้สมัครสำรองจริงที่ยังไม่รับงาน ส่งทีมเดิมพร้อมร้านทดแทนที่เลือกให้คำนวณใหม่ ·
  ไม่มีผู้สมัครที่ผ่านเงื่อนไขก็ปิดปุ่ม ไม่สร้างชื่อร้านสำรองขึ้นเอง · ใช้ persist=false ทั้งคู่
  จึงไม่ลบ allocations/allocation_resources เดิม ไม่จองงาน ไม่เปลี่ยนสถานะทรัพยากร
- ลิงก์การเงินจาก SWARM เปิดข้อมูลรายร้าน **ที่บันทึกไว้** ไม่ใช่บันทึกข้อเสนอ preview ·
  ShopFinancePage อยู่นอกสิทธิ์รอบนี้ · GET swarm ที่บันทึกเพิ่ม source=database
- Import ระบุ `.XLSX ตาม Template ไม่เกิน 5 MiB` ตรง parser · ส่วน Column Mapping
  ยังเป็นตัวอย่างเดิม ไม่มี auto mapping; สิทธิ์ copy เพิ่มครอบคลุมชนิด/ขนาดไฟล์เท่านั้น
- Full pytest: **494 ผ่าน + 3 skip** กับ PostgreSQL (34.15s), **394 ผ่าน + 103 skip**
  ไม่มี DB (20.10s) · targeted persistence/order หลังแก้สุดท้าย **23 ผ่าน** · เพิ่ม 12 cases ·
  warning Starlette/httpx เดิม · แก้ setup basetemp ให้มี parent ก่อนทดสอบ ไม่มี assertion ถูกลด
- Final Overview/import/order contract tests after exact-decimal margin update: **39 passed**.
- Build **1955 modules · CSS index-DEindwiw.css คงเดิม · JS index-CBenrrOQ.js** ·
  JS >500kB warning เดิม · invariants / test-import-wiring / test-page-wiring ผ่าน
- HTTP จริง: **36 routes** (+ aliases และ 4 v1-only), **27 ตาราง**, **16 read contracts** ·
  Rung gap 45,000 / forecast ต่ำสุด 29,700 เริ่มขาด 2026-10-18 · ไม่ยิง LLM เสียเงินหรือ force ข่าว
- Browser จริง: template upload → Overview 250,000 / 200,000 / 50,000 / 80,000,
  ใช้ได้หลังสำรอง 50,000, margin 20%, badge simulated · Simulator ปรับครบ 4 ค่าและ save
  แล้วอ่าน row กลับจาก PostgreSQLตรงกัน; credit 366 ถูกปฏิเสธและ save ปิด · เปอร์เซ็นต์ 1.1
  คำนวณ min cash 542,820; มัดจำ 50%, ราคา 120, ต้นทุน 50, credit 10 ได้กำไรออเดอร์
  945,000 / min shop cash 1,200,000 / deficit 550 ต่อวัน · หลักฐานภาพอยู่ใน ignored uploads
- Docker เดิมเปิดไม่ได้เพราะ stale zero-byte engine.sock · เก็บ directory IPC เดิมชื่อ
  `%LOCALAPPDATA%\docker-secrets-engine.codex-backup-20261016` แล้วให้ Docker สร้างใหม่ ·
  ไม่ reset/reseed/ลบ volume ฐานข้อมูล · Docker/Postgres และ server กลับมาทำงานแล้ว

- Browser production mock mode: Simulator renders demo playback with no fabricated A/B result;
  save disabled and SWARM Radar reports backend configuration required. Legacy mock fixture
  order price 85 and proposal revenue 240,000 do not reconcile (3,000 × 85 = 255,000);
  fixtures are outside permitted source paths and are not valid financial acceptance data.

### สิ่งที่ยังไม่ทำและต้องไม่อ้างว่าเสร็จ

- ออเดอร์ DB จริงคือ 1,000/วัน 30 วัน ไม่ใช่ฉากตัวอย่าง 300/วัน 6 ร้าน · Baan Suan และ
  Rung ติดรถ required ที่ยัง offered/available=false; จัดสรรเบื้องต้นให้ Sahai 450 และขาด
  550 · **Sahai เป็น packaging และ project ยังไม่เก็บ required_business_types** จึงไม่ใช่
  การยืนยันว่าเหมาะผลิตอาหาร · UI/metadata แจ้งเกณฑ์ธุรกิจและระยะทางยังไม่ยืนยัน
- ทีมต้องระบุ constraints และวันรับเงินที่ยืนยันจริงก่อนรับงาน; ยังไม่มีพิกัดผู้ว่าจ้าง/
  ร้านหรือ radius ไม่เติมจากจังหวัด และไม่ยืนยันรถแทนเจ้าของ · context ประกาศ missing
- HeroAssembly.tsx, ChaosPlayback.tsx, AppShell/sidebar และหน้ารายอื่นยังมีฉาก/ปุ่มสาธิต
  นอก 5 ไฟล์ที่อนุญาต · Chaos Play เป็น playback ไม่ได้เรียก what-if engine ·
  ยังไม่อ้างว่าเว็บทั้งระบบหรือทุกปุ่มต่อ backend ครบแล้ว · อย่าทดสอบ signing จากฉากสาธิต
- Railway service + Vercel 2 env/redeploy ยังต้องทีม; ไม่ deploy หรือเปลี่ยนบัญชีเอง ·
  ข่าวสดยังไม่ยืนยัน ไม่ได้ retry TLS รอบนี้ · AUTH_SECRET ยังไม่ตั้ง ใช้ auth tester เดิม
- ผล import อยู่เฉพาะแท็บ ไม่มี SME identity จากชื่อ free text; reload กลับ stored baseline ·
  simulator ใช้ order ใน DB แยกจากงบที่ import โดยแสดงขอบเขตเฉพาะออเดอร์ชัดเจน

---

## รอบล่าสุด: Import wiring ทั้งสอง lane และข้อจำกัดก่อนส่ง tester — 2026-10-15

ฐานเริ่ม `dde929e` บน main สะอาดและตรงกับ GitHub · อ่าน CODEX_ASSIGNMENT ครบแล้ว ·
brief ลงวันที่ 2026-10-16 แต่เวลาที่วัดรอบนี้คือ 2026-10-15 Asia/Bangkok ·
ข้อมูลด้านล่างเป็นผลตรวจรอบนี้ ไม่ใช่การยกตัวเลขใน brief มารายงาน

### งานที่เปลี่ยนและผลวัด

- **ต่อ src แล้ว** เฉพาะ `src/api/client.ts` และ `src/features/import/ImportPage.tsx`:
  file chooser, drop handlers, template download, draft state, manual validation,
  calculate และ analyze · ช่องครบ 38 ฟิลด์ระดับ FinancialInput (7 required/31 optional)
  รวม loan nested · ช่องว่างละไว้ จำนวนเงินยังเป็น string และหน่วย/งวดเป็น integer
- ไม่เปลี่ยน CSS/Tailwind/copy/layout/routing ไม่กู้ services/api.ts และไม่แก้ src ไฟล์ที่สาม ·
  เพิ่มเฉพาะ label และ input ที่ schema ต้องใช้ใน grid เดิม กับ hidden file input/event bindings
- Browser manual และ file picker ผ่านถึง Overview: 250,000 / 200,000 / 50,000 / 80,000 ·
  ทดสอบงบไม่สมดุลแล้วเห็น error ไม่แสดงสำเร็จหรือเปลี่ยนหน้า · ปุ่มดาวน์โหลด template ผ่าน
- Drag/drop ตรวจด้วย event handler regression จาก component จริง ไม่ได้ลากไฟล์จาก OS
  ผ่าน browser automation · กันส่งซ้ำและ error path ผ่านใน `scripts/test-import-wiring.mjs`
- `/analyze` เพิ่ม shop_name optional และ views ที่ adapters สร้างจากผล analysis เดียวกัน ·
  ทุก view มี source=supplied_input/inputHash · เพิ่ม source ให้ calculate/validation/SWARM/
  simulator ที่ยังขาด · request body เดิมไม่เปลี่ยน (flat เฉพาะ manual, wrapped ที่ calculate/analyze)
- ผลสำเร็จเก็บในหน่วยความจำแท็บเพื่อให้ Overview/Health/Cost/AI panel ใช้คำขอเดียวกัน ·
  ไม่ผูกชื่อร้าน free text กับ SME เดโม ไม่เขียน shared “latest input” และไม่อ้างว่าบันทึกงบแล้ว
- เพิ่ม pytest 5 กรณีโดยไม่เขียนหรือทำ assertion เดิมให้อ่อนลง · **482 ผ่าน + 3 skip**
  กับ PostgreSQL ใน 36.54 วินาที; **383 ผ่าน + 102 skip** ไม่มี DB ใน 19.80 วินาที ·
  Starlette/httpx warning เดิมหนึ่งรายการ · targeted 5 กรณีผ่านหลังการแก้สุดท้ายด้วย
- `node scripts/test-import-wiring.mjs` ผ่าน real client HTTP, upload invalid/limit,
  mock isolation, drag/drop, duplicate submit, manual serialization และ error ไม่เปลี่ยนหน้า ·
  harness ไม่ใช่ E2E browser; browser จริงตรวจแยกตามที่ระบุข้างบน
- **Build: 1955 modules · CSS index-DEindwiw.css คงเดิม · JS index-E6xWZDJT.js** ·
  invariant checks เดิมผ่าน · มี warning JS เกิน 500kB ไม่แก้ bundling นอกขอบเขต
- `backend/scripts/verify_tester_flow.py` ยิง HTTP จริงและอ่าน DB กลับ: **34 routes,
  27 ตาราง, 16 read contracts**; Rung gap 45,000, forecast ต่ำสุด 29,700 เริ่มขาด
  2026-10-18; synthetic SWARM 28,000; scenario รายได้ 275,000 · ใช้ persist=false
  สำหรับ calculation/SWARM/simulator/matcher ไม่มีการ reset หรือ reseed
- เรียกข่าวผ่าน gate หนึ่งครั้งโดยไม่ force: unavailable / provider_gate_closed,
  บทความ 0 · ไม่อ้างว่าทดสอบ TLS ใหม่หรือ dedup/published_at กับข่าวสดแล้ว · ไม่เรียก LLM เสียเงิน
- ตั้งรหัส admin ในฐาน local และอ่านกลับว่ามี hash แล้ว · credential อยู่เฉพาะไฟล์
  `backend/uploads/admin-tester-credentials.txt` ที่ Git ละเว้น ไม่แสดงค่าใน log/เอกสาร ·
  AUTH_SECRET ยังไม่ตั้ง จึงยังไม่ยืนยัน admin login/revoke บน server ปัจจุบัน

### การตัดสินใจและสิ่งที่ไม่ได้ทำ

- เลือก stateless analysis views แทนการบันทึกไปยังร้าน “ล่าสุด” เพราะไม่มี identity จาก
  free-text shop name · reload ล้าง accepted result; draft ยังอยู่ใน sessionStorage ·
  ไม่มีการส่งงบไป LLM โดยอัตโนมัติและ mock writes ไม่แสร้งว่าคำนวณสำเร็จ
- `.env` อนุญาต localhost:5173 แต่ Vite default 3000 ถูก CORS ปฏิเสธจริง ·
  เริ่ม tester frontend ที่ 5173 ด้วย process env เท่านั้น ไม่แก้ `.env` หรือ vite.config.ts
- **brief วินิจฉัยไม่ครบ:** browser แสดง Overview ยอดใหม่ถูกแล้ว แต่ยังมีตัวเลข
  −5,000 / 36,200 / 10,000 และ badge actual คงที่ใน `OverviewPage.tsx` ·
  `SimulatorPage.tsx` ยังมีสูตรของตัวเอง, `SwarmPage.tsx` มีปุ่มจำลอง ·
  ต้องขยายสิทธิ์ frontend มากกว่าสองไฟล์ก่อนอ้างว่าทั้งแปดฟีเจอร์ใช้บนเว็บครบ ·
  **หยุดที่ขอบเขตนี้ ไม่แก้ไฟล์ที่สามเอง**
- copy ของ Import เรื่อง XLS/CSV/25MB กับ Column Mapping ขัดกับ parser ที่รับ template
  XLSX/5MiB · file picker/error ใช้ข้อจำกัดจริง แต่คง copy ตามคำสั่ง · หมวดสต็อกไม่มี
  inventory ใน FinancialInput จึงไม่สร้าง DIO หรือข้อมูลใหม่เอง
- พิกัดร้านไม่ได้รับจากทีมจึงไม่เติม · ไม่มี deploy ใหม่หรือ Vercel env ใหม่ให้ตรวจ ·
  คง RBAC_ENFORCED=false/AUTH_DEV_HEADER=false ตาม brief สำหรับ tester
- คู่มือส่ง tester และคำสั่ง cmd.exe: `TESTER_READINESS_CURRENT.md` · ภาพ browser และ
  JSON ผลตรวจเก็บใน uploads ที่ Git ละเว้น · คำเตือน/ข้อจำกัดทั้งหมดเพิ่มใน §4 และ progress แล้ว

## รอบล่าสุด: ตรวจงานต่อของ CLAUDE และแก้ข่าวซ้ำให้ deterministic — 2026-10-15

- เริ่มจาก working tree สะอาดที่ `addf28ed60d65113b834de69e47544a6a79cb507`
  และตรวจ GitHub `main` แล้วตรงกัน · ไม่ย้อนหรือทับงานเดิม
- `c07405b` แก้ gate ปิดแล้ว: เรียก `analyze_industry_articles()` โดยตรง ไม่มีทาง
  fetch จาก branch นี้ · เทสต์นับการสร้าง client ผ่านในชุดทดสอบรอบนี้
- `addf28e` ต่อ forecast และ expense history ครบสี่จุดที่เรียก `build_analysis()`
  และส่งทรัพยากรผ่านเส้นทาง `sme_ids` โดยกรอง `project_id` แล้ว · เทสต์จุดต่อ 17 ตัว
  ผ่านพร้อม PostgreSQL · ยังไม่มีแคช analysis จึงยังไม่มีปัญหา cache key ใช้เพียง `inputHash`
- พบปัญหาใหม่ใน Core ข่าว: URL และ `observed_at` เท่ากันแต่ fetch คนละเวลา
  อาจเลือกแถว stale หรือหัวข้อเก่าตามลำดับขาเข้า · แก้ให้เลือก snapshot ที่ fetch ล่าสุด
  เมื่อ observation/URL เท่ากัน และใช้ฟิลด์ต้นทางตัดสินกรณีเวลาเท่ากันอีกชั้น ·
  ไม่รวมหลักฐานจากหลาย snapshot เข้าด้วยกัน ไม่สร้างวันเผยแพร่เอง
- เพิ่ม regression tests 5 กรณี ครอบคลุม fresh/stale หัวข้อที่แก้ไข วันเผยแพร่
  และที่มาของวัน · ทั้งห้าล้มเหลวก่อนแก้และผ่านหลังแก้ · เป็นข้อมูลจำลองทั้งหมด
  **ยังไม่ใช่การยืนยัน deduplication จากข่าวสด**
- ตรวจตามคำสั่งด้วย Docker Compose เดิมและ pytest: **477 ผ่าน + 3 skip**
  ใน 27.42 วินาที · คำเตือน Starlette/httpx เดิมหนึ่งรายการ · ไม่เรียก LLM ที่เสียเงิน
- `src/` ไม่ต่างจาก `14c981b` และไฟล์ของ CLAUDE ไม่ถูกแก้ · ตรวจชื่อ asset บนดิสก์
  ยังเป็น `index-DEindwiw.css` / `index-DrkwTzbk.js` · รอบนี้ไม่ได้ build frontend ซ้ำ

### ข้อจำกัดของ server ที่กำลังรัน และงานส่งต่อ

- พอร์ต 8000 มี Python PID `34040` เริ่มเวลา 14:51:04 Asia/Bangkok ก่อนสอง commit
  ของ CLAUDE · `backend/run.cmd` ปฏิเสธการเปิดซ้ำตามที่ควร · ไม่หยุด process ของผู้ใช้
- `/health` ของ process เดิมตอบ `ok`, `persistence=true` แต่ OpenAPI ของ `/api/overview`
  ยังมีเพียง `sme_id` และ AnalyzeRequest ยังมีเพียง `input` / `use_llm` · HTTP overview
  ของ Rung Charoen ยังไม่มี finding ใหม่ แม้ส่ง `schedule_complete_through` แล้ว ·
  ต้องโหลด server จาก checkout ปัจจุบันก่อนใช้พอร์ตนี้ยืนยันงานใหม่หรือเดโม
- ผลผ่านของการต่อระบบรอบนี้มาจาก tests ที่โหลดโค้ดปัจจุบัน รวม FastAPI TestClient
  กับฐานข้อมูลจริง · **ยังไม่ยืนยันว่า finding ใหม่แสดงบนเว็บที่เผยแพร่แล้ว**
- Module 6 ยังไม่มีการรับ forecast/expense history จากฐานข้อมูล: `simulate.py`
  สร้าง plans จาก metrics/grading และ inline swarm ไม่ได้เรียก `build_analysis()` ·
  การตรวจ resources ทำงานผ่าน engine เมื่อผู้เรียกส่ง inline มาแล้ว · หากต้องเพิ่ม
  finding ให้ plans หรือโหลดข้อมูลเสริมตาม SME ให้ CLAUDE ต่อและกำหนดวิธีปรับ cash events
  ของ Plan B ก่อน ห้ามนำ forecast ของ Plan A ไปยืนยันว่าเป็นผลของ Plan B
- งาน CODEX ที่ยังค้างภายนอกเครื่องคือยืนยัน GDELT HTTPS และบทความจริงจาก Railway
  หลัง deploy · รอบนี้ไม่ยิงข่าวจริงซ้ำ เพราะยังไม่มีโฮสต์ใหม่ให้ตรวจและมีหลักฐาน TLS เดิมแล้ว
- การจอง/แบ่งทรัพยากรร่วมยังต้องมีจำนวนและช่วงเวลาใช้งานจริงก่อนออกแบบเพิ่ม ·
  ไม่อนุมานข้อมูลดังกล่าวจาก `available` หรือ `status`

> บันทึกตั้งแต่หัวข้อถัดไปเป็นประวัติก่อน `c07405b` / `addf28e` · ข้อความที่บอกว่า
> รอ CLAUDE ต่อสี่จุดหรือแก้ gate ให้ถือสถานะล่าสุดด้านบนแทน

## รอบล่าสุด: รับ forecast, เทียบค่าใช้จ่าย และตรวจทรัพยากร — 2026-10-15

ฐานก่อนเริ่มคือ `d13bac5` ซึ่งมี **419 tests ผ่าน + 3 skip** ไม่ใช่ 396 ตามไฟล์มอบหมาย
รุ่นก่อน · รอบนี้เพิ่ม 35 เทสต์ รวมเป็น **454 tests ผ่าน + 3 skip** กับ PostgreSQL ·
คำเตือน Starlette/httpx เดิมหนึ่งรายการยังอยู่ · ไม่มีการยิง LLM ที่เสียเงินในรอบนี้

### สิ่งที่ CODEX ทำและตรวจแล้ว

- `build_analysis(data, *, forecast=None, expense_history=None)` รับข้อมูลเสริมโดย
  ไม่เรียก loader หรือคำนวณ forecast เอง · Caller เดิมยังทำงานเหมือนเดิม · เพิ่ม
  `contextEvidence` / `expenseComparison` และ finding พร้อมหลักฐานตามสัญญาใน
  `ANALYSIS_CONTRACT.md` · คงตัวชี้วัดทางการเงินเดิมและเกรดทุกค่า
- ตรวจด้วย `load_expense_history()` จากฐานข้อมูลจริงและผล HTTP ของ `/api/forecast`
  สำหรับ SME เดโมทั้งสองราย · Baan Suan ยังได้ A และไม่ถูกแจ้งค่าใช้จ่ายผิดปกติ ·
  Rung Charoen ยังได้ D และมีค่าวัตถุดิบ 168,000 สูงกว่าฐาน 99,166.67 อยู่ 69.41%
- ผล forecast ที่รับมาของ Rung Charoen ระบุวันเริ่มต่ำกว่าเงินสำรอง 150,000 คือ
  2026-10-18 และเงินสดต่ำสุด 29,700 วันที่ 2026-10-28 · ใช้ snapshot 2026-09-30
  พร้อมยืนยันตารางถึง 2026-12-29 ในการตรวจครั้งนี้ · ไม่มีการคำนวณค่าดังกล่าวซ้ำใน analysis
- เพิ่ม `ShopCapacity.resources` แบบ optional · required ต้องมี `available=true`
  **และ** `status="confirmed"` จึงผ่าน · ทรัพยากรที่เป็น preference ไม่ตัดร้านออก ·
  `None` คือยังไม่ทราบ dependency ส่วน `[]` คือระบุว่าไม่มี dependency
- เพิ่ม `audit.eligibility[shop_id]` ครบทุกผู้สมัคร รวมร้านที่ไม่ได้จัดสรร · มี
  `resource_status`, `missing_resources`, `unavailable_preferences`, `resource_unknowns`
  และ `reasons` โดยคง key เดิมทั้งหมด
- ตรวจ `POST /api/swarm` จริงด้วย `shops` inline จากโปรไฟล์และ resource loader
  โดย `persist=false` · รถห้องเย็นสถานะ offered ซึ่งเป็น required ทำให้ Baan Suan
  และ Rung Charoen ไม่ผ่าน · Sahai ยังผ่านแม้เครื่องซีลที่เป็น preference ยัง offered ·
  สถานะโครงการเป็น incomplete ตามกำลังผลิตที่เหลือ ไม่ได้เปลี่ยนฐานข้อมูลเดโม
- Build frontend ผ่าน **1955 modules** และชื่อ asset คงเดิม:
  `index-DEindwiw.css`, `index-DrkwTzbk.js` · ไม่แก้ `src/` หรือไฟล์ของ Claude

### งานต่อระบบที่ยังเป็นของ CLAUDE

```python
analysis = build_analysis(
    financial_input,
    forecast=forecast_result,
    expense_history=expense_rows,
)
shop = ShopCapacity.model_validate({
    **capacity_row,
    "resources": resource_map.get(capacity_row["shop_id"]),
})
```

- ส่ง forecast และประวัติ SME เดียวกันผ่านเส้นทางที่สร้าง analysis และ simulator ตามที่
  ต้องการ · กำหนดวันที่ยอดเงินสดและความครบของตารางอย่างชัดเจน ไม่อนุมานจากวันสุดท้าย
- ส่ง resource map ผ่านเส้นทางที่ใช้ `sme_ids` และ simulator · ห้ามใช้ `.get(id, [])`
  เพราะจะเปลี่ยนความหมายจากไม่ทราบเป็นไม่มี dependency · API แบบ inline ใช้ได้แล้ว
- กรอง resource dependency ตามออเดอร์หรือโครงการปัจจุบันก่อนส่งเข้า engine ·
  `load_shop_resources()` ปัจจุบันรวม allocations ของ SME จากทุกโครงการ ซึ่งอาจได้
  resource ID ซ้ำหรือ dependency ของคนละออเดอร์ · Core ปฏิเสธ ID ซ้ำต่อร้าน
- การตรวจนี้เป็นความพร้อมของทรัพยากรตามสถานะ ไม่ได้จองทรัพยากรหรือแบ่งกำลังของ
  ทรัพยากรที่ใช้ร่วมกัน เพราะยังไม่ได้รับข้อมูลจำนวนหรือช่วงเวลาการใช้งาน · ไม่สร้างข้อมูลเอง
- ข้อมูลเสริมมีช่วงเวลาแยกจากงบ · ให้ใช้วันที่ที่แสดงในหลักฐาน และอย่าใช้ `inputHash`
  ของงบเพียงอย่างเดียวเป็น cache key ของผลวิเคราะห์ที่รวมข้อมูลเสริม

### ข่าวสดยังไม่สำเร็จ และมีจุดที่ต้องแก้ใน gate

- เมื่อ 2026-10-15 เรียก route จริงหลัง `next_allowed_at` ผ่านแล้ว โดยไม่ force:
  `status="unavailable"`, `sourceError="timeout"`, บทความ 0 รายการ · gate บันทึก
  `consecutiveFailures=2` และ backoff 120 วินาที · ไม่ได้อ้างว่าดึงข่าวจริงสำเร็จ
- ทดสอบแยก: DNS เป็น `104.197.47.124`, TCP ต่อได้ แต่ TLS ที่ตรวจใบรับรองตามปกติ
  ยังหมดเวลาประมาณ 5.28 วินาที · ยังบอกไม่ได้ว่ามาจาก provider ตัวกลาง หรือการกรองปลายทาง
  ต้องลองจาก Railway หลัง deploy ซึ่ง egress อาจต่างกัน
- **ยืนยันบั๊กด้วย transport จำลอง:** ใน `routers/insights.py` เมื่อ
  `Gate(allowed=False, reason="rate_limited")` และ cache ว่าง ยังเกิดความพยายาม
  เรียก provider หนึ่งครั้ง เพราะ branch นี้เรียก `fetch_industry_trends()` ซึ่งจะ fetch
  หากไม่มี cache สด · การตรวจนี้ไม่ส่ง HTTP ไปยัง provider จริง
- CLAUDE ต้องแก้ branch ที่ gate ปิดให้วิเคราะห์ cache โดยไม่เรียกเครือข่าย เช่นใช้
  `analyze_industry_articles(..., source_status="unavailable", source_error="provider_gate_closed")`
  ที่มีอยู่แล้ว เพื่อรักษาสถานะ stale/unavailable และข้อมูล gate ตามจริง · CODEX ไม่แก้ไฟล์
  route หรือ fetch_state ที่อยู่นอกขอบเขต
- ยังไม่ได้ตรวจ deduplication และ `published_at` กับข่าวจริง เพราะยังไม่มีบทความจริง ·
  เทสต์จำลองเดิมยังยืนยันว่า `seendate` คือ `observed_at` และไม่สร้างวันเผยแพร่ขึ้นเอง

## ผลการตรวจสอบล่าสุด: 2026-10-15

ข้อมูลอัปเดตส่วนนี้ใช้แทนบันทึกเดิมด้านล่างเรื่องยังไม่มีข้อมูลลับสำหรับเรียก OpenAI
และยังไม่เคยตรวจเส้นทาง LLM จริง · งานต่อระบบและ reseed ของ Claude บันทึกไว้ใน
`progress.md` · หมายเหตุประวัติด้านล่างจึงไม่ใช่รายการงานต่อระบบที่ยังค้างอยู่ในปัจจุบัน

- `backend/.env` มี key บนเครื่องและ `OPENAI_MODEL=gpt-6-luna` แล้ว · Git ละเว้น key
  และไม่มีการใส่ key ลงในเอกสารหรือไฟล์ส่งมอบงาน
- คำขอวิเคราะห์ HTTP จริงสองคำขอสำเร็จด้วย `aiMode: openai` · ตัวชี้วัด เกรด
  และ finding ทุกฟิลด์เมื่อเทียบตาม ID ตรงกับผลระบบกฎเกณฑ์ทุกไบต์ ·
  กรณีเงินสดขาดมือเปลี่ยนเฉพาะลำดับภายในกลุ่ม severity ตามที่อนุญาตไว้
- ค่าใช้จ่ายตาม usage รวมการเขียนลงแคช: **$0.00144635** · ประมาณการยอดคงเหลือ
  จากยอด $5.98 ที่ผู้ใช้แจ้ง: **$5.97855365** · ยังไม่ได้ยืนยันยอด billing จริง
- finding/action ทั้ง 12 เงื่อนไข และ summary/reasoning ใน explanation เป็นภาษาไทยแล้ว ·
  ID, category, severity, การอ้างอิงหลักฐาน, ปลายทาง และโครงสร้าง JSON คงเดิม ·
  Endpoint overview ของ SME เดโมทั้งสองรายส่งฟิลด์คำแนะนำภาษาไทยผ่าน HTTP จริงแล้ว
- ข่าวยังมีสถานะ unavailable ตามข้อเท็จจริง · DNS/TCP สำเร็จ แต่ HTTPS ค้างที่ TLS
  และการวินิจฉัยแยกผ่าน HTTP ธรรมดาตอบ 429 · ไม่ได้อ้างว่าดึงบทความสำเร็จ
  หรือตรวจการตัดข่าวซ้ำและวันเผยแพร่จากข้อมูลจริงแล้ว · Claude ยังรับผิดชอบการกำหนด
  จังหวะคำขอผู้ให้บริการ และต้องตรวจเครือข่ายหรือ TLS ของผู้ให้บริการตอน deploy เพิ่มเติม
- Frontend และไฟล์ของ Claude ทั้งหมดคงเดิม

หลักฐานและข้อจำกัดโดยละเอียด: `LIVE_PROVIDER_VERIFICATION.md`.

> แปลจากต้นฉบับภาษาอังกฤษของ CODEX · signature ของฟังก์ชัน ชื่อฟิลด์ ชื่อ key ตัวเลข
> และ code block ทั้งหมดคงเดิม · หัวข้อที่ CLAUDE ดำเนินการแล้วหรือยังค้าง มีหมายเหตุกำกับ

## ส่วนที่ 1: cash exposure ของ SWARM แบบออเดอร์จบชิ้น

สมมติฐานทางธุรกิจเปลี่ยนจาก "ผลิตต่อเนื่องตลอดช่วงเครดิต" เป็น **"ออเดอร์จบชิ้น"** ·
ต้นทุนการผลิตเกิดเฉพาะวันที่ 1 ถึง `duration_days` · รับมัดจำวันที่ 0 ·
ยอดคงเหลือตามใบแจ้งหนี้เก็บได้ในวันส่งมอบบวกเครดิตเทอม เว้นแต่มีการระบุสัดส่วน
การรับชำระมาอย่างชัดเจน · **ต้นทุนเกิดก่อนการรับชำระของผู้ซื้อในวันเดียวกัน**

เงินทุนหมุนเวียน = **peak cumulative deficit โดยไม่นับมัดจำตั้งต้น** ·
ส่วนขาดเงินทุน = นับมัดจำหนึ่งครั้ง แล้วหักเงินสดที่ใช้ได้ส่วนที่เกินเงินสำรองออก

ตัวอย่าง 40 ชิ้น/วัน 10 วัน 70 บาท/ชิ้น เครดิต 30 วัน ตอนนี้ต้องใช้ **28,000 บาท
ไม่ใช่ 112,000 บาท** · เทสต์สองตัวที่ผูกกับสูตรเดิมถูกแก้เพราะ**สมมติฐานทางธุรกิจเปลี่ยน** ·
ทุกเทสต์ 241 รายการผ่านกับ Postgres ณ ส่วนนี้ · envelope ของ `allocate()` แถวข้อมูลร้าน
และ key ของ audit ไม่เปลี่ยน · ค่า version ของ engine และข้อเสนอเป็น `v2` แล้ว

### สิ่งที่ CLAUDE ต้องทำ

- คำนวณและอัปเดตยอด allocation ใน `db/seed.sql` แล้ว reseed ตามกระบวนการที่ทีมอนุมัติ ·
  ข้อมูลที่เก็บอยู่ยังมีค่าเดิม · **CODEX ไม่ได้รีเซ็ตฐานข้อมูลหรือแก้ไฟล์ seed**
- ส่งต่อ input ที่เป็น optional ของ `SwarmRequest` ผ่าน `SwarmBody` และ input ของ simulator:
  `production_start` (วันที่แบบ ISO), `collection_schedule` (คู่ day_index/fraction
  ที่รวมกันได้ 1 ของยอดใบแจ้งหนี้หลังหักมัดจำ), `required_business_types`,
  `buyer_coordinates` (latitude/longitude) และ `max_distance_km`
- ส่งต่อ `ShopCapacity.business_type` และ `.coordinates` · `sector` ที่มีอยู่ใช้เป็น
  business_type ได้ · เพิ่มคอลัมน์ latitude/longitude แบบ nullable ใน `sme_profiles`
  และตรวจช่วง latitude -90..90 กับ longitude -180..180 · **CODEX ไม่ได้แก้ schema
  และไม่สร้างพิกัดขึ้นเองจากชื่อจังหวัด**
- ดัก `ValidationError` ตอนสร้าง `SwarmRequest` ใน route แล้วคืน HTTP 422 หรือทำ
  validator เรื่อง shop id ซ้ำบน `SwarmBody` ด้วย · **การตรวจ id ซ้ำของ core
  เกิดหลัง `SwarmBody` ตรวจผ่านไปแล้ว**
- `shop_eligibility(shop, request)` คืน eligible, distance_km และ reasons ·
  ระยะทางเป็น Haversine แบบเส้นตรง **ไม่ใช่ระยะทางขับรถ** · ถ้าบังคับรัศมี
  ร้านที่ไม่มีพิกัดจะถูกตัดออก · ประเภทธุรกิจเทียบแบบตรงตัวโดยไม่สนตัวพิมพ์ ·
  ผู้สมัครที่ผ่านเกณฑ์เรียงตามต้นทุน ระยะทาง กำลังผลิตที่ว่าง แล้วจึง id
- `app/order_cash.py::finite_order_schedule()` เปิดความเคลื่อนไหวแบบระบุวันที่ให้
  ถ้าส่ง production_start มา · ถ้าไม่ส่ง day_index จะเป็นค่าสัมพัทธ์และ date เป็น null

ไฟล์ frontend, adapters, catalog, repository, models, routers, RBAC และไฟล์ SQL
ไม่ถูกแก้

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE ทำครบทุกข้อแล้ว — reseed จาก
> `SWARM_RESEED_VALUES.json`, ส่งต่อ input ใหม่ทั้งหมด, เพิ่ม latitude/longitude/business_type
> ใน `sme_profiles` และแปลง `ValidationError` เป็น 422 · ส่วนขาดรวมของออเดอร์เดโม
> ลดจาก 465,000 เป็น 45,000

## ส่วนที่ 2: การจัดอันดับสินเชื่อและนักลงทุน

```python
from app.matching import match_funding, match_investors

def match_funding(data: FinancialInput, grade: dict, requested_amount: Decimal,
                  products: list[dict]) -> list[dict]: ...

def match_investors(data: FinancialInput, grade: dict, requested_amount: Decimal,
                    investors: list[dict], *, sector: str | None = None,
                    investment_horizon_months: int | None = None) -> list[dict]: ...
```

`products` รับแถวแบบ camelCase จาก `load_funding_products()` ได้ตรง ๆ ·
แถวนักลงทุนรองรับทั้ง snake_case ของฐานข้อมูลและ camelCase · ทั้งสองฟังก์ชันเป็น pure
ตรวจผู้สมัคร ปฏิเสธ ID ซ้ำ และเรียงผลแบบคงที่ตามสถานะ คะแนนจากมากไปน้อย แล้วจึง ID ·
**ต้องส่งวงเงินที่เป็นบวก**

รูปผลลัพธ์ของสินเชื่อ (เงินและอัตราส่วนทุกตัวเป็นสตริงทศนิยม):

```json
{
  "product_id": "catalog-id",
  "match_score": 91,
  "match_reason": "Meets supplied numerical screening criteria; verify documents and provider conditions",
  "status": "eligible",
  "monthly_payment": "888.49",
  "period_installments": "1",
  "additional_period_debt_service": "888.49",
  "post_funding_dscr": "1.9425",
  "missing": [],
  "notice": "Demo ranking of supplied numerical criteria only; not credit approval or an investment offer. Verify documents and provider conditions.",
  "policy_version": "funding-match-demo-v1",
  "assumptions": ["Declared demo scoring and repayment assumptions"]
}
```

dict ที่คืนมามีสมมติฐานครบถ้วนระบุไว้ตอน runtime ·
การทดสอบความทนทาน DSCR หลังรับสินเชื่อ ใช้ค่างวดรายเดือนคูณจำนวนเดือนตามปฏิทิน
ที่เทียบเท่างวดบัญชีเดียวกัน โดยจำกัดไม่เกินอายุสัญญา · หนึ่งปีปฏิทินเต็มคือ 12 งวด
หนึ่งเดือนเต็มคือ 1 งวด และเดือนไม่เต็มคิดตามสัดส่วน ·
**นี่คือแบบจำลองความทนทาน ไม่ใช่การอนุมานวันชำระงวดแรกหรือตารางชำระของผู้ให้กู้**

ความสามารถชำระหนี้ใหม่ต้องผ่านค่าที่สูงกว่าระหว่าง `min_dscr` ของผลิตภัณฑ์
กับพื้นเดโมที่ 1.0 · คะแนนถ่วงน้ำหนัก: ความสามารถชำระหนี้ 45% เกรด 25%
ต้นทุนทางการเงิน 20% ความเร็วในการได้รับเงิน 10%

ผลิตภัณฑ์ประเภทเงินให้เปล่าไม่มีการชำระคืนและไม่เพิ่มภาระหนี้ ·
**CLAUDE ควรใช้ค่างวดศูนย์จาก matcher แทนการคิดเงินให้เปล่าอัตรา 0%
เป็นสินเชื่อแบบผ่อนคืน** · adapter เดิมไม่ถูกแก้ · เกณฑ์วงเงินแบบ hard ที่มีอยู่ยังคงอยู่
และเพิ่มการทดสอบความสามารถชำระหนี้หลังรับทุนเข้ามา

ผลลัพธ์ของนักลงทุนใช้ `investor_id` แทน `product_id` พร้อม match_score, match_reason,
status, missing, notice, policy_version และ assumptions · **ไม่มี** ฟิลด์ monthly_payment
หรือภาระหนี้ที่เสนอ · ขนาดการลงทุน sector เป้าหมาย เกรดขั้นต่ำ DSCR ที่มีอยู่ (ถ้ามี)
และระดับความเสี่ยงที่ยอมรับตามนโยบายเดโม ถูกคัดกรองแยกจากฝั่งหนี้ ·
ถ้าขาด sector เกรด หรือ horizon จะได้สถานะ requires_info ·
**ไม่มีการอนุมานมูลค่ากิจการ สัดส่วนที่ถูกลดทอน หรือการอนุมัติการลงทุน**

CLAUDE ต่อ `POST /api/match-funding` ได้ โดย map ผล snake_case เข้าฟิลด์
matchScore/matchReason ที่ frontend มีอยู่ ใช้ status ที่คืนมา และบันทึกลง
`funding_matches`/`investor_matches` · **CODEX ไม่ได้เพิ่ม route หรือการเข้าถึงฐานข้อมูล**

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE ต่อแล้ว · `POST /api/match-funding` คืนหนี้
> และทุนแยกกันพร้อมบันทึกผล และ `/api/v1/funding/options` ใช้คะแนนจาก matcher แล้ว ·
> พบว่าตอนแรกผม map `period_installments` ไปเป็น `totalRepayment` ซึ่งผิดความหมาย
> (เป็นจำนวนงวดใน**งวดบัญชี** สำหรับ stress test ไม่ใช่อายุสัญญา) แก้เป็น `term_months` แล้ว ·
> ส่วน `Investor` model ใช้ key `id` ไม่ใช่ `investor_id` ซึ่งเป็น key ของผลลัพธ์

## ส่วนที่ 3: การพยากรณ์ 30/60/90 วันแบบระบุวันที่

```python
from app.forecasting import forecast_cashflow, project_cash_events

def forecast_cashflow(events: list[dict] | None, *, opening_cash: Decimal | None,
                      as_of: date, minimum_cash_reserve: Decimal | None = None,
                      schedule_complete_through: date | None = None,
                      include_simulated: bool = False) -> dict: ...

def project_cash_events(*, as_of: date, sme_id: str, project_id: str | None = None,
                        receivables: list[dict] | None = None,
                        payables: list[dict] | None = None,
                        operating_costs: list[dict] | None = None,
                        installments: list[dict] | None = None) -> dict: ...
```

input ของการพยากรณ์รับแถว camelCase จาก `load_cash_events()` หรือ dict แบบ snake_case
ของ cash_events ได้ · **ต้องเรียก catalog ด้วย SME ID ที่ระบุเสมอ** เพราะ dict ของ catalog
ไม่มี tenant ID จึงตรวจขอบเขตย้อนหลังหลัง map ไม่ได้ ·
เงินสดต้นงวดนับความเคลื่อนไหวถึงวัน as_of แล้ว แถวที่เป็นอดีตหรือตรงวัน as_of
จะไม่ถูกนับซ้ำ · การคำนวณใช้เงินสดสุทธิปลายวัน **ไม่อนุมานลำดับภายในวัน** ·
**ไม่มีการแทรกความเคลื่อนไหวรายวันที่สร้างขึ้นเองระหว่างวันที่มี event**

key ของผลลัพธ์: `minimum_cash`, `minimum_cash_date`, `first_shortfall_date`,
`first_negative_date`, `first_reserve_breach_date`, `period_end_balances`
(key เป็น `"30"`, `"60"`, `"90"`), `timeline`, `missing`, `status` และ `assumptions` ·
เงินถูก serialize เป็นสตริงทศนิยม · การขาดมือหมายถึงต่ำกว่าเงินสำรองที่ระบุ
หรือเงินสดในธนาคารติดลบเมื่อไม่ได้ระบุเงินสำรอง ·
**เงินสำรองที่ไม่รู้ค่าจะเป็น null และไม่มีการยืนยันแบบเงียบ ๆ ว่าเป็นศูนย์**

`schedule_complete_through` **ต้องยืนยันโดยผู้เรียกอย่างชัดเจน** ·
ถ้าไม่ได้ยืนยันความครบ ฟิลด์พยากรณ์หลักของ horizon นั้นจะเป็น null และสถานะเป็น
insufficient_data · `conditional_minimum_cash`, `conditional_first_shortfall_date`
และ `conditional_period_end_balances` แสดงเฉพาะสิ่งที่ตารางที่ส่งมาบอกได้
**ห้ามนำไปแสดงเป็นการพยากรณ์ที่ครบถ้วน** · ตารางที่ขาดหรือว่างโดยไม่ได้ยืนยัน
จะถูกประกาศใน missing **ไม่กลายเป็นการพยากรณ์ที่เป็นศูนย์** ·
ตารางว่างที่ยืนยันว่าครบแล้วอย่างชัดเจน สามารถรักษาภาพเงินสดที่รู้ค่าไว้
โดยไม่มีความเคลื่อนไหวในอนาคตได้อย่างถูกต้อง

event เดโม 7 รายการ เล่นซ้ำ ณ วันที่ 2026-09-30 ด้วยเงินสดต้นงวด 5,000,000 บาท
และยืนยันความครบถึง 2026-12-29 ให้ผล: เงินสดต่ำสุด **3,370,000 บาท วันที่ 2026-10-25**
และยอดปลายงวด 30/60/90 = **3,370,000 / 3,370,000 / 5,770,000** ·
การรับชำระวันที่ 2026-11-30 เป็นวันที่ 61 จึง**ไม่ถูกนับในวันที่ 60**

DTO ของภาระที่คาดการณ์: `{id, due_date, amount, title, partner?}` ·
ส่งเฉพาะภาระต้นทางที่ยังค้างอยู่ · **หมวดที่ไม่รู้ค่า (`None`) ต่างจากหมวดที่รู้ว่าว่าง (`[]`)** ·
แถวที่เลยกำหนดต้องมีวันที่เลื่อนนัดจริง และจะถูกรายงานใน overdue/missing
**ไม่ถูกย้ายไปวันในอนาคตที่สร้างขึ้นเอง** · generator คืน
`{events, missing, overdue, status}` · แต่ละ event มี UUID ที่คงที่, sme_id, project_id,
event_date, day_index, type, title, amount, is_inflow, partner, status=projected,
impact_reason · day index สัมพัทธ์กับ as_of ที่ส่งมา ·
**ID คงเดิมเมื่อมีการแก้ยอดหรือวันครบกำหนด**

CLAUDE ควร upsert แถวที่สร้างขึ้นด้วย id แปลง event_date แบบ ISO เป็น DATE ตามต้องการ
และรักษาความสัมพันธ์กับ tenant/project · ไม่ต้องเพิ่มคอลัมน์ใด ·
**อย่ายืนยันว่าข้อมูลครบขณะที่หมวดต้นทางยังไม่รู้ค่า** · CODEX ไม่ได้อ่าน/เขียนฐานข้อมูล
หรือแก้ route · `build_analysis()` คง signature และรูปผลลัพธ์เดิม ·
ส่วน unknowns ของมันเปลี่ยนไปชี้ให้ผู้เรียกไปใช้ฟังก์ชันพยากรณ์นี้
แทนการบอกว่าโมดูลไม่มีอยู่

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE เปิด `GET /api/forecast` แล้ว
> ให้ผลตรงกับค่าที่ระบุไว้ข้างบนทุกตัว และหากไม่ส่ง `schedule_complete_through`
> ค่าหลักจะเป็น null พร้อมสถานะ insufficient_data ตามที่ออกแบบ ·
> ส่วน `project_cash_events()` ยังไม่ถูกต่อเข้า route (ยังไม่มีแหล่งข้อมูลลูกหนี้/เจ้าหนี้
> แบบระบุวันที่ในระบบ)

## ส่วนที่ 4: ข่าวอุตสาหกรรมและสัญญาณแบบคงที่

```python
from app.industry import fetch_industry_trends, analyze_industry_articles

async def fetch_industry_trends(sector: str, *, as_of: datetime,
                                 cached_articles: list[dict] | None = None,
                                 client: httpx.AsyncClient | None = None,
                                 force_refresh: bool = False) -> dict: ...
```

ใช้ GDELT DOC 2.0 ArticleList API แบบสาธารณะ ด้วย query ที่กำหนดต่อ sector
ไม่ต้องใช้ API key ค้นย้อนหลัง 7 วัน และจำกัดขนาด response/จำนวนรายการ ·
sector ที่รองรับ: food_processing, food, packaging, manufacturing, agriculture,
retail, logistics, services · **ไม่มีการส่งข้อมูลการเงินหรือตัวตนของ SME ไปยัง GDELT** ·
เอกสารผู้ให้บริการ: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/

ผลลัพธ์มี sector, as_of, status, source_status, source_error, retry_after_seconds,
articles, findings, missing, notice, assumptions · สถานะเป็น ok, empty, stale
หรือ unavailable · ข่าวใน cache ที่เพิ่งดึงถูกนำมาใช้ซ้ำได้ 5 นาที ·
วันที่ของแหล่งที่เก่ากว่า 72 ชั่วโมง หรือการดึงที่เก่ากว่า 1 ชั่วโมง ถือเป็น stale ·
ข้อมูลใน cache ที่เก่ากว่า 7 วันจะไม่ถูกคืน · ผู้ให้บริการล้มเหลวแต่มี cache ที่ใช้ได้
จะคืน stale · ล้มเหลวโดยไม่มีข้อมูลจะคืน unavailable พร้อม articles/findings ว่าง
และ missing=industry_news · **ไม่มีการ retry อัตโนมัติ** ·
HTTP 429 จะเปิดคำใบ้ retry ที่มีขอบเขต โดยมีค่าต่ำสุด 5 วินาที

ฟิลด์ของบทความ: id (SHA-256 ของ sector กับ URL แบบ canonical), provider,
source (host ของ URL), sector, url, title, published_at, observed_at, fetched_at,
date_source, status · **หัวข้อและลิงก์มาจากแถวของแหล่งข่าวเท่านั้น** ·
`seendate` ของ GDELT เก็บเป็น observed_at พร้อม date_source=gdelt_first_seen ·
**API ไม่ได้ระบุเวลาเผยแพร่จริง จึงให้ published_at เป็น null และใส่เรื่องวันที่เผยแพร่
ไว้ใน missing แทนการสร้างขึ้นเอง** · ลิงก์ติดตาม URL ซ้ำ และหัวข้อที่เผยแพร่ซ้ำแบบเดียวกัน
ถูกตัดออกอย่างคงที่

สัญญาณที่ได้เป็นการคัดกรองด้วยคำสำคัญในหัวข้อซึ่งประกาศไว้ชัดเจน
**ไม่ใช่การตีความบทความทั้งฉบับ และไม่ใช่การกล่าวอ้างเกี่ยวกับ SME รายใด** ·
finding เรื่องความเสี่ยง/โอกาสมี article_id, evidence_url, matched_terms,
สถานะความสดของข้อมูล และ notice · เส้นทาง rules ปัจจุบันไม่ต้องใช้เครดิต LLM ·
**หัวข้อข่าวย้อนหลังหรือที่ใช้ทดสอบ จะไม่ถูกใส่เป็นข่าวสด** ·
ข่าวไม่ถูกเพิ่มเข้า finding/เกรดทางการเงินโดยอัตโนมัติ

### ที่จัดเก็บที่ขอจาก CLAUDE

- `industry_news`: id TEXT primary key (64 ตัวอักษร hex), provider TEXT, source TEXT,
  sector TEXT, url TEXT, title TEXT, published_at TIMESTAMPTZ nullable,
  observed_at TIMESTAMPTZ, fetched_at TIMESTAMPTZ, date_source TEXT;
  unique(provider, sector, url) · raw JSONB เป็น optional สำหรับ metadata
  ของผู้ให้บริการเท่านั้น
- `industry_news_fetch_state`: provider เป็น primary key, last_attempt_at,
  last_success_at, next_allowed_at TIMESTAMPTZ, last_error TEXT ·
  ประสานการล็อก/จำกัดอัตราระดับผู้ให้บริการข้าม worker และ sector ·
  **อย่าดึงข้อมูลทุกครั้งที่ render หน้า**
- metadata ของ cache เก็บเป็นการสังเกตจริง · ความสดคำนวณใหม่ตอนตอบคำขอ
  และ**ห้ามเก็บเป็น flag ว่าสดถาวร**
- เก็บ finding ที่สรุปได้เฉพาะเมื่อจำเป็น โดยอ้าง article id และเวอร์ชันนโยบาย ·
  **ไม่มีการสร้างเนื้อหาบทความเต็ม บทสรุปที่แต่งขึ้น หรือค่าความเชื่อมั่นของ sentiment** ·
  ฟิลด์ summary/sentiment ที่เคยเสนอไว้ไม่จำเป็น

CODEX ไม่ได้สร้างตารางหรือ API route · การยิง GDELT จริงตอนพัฒนาได้ HTTP 429 ·
**การจัดการเมื่อแหล่งข่าวล่มเป็นเส้นทางที่ทดสอบแล้วว่าทำงาน ไม่ใช่หลักฐานว่าดึงหัวข้อข่าวสด
ได้สำเร็จ**

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE สร้างตาราง `industry_news` และเปิด
> `GET /api/industry/trends` แล้ว โดย upsert ด้วย id ของ fetcher ·
> **ยังไม่ได้ทำ 2 ข้อ:** (1) unique(provider, sector, url) — ปัจจุบันบังคับความไม่ซ้ำ
> ด้วย id ซึ่งเป็น hash ของ sector กับ URL อยู่แล้ว (2) ตาราง
> `industry_news_fetch_state` และการประสานจำกัดอัตราระดับผู้ให้บริการ —
> route ปัจจุบันจึงยังไม่มีการล็อกข้าม worker ควรเพิ่มก่อนใช้งานจริงหลายเครื่อง

## การตรวจสอบรอบสุดท้ายและงานต่อระบบที่เหลือ

- ชุดเทสต์เต็มรอบสุดท้ายผ่าน **308 tests** กับ Postgres · เทสต์ baseline 225 รายการเดิม
  ยังผ่าน โดยค่าที่คาดหวังซึ่งผูกกับสูตรถูกเปลี่ยนอย่างตั้งใจตามสมมติฐานออเดอร์จบชิ้น ·
  ยังมี deprecation warning ของ Starlette/httpx หนึ่งรายการ และ
  **ไม่ได้อัปเกรด dependency ที่ไม่เกี่ยวข้อง**
- เริ่ม Docker Compose โดยไม่ลบ volume · `backend/run.cmd` เปิด API ที่
  127.0.0.1:8000 · การตรวจผ่าน HTTP จริงได้ 200 ทั้ง health, docs และตัวอย่าง P0
  แบบออเดอร์จบชิ้น ซึ่งให้เงินทุนหมุนเวียน/ส่วนขาด **28,000 บาท**
- ทดสอบ matcher และ forecaster แบบ pure กับแถวสินเชื่อใน catalog ทั้ง 4 รายการ
  และ cash_events แบบระบุวันที่ 7 รายการจาก Postgres **โดยไม่เขียนฐานข้อมูล**
- `SWARM_RESEED_VALUES.json` มีค่า allocation v2 ที่แม่นยำสำหรับ PO-STP-2026-091
  คำนวณจากโปรไฟล์เดโมปัจจุบัน · ค่า allocation ใหม่ของ Rung Charoen คือ
  เงินทุนหมุนเวียน 105,000 บาท และส่วนขาด 45,000 บาท ·
  **ข้อมูล seed/DB ยังไม่ถูกอัปเดต CLAUDE ต้องแก้ seed แล้ว reseed**
- `OPENAI_API_KEY` และ `OPENAI_MODEL` ยังไม่ได้ตั้ง · ผู้ใช้ไม่มีเครดิต OpenAI
  จึง**ไม่มีการยิงคำขอ LLM จริงและไม่ได้อ้างว่าทดสอบแล้ว** ·
  มีเทสต์ mock ระดับ HTTP transport ใหม่ 9 กรณี ครอบคลุม JSON ที่ถูกโครงสร้าง,
  JSON/ผลลัพธ์โมเดลที่ผิดรูป, การปฏิเสธ, timeout, credential ล้มเหลว 401/403,
  429 เครดิต/จำกัดอัตรา และ 500 ฝั่งเซิร์ฟเวอร์ ·
  ตัวชี้วัด/เกรด/finding ทางการเงินไม่เปลี่ยน และโหมด rules ยังใช้ได้ ·
  อ้างอิง Structured Outputs:
  https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- การยิง news API จริงได้ HTTP 429 แล้วตามด้วย timeout · คำตอบรอบสุดท้ายเป็น
  unavailable โดยมีบทความ 0 รายการ บันทึกไว้ใน uploads ในเครื่อง ·
  **ไม่มีการอ้างว่าดึงหัวข้อข่าวสดหรือยืนยันวันเผยแพร่ได้**
- การเทียบคุณสมบัติหลังรับทุนใช้อัตราส่วนที่ยังไม่ปัดเศษ ·
  ค่าที่แสดงเป็น 1.5000 อาจยังต่ำกว่าเกณฑ์ 1.5 ก่อนปัดเศษได้ ·
  เหตุผลการปฏิเสธจะระบุความต่างนี้ แทนการแสดงการเปรียบเทียบที่ปัดเศษแล้วดูขัดแย้งกัน
- **ตรรกะใหม่ไม่ได้ถูกต่อเข้า endpoint ของ CLAUDE โดยอัตโนมัติ** · งานที่ต้องทำ:
  ส่งต่อ input ของ SWARM และดัก validation error; reseed; ต่อการจัดอันดับและบันทึกผล
  การจับคู่; กำหนดขอบเขต tenant/project ของ cash events และยืนยันความครบของ horizon;
  เพิ่มการเก็บข่าวและการประสานจำกัดอัตรา พร้อมต่อเข้า route
- ไม่มีการแก้ `src/`, adapters, catalog, repository, models, routers, RBAC,
  `schema.sql` หรือ `seed.sql` เทียบกับ baseline `94ad7ab`
