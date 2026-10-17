# Backend / AI prototype — 17 October 2026

ขอบเขต backend สำหรับ prototype วันนี้: import → calculate → analysis/health/cost →
funding evaluation → SWARM → simulator → save/list/read/replay. ใช้งานผ่าน API ได้โดย
ไม่ต้องรอ frontend ของ Claude. เอกสารนี้แยกงาน backend ที่ทำแล้วจากข้อมูลธุรกิจจริง
และ external services ที่ยังไม่พร้อม; ไม่ตีความว่าทุกปุ่มบนเว็บเป็นธุรกรรมจริงแล้ว.

## Checklist backend ที่ implement และทดสอบแล้ว

- [x] Manual/XLSX import และ validation: 39 FinancialInput fields, required fields,
  nullable unknowns, finite numbers และ inventory aliases. ไม่มีสูตร DIO จาก inventory เพียงตัวเดียว.
- [x] Decimal math/financial grade พร้อมสูตร เวอร์ชัน และ evidence; unknown Cost เป็น null.
- [x] Rules AI ใช้ตัวเลขและ SME/project/input revision เดียวกับ analysis; expense evidence
  ไม่ข้าม period_end. Optional LLM จัดอันดับ findings ได้เท่านั้น พร้อม bounded call/fallback.
- [x] Funding จัดอันดับ debt/equity จาก imported statement โดยไม่เลือก seed SME แทน.
- [x] Forecast preview ใช้ dated events/closing cash ของ context ที่เลือก; coverage unknown
  ยังเป็น null/conditional. ไม่สร้าง dated events จากยอดงบรวม.
- [x] SWARM เก็บ/โหลด constraints และ collection schedules, ตรวจ business eligibility,
  capacity และ required resources; preview ไม่จองทรัพยากรและไม่เปลี่ยน offered เป็น confirmed.
- [x] Statement/order simulation, resource outage และ shop removal คำนวณผลใหม่.
- [x] Save/list/read/replay เก็บ full input/results/audit/version/context, scope ตาม project/SME;
  ระบุผลหรือ context/version ที่ต่าง และไม่สร้าง input ย้อนหลังให้ legacy saves.
- [x] Industry provider/cache/gate/backoff และ unavailable response พร้อมใช้งาน; lock
  ตรวจจริงข้าม process/connections. **ข่าวสดยัง unavailable** หลัง provider timeout.
- [x] PostgreSQL persistence, CORS Authorization และ auth/token/revocation ผ่าน tests และ
  real HTTP + DB read-back ด้วย actors สังเคราะห์; demo enforcement ยังคงปิดตามข้อตกลง.

ผล suite ที่ยืนยันกับ source `f23c09e`: **545 passed / 3 skipped กับ PostgreSQL**,
**426 passed / 122 skipped ไม่มี DB**. Readiness และผลหลัง resume ดู entry ล่าสุดใน
[CODEX_HANDOFF.md](CODEX_HANDOFF.md). ไม่มีการลด assertions เพื่อทำให้ผลผ่าน.

## เริ่ม prototype วันนี้ใน cmd.exe

```bat
cd /d D:\code-project\sme-finance-copilot
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
```

เปิด [API documentation](http://127.0.0.1:8000/docs) เพื่อเรียก API จริง.
Config อยู่ `backend\.env`; ไม่ reset/reseed volume และไม่ใส่ secrets ใน VITE_*.
ถ้า server เปิดอยู่ ให้ตรวจ health/source ก่อนเริ่มซ้ำ.

อีก terminal:

```bat
backend\.venv\Scripts\python.exe backend/scripts/verify_backend_demo.py
backend\.venv\Scripts\python.exe backend/scripts/verify_tester_flow.py
backend\.venv\Scripts\python.exe backend/scripts/verify_auth_http.py
```

สคริปต์แรกทดสอบเส้นทางครบด้วย fixtures สังเคราะห์แยก, อ่าน DB ยืนยันทุก write และล้าง
เฉพาะ UUID ที่สร้างเอง. ตัวอย่าง: B/75, forecast minimum 70,000 / 90-day 85,000,
food-only allocation, outage recomputation และ saved replay reproduced=true.
สคริปต์ auth ใช้ secret ชั่วคราวและไม่แก้ credentials/config จริง.

Contracts/body/query/null/errors อยู่ [API_CONTRACT_MATRIX.md](../../docs/API_CONTRACT_MATRIX.md).
คำสั่งทดสอบละเอียดอยู่ [SUNDAY_ACCEPTANCE.md](SUNDAY_ACCEPTANCE.md).

## ขอบเขตที่ต้องบอกทีมวันนี้

- ข่าวสดยัง unavailable; ระบบคืนผลตามจริง ไม่มีบทความที่แต่งขึ้น. ไม่ force/retry เพื่อให้ demo ผ่าน.
- Funding application, signing, information request, export และ resource reservation ยัง
  unavailable ตาม `/api/v1/capabilities`; ต้องมี business contracts ก่อนสร้างธุรกรรม.
- ข้อมูล constraints/coordinates/collections ของโครงการจริงต้องมาจากเจ้าของ. Fixtures
  สังเคราะห์ใช้พิสูจน์ engine ได้ แต่ใช้ยืนยัน readiness ของร้านจริงไม่ได้.
- Frontend ยังรอ Claude: nullable Cost guard, active context/revision, funding/forecast,
  saved reads/replay และ unavailable actions. ไม่แก้ `src/**` ใน backend lane.
- ไม่มี deployment ใหม่; prototype รอบนี้ยืนยัน local API และ DB เท่านั้น.
