# Deploy และ pre-test handoff — Backend / AI

> **Online prototype override — 2026-10-18:** ผู้ใช้เลือก deploy เว็บใหม่ในบัญชี
> `lighttriad00-4894`: https://sme-finance-copilot-prototype.vercel.app/ . เชื่อม
> Neon แล้ว, health `persistence=true`, 27 tables, bootstrap `off`; production
> HTTP acceptance และ scoped simulation replay ผ่าน. หน้า UI 3 และ 6–13 โหลดได้.
> ไฟล์ผู้ใช้ถูก preview อย่างเดียว; งบฐานะไทยยังต้องยืนยันปี `ปี 1`/`ปี 2`.
> UI performance deploy `dpl_7uw9grWcMGmhkxHAQxEkp2ixPHQZ` แยก feature pages
> โหลดตามการเปิด และ entry JS 215.42 KB (65.57 KB gzip); Google Fonts โหลดแบบ
> asynchronous.
> ใช้ project link ที่อยู่ใน `.vercel/project.json` (ignored/local) สำหรับ deploy:
>
> ```bat
> npm.cmd exec --yes --package=vercel -- vercel deploy --prod --yes --scope lighttriad00-4894 --non-interactive
> ```
>
> ตั้งค่า `DATABASE_URL` ผ่าน Vercel project environment เท่านั้น; ห้ามใส่ secret
> ใน `VITE_*`, source, terminal arguments หรือ Git. เว็บเก่าอยู่คนละ Vercel team.

> **Previous override 2026-10-17 (superseded below):** ผู้ใช้ให้เน้น backend ก่อนเพราะ Claude ติด limit.
> Runtime f23c09e รวมเฉพาะ backend เข้า main; ไม่แก้ frontend-owned files.
> CORS Authorization, nullable Cost, imported funding/forecast context, constraints,
> scoped simulation list/read/replay และ provider transaction locking แก้แล้ว.
> ผลล่าสุด 545/3 DB, 426/122 no DB; 43 main paths, 27 tables, build1955/CSS
> index-DEindwiw.css/JS index-CBenrrOQ.js. Frontend/browser/hosting ยังไม่รวมเสร็จ;
> partial Cost ต้อง nullable guard โดย Claude. อ่าน SUNDAY_ACCEPTANCE.md และ
> CODEX_HANDOFF entry ล่าสุด; เนื้อหาถัดไปเก็บไว้เป็นประวัติของรอบก่อน.


อัปเดต 2026-10-16 · runtime source `48d9385` + validation regression repair ในรอบนี้ · config: `backend/Dockerfile`,
`backend/railway.json`, `backend/app/bootstrap.py` · ทีมยังต้องสร้าง host/service และตั้ง env.
รอบนี้ตรวจ local API/PostgreSQL/tests/frontend build ไม่ได้ build image หรือ deploy ใหม่.
ประวัติผล container/provider เดิมอยู่ใน Git/progress/LIVE_PROVIDER_VERIFICATION.md

## 1. เริ่มทดสอบในเครื่อง — cmd.exe

ที่ `D:\code-project\sme-finance-copilot`:

```bat
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
```

อีก terminal ที่ repo root:

```bat
set "VITE_USE_MOCK=false"
set "VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1"
pnpm exec vite --host localhost --port 5173 --strictPort
```

Backend config อยู่ `backend\.env`; แก้ env แล้ว restart server. ไม่ใช้ `VAR=x command`
ใน cmd.exe. frontend ใช้ `.env.local` ที่ repo root หรือ process env; สอง VITE variables
ข้างบนเป็น build-time config ต้อง restart/rebuild เมื่อเปลี่ยน. ไม่มี VITE_BACKEND_URL

Backend CORS defaults กับค่าใน .env อาจต่างกัน. local config ที่ตรวจใช้งานกับ
http://localhost:5173; อย่าสมมติว่า default Vite 3000 หรือ 127.0.0.1 เป็น origin เดียวกัน.
ให้เช็ก CORS_ORIGINS ให้ตรง URL ที่เปิดเว็บ. deployment frontend ไม่ได้รัน FastAPI ให้ด้วย

```bat
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/v1/order
curl http://127.0.0.1:8000/api/v1/shops
```

`/health` ตอบ ok/persistence=true อย่างเดียวไม่รับรองว่า DB พร้อม; bootstrap.error
และ DB-backed routes ต้องผ่านด้วย. รอบนี้ source database มี 27 tables; 16 GET contracts
ผ่าน HTTP. partial-data status เป็นผลจริง ไม่จำเป็นต้องเป็น ok ทุก view

โครงการ default เลือก ACTIVE_PROJECT_ORDER: start_date desc nulls last แล้ว
updated_at/created_at. อย่า reseed/reset ข้อมูลเพื่อแก้ selected project หรือให้เลขตรง mock.
ใช้ UUID ที่ API คืน; Shop Finance รับ order_ref เพื่อ pin โครงการได้

## 2. Host configuration ที่ทีมต้องทำ

ใช้ service root/build context เป็น `backend` เพราะ repo root เป็น Vite. Dockerfile
ติดตั้ง requirements.lock.txt, copy app/db/engines/parsers/examples/templates และใช้ user
ที่ไม่ใช่ root. command ใช้ PORT ของ host (default 8000); healthcheckPath คือ `/health`.
Railway config ปัจจุบันมี 1 replica; ยังไม่ได้เปลี่ยน scaling ในรอบนี้

| Backend variable | หน้าที่ |
| --- | --- |
| DATABASE_URL | URL PostgreSQL ของ host; normalise_database_url แปลง driver/SSL สำหรับ asyncpg |
| DB_BOOTSTRAP | schema เป็นค่าปกติ; schema+seed เฉพาะฐานสาธิตใหม่ที่ทีมตั้งใจใส่ข้อมูลสังเคราะห์; off ถ้าไม่ bootstrap |
| DB_POOL | queue สำหรับ service อยู่ยาวตาม deployment config |
| CORS_ORIGINS | frontend origins ที่ใช้งานจริง คั่น comma |
| OPENAI_API_KEY / OPENAI_MODEL | optional model mode; backend-only; rules ไม่ต้องใช้ |
| AUTH_SECRET | secret สำหรับ signed token อย่างน้อย 32 ตัวอักษร เมื่อจะใช้ login/auth |
| RBAC_ENFORCED | ปัจจุบัน false สำหรับ tester; ไม่เปิดก่อน identity/token/authorization integration พร้อม |
| AUTH_DEV_HEADER | false สำหรับ tester และ host ที่คนอื่นเข้าถึงได้ |

schema/seed เป็น idempotent ตาม tests แต่ไม่ใช่เหตุผลให้ reseed ฐานที่มีงานจริงทุก deploy.
Health bootstrap.applied/error ต้องตรวจหลังเริ่ม service และทดสอบ DB routes จริง.
schema+seed ใส่ชุดสังเคราะห์; อย่าเรียกสิ่งนั้นว่าข้อมูลลูกค้าจริง

Vercel frontend:

```env
VITE_API_BASE_URL=https://<backend-host>/api/v1
VITE_USE_MOCK=false
```

ทีมตั้งค่าสองตัวนี้แล้ว redeploy frontend. ห้ามใส่ database URL, OPENAI_API_KEY,
AUTH_SECRET หรือ credential ใด ๆ ใน VITE_* ซึ่งถูกฝังใน browser bundle.
ยังไม่มี backend host URL หรือผล deployment ใหม่ที่ยืนยันในรอบนี้

## 3. Auth integration ที่ยังต้องทำก่อนใช้งานใน browser

Backend มี login/me/logout/revoke-all/admin revoke; token HMAC-SHA256, password scrypt,
throttle และ revocation ใน DB. role มาจาก DB ตอนตรวจ ไม่ใช่ค่า role selector ของ AppHeader.
Frontend ยังไม่มี Authorization header และ auth flow จริง; route ที่มี principal dependency
ต้องใช้ token เมื่อ enforcement เปิด. การตั้ง enforcement ไม่ได้สร้าง actor/tenant scoping
ให้ทุก operation ที่ยังไม่มี dependency ขึ้นมาเอง

**พบ blocker จริงในรอบนี้:** middleware อนุญาต allow_headers=[Content-Type] เท่านั้น.
OPTIONS จาก localhost:5173 ขอ authorization,content-type ได้ HTTP400 Disallowed CORS headers.
ต้องแก้ CORS สำหรับ token transport พร้อม regression test ก่อนอ้างว่า browser auth พร้อม.
เอกสารรอบนี้บันทึก gap ไม่ได้แก้ behavior ของ middleware

Current /health: enforced=false, secretConfigured=false, devHeaderAccepted=false.
local admin มี password hash แล้ว แต่ยังไม่ยืนยัน login/admin revoke ผ่าน HTTP ด้วยบัญชีนี้.
ไม่แสดงหรือ commit credential. ตั้งรหัสแบบ interactive ได้ด้วย:

```bat
backend\.venv\Scripts\python.exe backend/scripts/set_password.py admin@example.test
```

ทดสอบ login ผ่าน `/docs` ในสภาพแวดล้อม tester แล้วตรวจ `/auth/me`/logout/revoke ตาม actor.
อย่าใส่ password ลง command argument/history หรือส่ง credentials ผ่านไฟล์ที่ Git ติดตาม.
สำหรับ login tests ตั้ง DEMO_LOGIN_PASSWORD ใน environment ของ terminal ที่ทดสอบเท่านั้น;
ไม่ตั้งค่านี้ในเอกสารหรือ commit. ถ้าไม่ตั้งจะ skip 2 เคสตามที่วัด

auth_throttle และ provider_fetch_state ใช้ DB จึงมีการประสานข้าม worker/replica แล้ว;
คำกล่าวเก่าว่าไม่มี cross-instance gate ไม่ใช่สถานะปัจจุบัน. ยังไม่มี refresh token;
token มีอายุสูงสุดตาม policy และยังเพิกถอนได้

## 4. เช็กก่อนส่ง frontend team / tester

```bat
if not exist node_modules\.cache mkdir node_modules\.cache
backend\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini -q --basetemp=node_modules/.cache/pytest-tester
backend\.venv\Scripts\python.exe backend/scripts/verify_tester_flow.py
node scripts/test-import-wiring.mjs
node scripts/test-page-wiring.mjs
pnpm build
```

Full DB **510 passed / 3 skipped**, ไม่มี DB **410 / 103**; 36 main paths, 27 tables,
16 GET contracts. Build **1955 modules**, CSS **index-DEindwiw.css**, JS **index-CBenrrOQ.js**.
Warning Starlette/httpx และ JS >500kB ยังอยู่. ผลนี้ตรวจ local ไม่ใช่ผลบน host.
ใช้ basetemp ใต้ node_modules/.cache เพราะ Vite watcher เคย crash เมื่อเฝ้า pytest temp
ที่ถูกล้างใน backend/uploads. Browser flows ที่ตรวจรอบก่อนแยกอยู่ใน tester guide

## 5. ผลข้อมูลและ operation ที่ต้องอธิบายกับ tester

- status insufficient_data คือ partial result: แสดงข้อมูลที่มีพร้อม missing; ไม่เดาศูนย์,
  ไม่ interpolate series และไม่ค้าง skeleton เมื่อ data=null/[] หรือ HTTP fail.
- source แยก supplied_input/stored_record/database/demo_dataset/none; DB seed ยังเป็น synthetic.
- import accepted snapshot ใช้เฉพาะ Overview/Health/Cost/AI ในแท็บ; reload กลับ DB/default.
  Funding/Cashflow/Shop Finance ยังต้องทำ shared context ไม่ใช่ input ใหม่อัตโนมัติทุกหน้า.
- SWARM เป็น preview; project 1,000/วัน 30 วัน ขาดรถ required สำหรับสองร้านอาหาร;
  ได้ 450 จาก packaging และขาด 550 โดยยังไม่มี business constraints ที่ยืนยัน suitability.
  ไม่ยืนยันรถ/พิกัด/วันรับเงินแทนทีม. อย่านำ Hero 300/วัน 6 ร้านมายืนยันผล DB.
- Simulator เป็น order-only cash/profit; save จริงแต่ saved-plan read/list/replay ยังไม่มี.
- สมัครทุน/ลงนาม/ขอเอกสาร/export/resource/Chaos บาง handler ยัง local/toast; ไม่อ้างเป็น
  business transaction สำเร็จ. ต้องมี API contract + actor + persistence/read-back หรือ unavailable.
- GET /forecast default project_obligations=true อาจ upsert projected events; ระบุ false
  ถ้าต้องการอ่าน events เดิมเท่านั้น. coverage ไม่ทราบไม่ใช่ forecast ที่ยืนยันครบ 90 วัน.
- ข่าวสดยังไม่ยืนยันสำเร็จ. หลังทีม deploy จึงตรวจ provider จาก host ผ่าน gate;
  ไม่ force/retry เพื่อให้ผ่าน. model mode มีหลักฐานเก่าใน LIVE_PROVIDER_VERIFICATION.md;
  รอบนี้ไม่เรียก paid LLM หรือข่าวสดซ้ำ

กติกาปัจจุบันและแผนส่งต่อ: [FRONTEND_INTEGRATION_HANDOFF.md](FRONTEND_INTEGRATION_HANDOFF.md).
Frontend wiring อนุญาตแล้วโดยคงดีไซน์; ทีม frontend รับงาน presentation หลัง backend/API
integration ผ่านเกณฑ์ ไม่ใช่หลังเปลี่ยนสีหรือสร้างหน้าใหม่
