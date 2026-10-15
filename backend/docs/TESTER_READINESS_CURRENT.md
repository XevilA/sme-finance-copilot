# สถานะส่ง tester หลังต่อ Import

ตรวจ 2026-10-15 Asia/Bangkok จาก checkout ต่อจาก `dde929e` · ใช้ข้อมูลสังเคราะห์เท่านั้น ·
อ่านข้อจำกัดก่อนอ้างว่า “ครบทุกฟีเจอร์บนเว็บ”

## สิ่งที่ทำและวัดแล้ว

| ส่วน | ผลจริง |
| --- | --- |
| นำเข้า XLSX | template จาก HTTP ประมาณ 5,781 bytes → `/api/v1/upload?persist=false` → เกรด B; fileStored=false; ไฟล์เสีย 422 |
| Manual / Math | validate flat → calculate wrapped → analyze wrapped; liquidity 2.0000, เกรด B / 75.00 ของตัวอย่าง |
| Analyst | ข้อเท็จจริงและ views มาจากผลคำนวณเดียวกัน; ไม่เรียก LLM อัตโนมัติ |
| Forecast | Rung ณ snapshot 2026-09-30 และยืนยันถึง 2026-12-29: ต่ำสุด 29,700 เริ่มต่ำกว่าเงินสำรอง 2026-10-18 |
| Funding | Rung ขอทุนจากส่วนขาดจริง 45,000; หนี้และทุนแยกกัน |
| SWARM | synthetic 40 ชิ้น/วัน × 10 วัน × 70 บาท = ต้นทุน 28,000; persist=false |
| Simulator | synthetic revenue_change_pct=0.10 เปลี่ยนรายได้ 250,000 → 275,000 |
| ข่าว | HTTP ตอบ unavailable, provider_gate_closed, บทความ 0; ไม่เปิด gate ฝืนเพื่อทดสอบข่าวซ้ำ |
| Infrastructure | /health ok, persistence=true; 34 routes หลัก, 27 ตาราง; 16 read contracts ผ่าน HTTP และมี source |
| Browser | manual และ file picker ผ่านถึง Overview: รายได้ 250,000 ค่าใช้จ่าย 200,000 กำไร 50,000 เงินสด 80,000 |
| Drag/drop | event handler จริงผ่าน regression พร้อมกันส่งซ้ำ/กรณี error; ยังไม่ได้ลากไฟล์จาก OS ผ่าน browser automation |

Backend **482 ผ่าน + 3 skip** กับ PostgreSQL; **383 ผ่าน + 102 skip** ไม่มี DB ·
ยังมี Starlette/httpx warning หนึ่งรายการ · ไม่แก้ assertion เดิมให้เบาลงหรือเขียน test เดิมใหม่

Frontend build **1955 modules** · CSS **index-DEindwiw.css** คงเดิม ·
JS **index-E6xWZDJT.js** · มี warning JS เกิน 500 kB · invariant checks เดิมผ่าน

## เปิดทดสอบใน cmd.exe

หน้าต่างแรก:

```bat
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
```

ตรวจพอร์ตก่อนเปิด server ซ้ำ · ไม่ลบ volume หรือ reset ข้อมูลเดโม

หน้าต่างที่สอง (ค่า VITE ใช้เฉพาะ process นี้ ไม่ใช่ secret):

```bat
set "VITE_USE_MOCK=false"
set "VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1"
pnpm exec vite --host localhost --port 5173 --strictPort
```

เปิด `http://localhost:5173` · `.env` ที่ตรวจครั้งนี้อนุญาต origin นี้ แต่ไม่อนุญาต
localhost:3000 ดังนั้นใช้คำสั่งข้างบนโดยไม่เปลี่ยน config ของทีม · ถ้า tester ใช้ origin
อื่น ให้ทีมตรวจ CORS_ORIGINS ที่ backend ก่อน · คง RBAC_ENFORCED=false / AUTH_DEV_HEADER=false

Regression ที่รันซ้ำได้:

```bat
backend\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini -q --basetemp=backend/uploads/pytest-temp
backend\.venv\Scripts\python.exe backend/scripts/verify_tester_flow.py
node scripts/test-import-wiring.mjs
pnpm run build
pnpm run test:invariants
```

`verify_tester_flow.py --news` เพิ่มการเรียกข่าวผ่าน gate หนึ่งครั้ง ไม่มี force/retry ·
ไม่จำเป็นต้องเรียกซ้ำเพียงเพื่อยืนยัน network เดิม · ผลวัด local อยู่ใน
`backend/uploads/tester-readiness-verification.json` ซึ่ง Git ละเว้น

## ฟอร์มและผลของผู้ใช้

- รองรับ FinancialInput ครบ **38 ฟิลด์: 7 required + 31 optional** รวม loan แบบ nested ·
  จำนวนเงินส่งเป็นสตริง จำนวนหน่วย/งวดส่งเป็น integer · ช่องว่างถูกละ ไม่แทนด้วยศูนย์
- ร่างอยู่ใน sessionStorage ของแท็บ; ผลที่คำนวณสำเร็จอยู่ในหน่วยความจำและผูก inputHash ·
  Overview/Health/Cost/AI panel ใช้ผลนี้จนมีผลใหม่หรือ reload · ไม่ส่งงบไปเป็นร้านล่าสุดร่วมกัน
- `/analyze` เพิ่ม shop_name optional และ views แบบ additive · ไม่เปลี่ยน body รูปเดิม:
  `/inputs/manual` flat, `/calculate` / `/analyze` wrapped · use_llm=false ใน Import
- ไม่มี SME identity จากข้อความชื่อร้าน จึงไม่บันทึก financial record ลงร้านเดโม ·
  ไม่มีข้อมูลวันที่รับจ่าย/expense history ของร้านใหม่ให้ยืนยัน จึงประกาศ missing ตามจริง
- Mock mode ยังเปิดเว็บจาก fixtures ได้โดยไม่ต่อ backend แต่ปุ่มคำนวณ/อัปโหลดแจ้งว่า
  ต้องตั้งโหมด backend จริง ไม่แสดงความสำเร็จจาก fixture

## สิ่งที่ต้องแก้ก่อนอ้างว่าเว็บใช้ข้อมูลจริงครบ

1. **ต้องขยายสิทธิ์ไฟล์ที่สามก่อน:** OverviewPage.tsx ยังฝังตัวเลข −5,000, 36,200,
   10,000 และ badge actual แม้ข้อมูลที่ส่งเป็น simulated · browser ยืนยันความขัดแย้งแล้ว ·
   ภาพอยู่ใน `backend/uploads/import-browser-verification.png` · ไม่แก้ไฟล์นี้เอง
2. SimulatorPage.tsx ยังใช้สูตรในหน้า; SwarmPage.tsx ยังมีปุ่มจำลองแทน POST ·
   การต่อ Import และการที่ API ตอบ 200 ไม่ได้ทำให้ action ในสองหน้านี้กลายเป็น engine จริง
3. Import ยังมีข้อความเดิมเรื่อง XLS/CSV/25MB และ column mapping ซึ่งขัดกับ parser จริง ·
   การเลือกไฟล์/error ยึด XLSX template และ 5MiB แล้ว แต่คำสั่งห้ามเปลี่ยน copy ยังคงอยู่
4. หมวดสต็อกยังไม่มีฟิลด์ inventory ใน FinancialInput; ไม่มีการประดิษฐ์ DIO หรือยอดสต็อก
5. Railway และ Vercel env ยังต้องทีมดำเนินการ ไม่มีผลตรวจ deploy ใหม่ในรอบนี้ ·
   ข่าวสดและ published_at/dedup กับบทความจริงยังไม่ยืนยัน
6. พิกัดร้านยังไม่ทราบ ไม่เดาจากจังหวัด · resource eligibility ยังไม่ใช่การจองกำลังตามเวลา

ตั้งรหัสสุ่มให้ admin@example.test ใน local DB แล้ว อ่านกลับยืนยันว่ามี hash ·
credential อยู่เฉพาะ `backend/uploads/admin-tester-credentials.txt` ที่ Git ละเว้น ·
AUTH_SECRET ยังไม่ตั้ง จึงยังไม่ได้ยืนยัน admin login/revoke บน server ปัจจุบัน ·
ไม่ใส่ credential ในเอกสารนี้หรือ commit
