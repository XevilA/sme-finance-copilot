# สถานะก่อนส่ง tester — ตรวจจริง 2026-10-16

ฐานงาน `269e3d2` บน main · ขอบเขต src 5 ไฟล์ตามคำอนุญาตล่าสุด · รายละเอียดการเปลี่ยน
และการตัดสินใจอยู่ใน CODEX_HANDOFF.md รอบ 2026-10-16 · ไม่มีผล deploy ใหม่

| ผลวัด | ค่า |
| --- | --- |
| pytest กับ PostgreSQL | 494 passed / 3 skipped |
| pytest ไม่มี DATABASE_URL | 394 passed / 103 skipped |
| targeted order/persistence หลังแก้สุดท้าย | 23 passed |
| final Overview/import/order contracts | 39 passed |
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

## สิ่งที่ทดสอบผ่านหน้าเว็บได้

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
- HeroAssembly / ChaosPlayback / AppShell/sidebar และหน้าที่ไม่ได้อนุญาตยังมีฉากสาธิต ·
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
