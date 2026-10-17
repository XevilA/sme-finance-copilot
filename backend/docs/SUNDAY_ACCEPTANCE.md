# Sunday acceptance — Backend, 18 October 2026

เตรียมจาก backend runtime `f23c09e` บน main · ผลตรวจ 17 ตุลาคม 2026 (Asia/Bangkok).
ผู้ใช้ให้เน้น backend ก่อน เพราะ Claude ติด limit. ไม่อ้างว่า frontend integration
หรือ deployed browser demo เสร็จแล้ว. ชุดทดสอบใช้ fixtures สังเคราะห์แยกจากข้อมูลทีม.

## เริ่มจาก cmd.exe

```bat
cd /d D:\code-project\sme-finance-copilot
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
```

ถ้าพอร์ต 8000 มี process จากรอบนี้อยู่แล้ว ให้ตรวจ `/health` และ source ก่อนเปิดซ้ำ.
Config คือ `backend\.env`; ไม่ใส่ secrets ใน VITE_* และไม่รัน seed/reset volume.
Migration เพิ่มเฉพาะ constraints/resources_known/replay_version/context; schema ยัง 27 ตาราง.

เปิด terminal ที่สอง:

```bat
if not exist node_modules\.cache mkdir node_modules\.cache
backend\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini -q --basetemp=node_modules/.cache/pytest-sunday
backend\.venv\Scripts\python.exe backend/scripts/verify_backend_demo.py
backend\.venv\Scripts\python.exe backend/scripts/verify_tester_flow.py
backend\.venv\Scripts\python.exe backend/scripts/verify_auth_http.py
node scripts/test-import-wiring.mjs
node scripts/test-page-wiring.mjs
pnpm build
```

ผลที่วัดรอบส่งมอบ: DB **545 passed / 3 skipped (34.03s)**; ไม่มี DB **426 / 122
(10.29s)**. DB skips คือสอง login tests ที่ยังไม่ตั้ง DEMO_LOGIN_PASSWORD และหนึ่ง
test สำหรับโหมดไม่มี DB. ไม่ได้ลด assertions เดิม. Auth HTTP ใช้ actor/secret สังเคราะห์
ชั่วคราวบนพอร์ต 8016 ไม่แก้ .env และไม่เปิด enforcement ของ demo.

ทดสอบไม่มี DB ใน cmd.exe โดยตั้ง empty string ภายใน Python ก่อน import dotenv:

```bat
backend\.venv\Scripts\python.exe -c "import os,runpy,sys; os.environ['DATABASE_URL']=''; sys.argv=['pytest','-c','backend/pytest.ini','-q','--basetemp=node_modules/.cache/pytest-sunday-nodb']; runpy.run_module('pytest',run_name='__main__')"
```

`set DATABASE_URL=` เพียงอย่างเดียวทำให้ dotenv โหลดค่าจาก .env กลับมา จึงไม่ใช่
หลักฐานว่าได้ทดสอบแบบไม่มี DB. Warning เดิม: Starlette/httpx และ JS bundle >500kB.

## สิ่งที่ acceptance script ต้องยืนยัน

`verify_backend_demo.py` สร้าง UUID ของตัวเอง ตรวจ DB กลับหลังแต่ละ write และล้าง
เฉพาะ fixtures ของ invocation นี้ใน finally:

1. ดาวน์โหลด template → multipart upload persist=false; fileStored=false.
2. Calculate persist=true ให้ SME สังเคราะห์ → อ่าน FinancialRecord กลับตรง input/grading.
3. Analyze, funding/evaluate และ forecast/preview ใช้ SME/project/input_revision เดียวกัน
   และคืน inputHash เดียวกัน. เกรด B/75; ไม่มีการหยิบ grade D ของ Rung มาแทน input.
4. Forecast จาก cash events ที่ระบุวันที่ของ SME/project นี้: ต่ำสุด 70,000; 90 วัน 85,000.
   ค่าใช้จ่ายเดือน Jul/Aug/Sep สังเคราะห์มี anomaly ที่ตรวจย้อน source IDs ได้.
5. เก็บ/อ่าน constraints ของออเดอร์ → DB read-back. synthetic_food ผ่าน;
   synthetic_packaging ถูกตัดออกแม้ต้นทุนต่ำกว่า. ไม่ยืนยัน suitability ของร้านจริงแทนทีม.
6. SWARM persist=false ไม่บันทึก allocation; required resource outage คำนวณ Plan B ใหม่
   ให้ขาดกำลังผลิตจริง ขณะที่ Plan A และ resource status ใน DB ไม่เปลี่ยน.
7. Save simulation → list ตาม project → read ID → DB payload/results/audit/version ตรงกัน
   → replay reproduced=true; เทียบเวอร์ชัน/บริบทสดแยกจากผล snapshot.
8. Wrong project = 404, ไม่ส่ง scope = 422, stale input hash = 422. Partial Cost เป็น null.

Tests เพิ่มเติมยืนยัน unknown constraints != explicit [], dependency ว่างไม่ข้าม
required offered truck, การ save ไม่ยืนยัน resource, forecast coverage ไม่ถูกเดา,
legacy partial simulation อ่านได้แต่ replay 409, tampered result/version แสดง stale,
และ saved reads ปฏิเสธ SME scope อื่นเมื่อเปิด enforcement ใน test.

## ตรวจข่าวโดยไม่ force

ปกติไม่เรียก provider ระหว่าง acceptance ซ้ำ. ถ้าทีมต้องตรวจข่าวจริงหนึ่งครั้ง:

```bat
backend\.venv\Scripts\python.exe backend/scripts/verify_tester_flow.py --news
```

รอบส่งมอบ 17 ตุลาคม 07:02 Asia/Bangkok: provider timeout, unavailable, 0 articles;
DB ยืนยัน lastError=timeout, consecutiveFailures=1, nextAllowedAt ห่าง 60 วินาที.
ไม่ปิด TLS verification, ไม่ force/retry, ไม่อ้างว่ามีข่าวสด. lastSuccessAt ของ state
เดิมเคยถูก tests เก่าแก้ จึงไม่ใช่หลักฐานดึงข่าวสำเร็จ. Tests ปัจจุบันแยก synthetic gate
และ transport แล้ว; advisory transaction lock ใช้ key คงที่ข้าม process และถือจน commit.

## งานที่รอ Claude/ทีม ก่อน browser acceptance ทั้งระบบ

ยังไม่มี codex/demo-frontend บน remote เมื่อส่งมอบ; ผู้ใช้ยืนยันว่า Claude ติด limit.
Backend ไม่แก้ src/**, frontend scripts/tests, progress.md หรือ docs/FRONTEND_DEMO_HANDOFF.md.

- **เร่งด่วน:** CostPage.tsx:105 เรียก currentMonthlyFixedCost.toLocaleString() โดยตรง.
  ต้องเพิ่ม nullable types/guards ก่อนใช้ Cost กับ input ไม่ครบ; backend คืน null ตามจริงแล้ว.
- api/client ต้องส่ง active context/revision และทิ้ง stale responses; draft เปลี่ยนต้อง
  invalidate accepted analysis. Funding ใช้ POST funding/evaluate, cashflow ใช้
  POST forecast/preview ตาม imported input; legacy GET defaults ไม่ใช่ imported context.
- Simulator ส่ง project_id/input_revision/input_hash และต่อ list/read/replay ตาม matrix.
  Chaos ต่อเฉพาะ effects ที่ engine รองรับ: price/cost/deposit/terms/shop removal/resource outage.
- สมัครทุน/ลงนาม/ขอข้อมูล/ส่งออก/reservation ต้อง unavailable ตาม GET capabilities.
  ยังไม่มี business contract/actor/state transition สำหรับธุรกรรมเหล่านี้.
- GET financial views และ POST analyze จำกัด expense observations ถึง period_end แล้ว;
  legacy GET defaults ยังเลือก stored statement จึงไม่ควรทับ accepted imported input.
- Project จริงยังขาด business requirements/พิกัด/รัศมี/collection schedule; รถ required
  ยัง offered. Backend/schema พร้อม แต่ข้อมูลจริงต้องมาจากเจ้าของ ไม่เติมให้ demo ผ่าน.
- ทีมโฮสต์ต้องให้ backend URL และตั้ง Vercel VITE_API_BASE_URL / VITE_USE_MOCK=false.
  ไม่มี deployment ใหม่หรือผล browser บน host ในรอบนี้. ไม่ซื้อ/สร้าง infra ใหม่.

Build หลังรวมเฉพาะ backend: **1955 modules**, CSS **index-DEindwiw.css**, JS
**index-CBenrrOQ.js**. ไม่แตะ UI; build/client checks ผ่านไม่เท่ากับ browser demo ครบ.
ตรวจ browser ทั้งเส้นทางอีกครั้งหลังรับ branch ของ Claude แล้วจึงอ้าง combined completion.
