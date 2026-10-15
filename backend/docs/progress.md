# CLAUDE (Role 2) — บันทึกความคืบหน้า

ขอบเขตตาม `AI_DEVELOPMENT_GUIDELINES.md` บทบาทที่ 2: Database, API Architect
และการเชื่อม Frontend แบบไม่แตะ UI — Module 8 (Backend & DB Infrastructure)
และ Module 6 (What-If Simulator)

บันทึกเมื่อ 2026-10-14 (Asia/Bangkok) · โค้ดทั้งหมดอยู่ใน `D:\code-project\sme-finance-copilot`


---

## 📌 สถานะปัจจุบัน

> 2026-10-15 · commit `5d583dd`

| ตัวชี้วัด | ค่า |
| --- | --- |
| Backend tests | **372 ผ่าน** (มี PostgreSQL + `DEMO_LOGIN_PASSWORD`) · 370 + 2 skip ถ้าไม่ตั้งรหัสเดโม · 323 + 49 skip ถ้าไม่มี DB |
| API routes | **31** เส้นทางใต้ `/api/*` เสิร์ฟคู่กับ `/api/v1/*` |
| ตารางฐานข้อมูล | **20** · `schema.sql` รันซ้ำได้ |
| Frontend contract | **16 / 16** ตอบ 200 (เดิม 404 ทั้งหมด) |
| Frontend bundle | ไม่เปลี่ยนเลย — `1955 modules`, hash `index-DEindwiw.css` / `index-DrkwTzbk.js` |
| Authentication | มีแล้ว (token HMAC + รหัสผ่าน scrypt) · **ปิด enforcement เป็นค่าเริ่มต้น** |
| Deploy | config ครบและทดสอบด้วย container จริง · รอกดสร้าง service บนบัญชีทีม |

**บันทึกเรียงจากใหม่ไปเก่า** — รอบล่าสุดอยู่ด้านบน

---

## รอบ 2026-10-15 (ช่วงบ่าย) — เตรียม deploy และ Authentication

### เตรียม Deploy ขึ้น Railway

| ไฟล์ | หน้าที่ |
| --- | --- |
| `backend/Dockerfile` | รัน unprivileged · ติดตั้งจาก lock file · copy `db/` เพราะ bootstrap ต้องอ่าน · bind `${PORT}` |
| `backend/railway.json` | health check `/health` · restart on failure · `numReplicas: 1` |
| `backend/.dockerignore` | กัน `.env`, venv, uploads, tests เข้า image |
| `backend/app/bootstrap.py` | apply `schema.sql` (+`seed.sql`) ตอน startup ใต้ advisory lock |
| `.vercelignore` | กัน backend ขึ้น Vercel |
| `backend/docs/DEPLOY.md` | คู่มือภาษาไทย |

**bootstrap:** Railway Postgres ไม่มี `docker-entrypoint-initdb.d` จึง apply schema
ตอน startup · ใช้ `pg_try_advisory_lock` แบบไม่บล็อก (instance ที่จับ lock ไม่ได้
ข้ามไป เพราะตัวที่จับอยู่ทำแล้ว) · `DB_BOOTSTRAP` = `off` / `schema` / `schema+seed` ·
**ล้มเหลวแล้วรายงานผ่าน `/health` ไม่ crash loop**

#### 🐛 2 บั๊กที่เจอเพราะ build container จริง ไม่ใช่เขียนไฟล์ทิ้งไว้

ถ้าไม่เจอก่อน การ deploy ครั้งแรกพังทั้งสองครั้ง

| บั๊ก | อาการ | การแก้ |
| --- | --- | --- |
| `DATABASE_URL` ของ Railway ใช้กับ async engine ไม่ได้ | Railway ให้ `postgresql://...` → SQLAlchemy map ไป driver แบบ sync → async engine ปฏิเสธ | `normalise_database_url()` pin เป็น `postgresql+asyncpg://` และย้าย `sslmode` ไปเป็น connect arg `ssl` ของ asyncpg (ซึ่งไม่รับเป็น query param) · **วางค่าที่ host ให้ได้ตรง ๆ** |
| `requirements.lock.txt` ขาด `greenlet` | container import SQLAlchemy asyncio ไม่ผ่านเลย · ในเครื่องไม่เจอเพราะ venv มีติดมาก่อน | pin ไว้ + test `test_every_runtime_import_is_pinned` กันหายอีก |

**ผลทดสอบจริง** รัน container บน network เดียวกับ Postgres ด้วย URL แบบ Railway:
bootstrap apply `schema.sql` + `seed.sql` สำเร็จ และ `/api/v1/overview`,
`/api/v1/shops`, `/api/v1/funding/options`, `/api/forecast` ตอบ 200 ทั้งหมด

### Authentication จริง

เดิม: เปิด `RBAC_ENFORCED` แล้วใครก็ตั้ง header `X-User-Email` อ้างเป็น role ไหนก็ได้
ไม่มีการพิสูจน์อะไร · ตอนนี้: token ที่ server เซ็นเอง ออกจาก `POST /api/auth/login`

| ไฟล์ | หน้าที่ |
| --- | --- |
| `app/security.py` | hash รหัสผ่าน (scrypt) + เซ็น/ตรวจ token (HMAC-SHA256) |
| `app/routers/auth.py` | `POST /api/auth/login` · `GET /api/auth/me` |
| `app/rbac.py` | เปลี่ยนมาตรวจ `Authorization: Bearer` |
| `scripts/set_password.py` | ตั้งรหัสผ่าน · **ไม่ seed credential ลง repo** |

**2 การตัดสินใจเชิงออกแบบ**

- **ไม่ใช้ JWT** — token เป็น `base64url(payload).base64url(hmac)` อัลกอริทึมเดียวตายตัว
  **ไม่มี header และไม่อ่าน field `alg` จาก input** → บั๊กตระกูล algorithm-confusion
  ของ JWT เกิดขึ้นไม่ได้ · เป็น HMAC-SHA256 ประกอบแบบเดียวกับ signer ของ Django
- **scrypt จาก stdlib** — memory-hard ต้าน GPU และ**ไม่ต้องเพิ่ม dependency** ·
  parameter ติดไปกับ hash แต่ละอัน จึงขึ้นความแข็งแรงภายหลังได้

**จุดสำคัญสุด: DB เป็นผู้ตัดสิน role ไม่ใช่ token**
token ที่อ้างว่าเป็น `admin` แต่ DB บอก `investor` → ได้ `investor` ·
ปิดบัญชีหรือเปลี่ยน role มีผลทันที ไม่ต้องรอ token หมดอายุ

**ผลทดสอบ (enforcement เปิด)**

| กรณี | ผล |
| --- | --- |
| ไม่ส่ง header | 401 |
| Bearer token ถูกต้อง | 200 · `role=investor` `method=token` |
| `X-User-Email` เดี่ยว ๆ (เดิมผ่านได้) | **401 — ช่องโหว่ปิดแล้ว** |
| payload ถูกแก้ / ตัดลายเซ็น / เซ็นด้วย secret อื่น | 401 ทั้งหมด |
| token อ้าง `admin` แต่ DB บอก `investor` | 200 · `role=investor` |

login ที่ล้มเหลวทุกแบบ (รหัสผิด / ไม่มีอีเมล / ยังไม่ตั้งรหัส) **ตอบข้อความเดียวกันหมด**
และ scrypt รันแม้ไม่พบผู้ใช้ เวลาตอบจึงไม่ต่างกัน · ไม่มี `AUTH_SECRET` =
ออก/รับ token ไม่ได้เลย และตอบ **503 ไม่ใช่ 401** เพื่อไม่ให้ config พลาด
ดูเหมือนผู้เรียกถูกปฏิเสธ

#### 🐛 บั๊กตัวเองอีก 2 จุด

| บั๊ก | การแก้ |
| --- | --- |
| `hashlib.scrypt` ชน OpenSSL maxmem (n=2^15 ต้องการ 32 MiB พอดี) | ลดเป็น n=2^14 (16 MiB, ~50ms) + ระบุ `maxmem` ชัดเจน เพื่อไม่ให้ container เล็กโดน OOM ตอน login พร้อมกัน · เพิ่มการปฏิเสธ record ที่ขอ memory เกินเพดาน |
| commit รหัสผ่านเดโมติดไปใน test file | ตรวจเจอตอน grep diff ก่อน push รอบสอง → ย้ายไปอ่านจาก `DEMO_LOGIN_PASSWORD` · ยืนยันแล้วไม่มีสตริงรหัสผ่านใน repo |

**test ที่แก้เพราะพฤติกรรมเปลี่ยน** `test_rbac.py` เดิมยืนยันว่า header resolve role ได้
ซึ่งคือพฤติกรรมที่กำลังถอดออก · เขียนใหม่ให้รัน 2 รอบ: เปิด hatch เพื่อตรวจ role mapping
และปิด hatch เพื่อพิสูจน์ว่า header เดี่ยว ๆ ถูกปฏิเสธ

### สถานะหลังรอบนี้

- **372 tests ผ่าน** (มี Postgres + `DEMO_LOGIN_PASSWORD`) · 370 + 2 skip ถ้าไม่ตั้งรหัส ·
  323 + 49 skip ถ้าไม่มี DB
- **31 routes** · 20 ตาราง · frontend bundle ไม่ขยับ

---

## รอบ 2026-10-15 — ต่อโมดูลของ Codex เข้าระบบ

Codex ส่ง 4 โมดูลมา (`6d2b9bc`..`311ef0d`) และไม่แตะไฟล์ฝั่งผมเลย ตรวจแล้ว diff ว่าง
ผมต่อเข้าระบบและแก้สิ่งที่พบ

### P0 สูตร SWARM — แก้แล้วและ reseed

สูตรใหม่ (`swarm-allocator/v2`, finite order) ให้เงินทุนหมุนเวียน = ต้นทุนผลิตจริง
ตรวจทวนด้วยมือ: `450×30×55 = 742,500` · `500×30×60 = 900,000` · `50×30×70 = 105,000`

| | v1 (เดิม) | v2 (ใหม่) |
| --- | --- | --- |
| Sahai WC / gap | 1,485,000 / 315,000 | **742,500 / 0** |
| Baan Suan WC / gap | 1,800,000 / 0 | **900,000 / 0** |
| Rung Charoen WC / gap | 210,000 / 150,000 | **105,000 / 45,000** |
| ส่วนขาดรวม | 465,000 | **45,000** |

`seed.sql` อัปเดตจาก `SWARM_RESEED_VALUES.json` แล้ว · ยืนยันว่าค่าที่เก็บตรงกับการคำนวณสด

### ที่ต่อเพิ่ม

| สิ่งที่ทำ | รายละเอียด |
| --- | --- |
| `POST /api/match-funding` | เรียก `match_funding` + `match_investors` คืนหนี้และทุนแยกกัน บันทึกลง `funding_matches` / `investor_matches` แบบแทนที่ไม่ต่อท้าย |
| `/api/v1/funding/options` | เปลี่ยนมาใช้ matcher แทนเกณฑ์ของผมเอง เอาโค้ด PMT ซ้ำออก |
| `GET /api/forecast` | เปิด `forecast_cashflow` · ตรงกับค่าที่ Codex ระบุ: ต่ำสุด 3,370,000 วันที่ 2026-10-25 · 30/60/90 = 3,370,000 / 3,370,000 / 5,770,000 |
| `GET /api/industry/trends` | เปิด `fetch_industry_trends` + ตาราง `industry_news` เป็น cache (upsert ด้วย id ของ fetcher) |
| input ใหม่ของ swarm | ส่งต่อ `production_start`, `collection_schedule`, `required_business_types`, `buyer_coordinates`, `max_distance_km`, `business_type`, `coordinates` |
| schema | เพิ่ม `latitude`/`longitude`/`business_type` ใน `sme_profiles` + ตาราง `industry_news` → **20 ตาราง** |
| ข้อมูลเดโม | งบการเงินที่ validate แล้ว 2 ชุด: Baan Suan **เกรด A (88.37)** · Rung Charoen **เกรด D (34.61)** |

### บั๊กที่เจอและแก้รอบนี้

| บั๊ก | อาการ | การแก้ |
| --- | --- | --- |
| `totalRepayment` ผิดความหมาย | ผมเอา `period_installments` (จำนวนงวดใน**งวดบัญชี** ที่ matcher ใช้ stress test DSCR) ไปคูณ ทำให้ยอดรวมเท่าค่างวดเดือนเดียว | ใช้ `term_months` (อายุสัญญา) ทั้งใน adapter และตอนบันทึก DB |
| เงินให้เปล่าถูกคิดดอกเบี้ย | adapter เดิมผมคิดเงินให้เปล่าเป็นสินเชื่อ 0% ผ่อน 38,750/เดือน | ใช้ค่างวด 0 จาก matcher ตามที่ Codex เตือน |
| งบ `simulated` ถูกใช้แทน `actual` | `load_recent_records` เรียงตามความใหม่ ทำให้ what-if ที่เขียนทีหลังกลายเป็นฐานของการให้เกรดและจับคู่ทุน (Baan Suan ได้ B แทน A) | เรียงตาม kind ก่อน: `actual` > `forecast` > `simulated` |
| "งวดก่อนหน้า" เป็นงวดเดียวกัน | มีงบงวดเดียวกันหลายแถว ทำให้ diff เป็น 0 โดยไม่ประกาศ `previous_period_statement` ซึ่งหลอกตากว่าบอกว่าข้อมูลขาด | dedupe ตามงวด เก็บแถวที่ใหม่สุดต่อหนึ่งงวด |
| duplicate shop id ตกเป็น 500 | validator ของ engine ทำงานหลัง `SwarmBody` ผ่านแล้ว | ดัก `ValidationError` ใน route แปลงเป็น 422 |
| investor key ไม่ตรง | `Investor` model ของ matcher ใช้ `id` ไม่ใช่ `investor_id` (ซึ่งเป็น key ของ**ผลลัพธ์**) | แก้ loader ให้ส่ง `id` |

### test ที่แก้เพราะพฤติกรรมเปลี่ยน (ไม่ใช่เพราะ test เสีย)

3 ตัวใน `test_catalog_contracts.py` ยืนยันพฤติกรรมก่อนมี matcher: เงินให้เปล่าถูก amortise,
ข้อความเหตุผลของผมเอง, และ `matchScore` เป็น 0 เสมอพร้อมประกาศ `funding_match_score`
ตอนนี้ทั้งสามเป็นจริงไม่ได้แล้วเพราะคะแนนมาจาก matcher จริง จึงเขียนใหม่ให้ยืนยันพฤติกรรมใหม่

### สถานะหลังรอบนี้

- **330 tests ผ่าน** (มี Postgres) · **286 ผ่าน + 44 skip** (ไม่มี DB)
- 20 ตาราง · frontend bundle ไม่ขยับ (`1955 modules`, hash เดิม) · 16/16 contract ยังตอบ 200
- GDELT timeout ในเครื่องนี้ → endpoint คืน `unavailable` + `missing: ["industry_news"]`
  ไม่มีข่าวปลอม ซึ่งเป็น path ที่ออกแบบไว้

### ยังค้าง

| งาน | ติดอะไร |
| --- | --- |
| Deploy backend + ปลด frontend จาก mock | ต้องใช้ credential ของทีม (`VITE_API_BASE_URL` + `VITE_USE_MOCK=false`) |
| Auth จริง | `X-User-Email` ไม่ใช่เส้นแบ่งความปลอดภัย — **ทำแล้วในรอบช่วงบ่าย** |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | ยังไม่ได้ตั้ง → `aiMode` คืน `"rules"` ตลอด |
| พิกัดร้านจริง | คอลัมน์พร้อมแล้วแต่ยังไม่มีข้อมูล ตัวกรองระยะทางจึงยังตัดร้านที่ไม่มีพิกัดออกเมื่อบังคับรัศมี |

---

## สรุปสถานะ ณ 2026-10-14 (ค่าตั้งต้น ไม่ใช่สถานะปัจจุบัน)

> สถานะปัจจุบันอยู่ที่ตารางบนสุดของไฟล์นี้

| ตัวชี้วัด | ค่า ณ วันนั้น |
| --- | --- |
| Backend tests | **225 ผ่าน** (มี PostgreSQL) · **194 ผ่าน + 31 skip** (ไม่มี DB) |
| ตารางฐานข้อมูล | 19 ตาราง · `schema.sql` เป็น idempotent ทั้งไฟล์ |
| Frontend contract ที่ตอบได้ | **16 / 16** (เดิม 404 ทั้งหมด) |
| Frontend bundle | ไม่เปลี่ยน — `1955 modules`, hash `index-DEindwiw.css` / `index-DrkwTzbk.js` |

---

## Module 8 — Database

`db/schema.sql` เป็นแหล่งความจริง `app/models.py` เป็น ORM ที่สะท้อนมัน
ตรวจแล้วว่าทุกคอลัมน์ใน ORM มีอยู่จริงใน DB (mismatch = 0) และรันไฟล์ซ้ำได้โดยไม่ error

| ตาราง | เก็บอะไร |
| --- | --- |
| `sme_profiles` | ตัวตน SME กำลังผลิต ต้นทุนต่อหน่วย สถานะเงินสด |
| `financial_records` | `FinancialInput` ที่ผ่าน validation ต่อหนึ่งงวด พร้อมผลคำนวณ |
| `upload_events` | ชื่อไฟล์ ขนาด SHA-256 เท่านั้น — **ไม่เก็บตัวไฟล์** |
| `swarm_projects` | ออเดอร์ผู้ซื้อ เป้ากำลังผลิต ราคา ระยะเวลา เครดิตเทอม |
| `swarm_allocations` | ส่วนแบ่งต่อร้าน เงินทุนหมุนเวียน ส่วนขาด และ cost lines ย่อย |
| `funding_products` / `funding_matches` | ผลิตภัณฑ์สินเชื่อและผลการจับคู่ |
| `investor_profiles` / `investor_matches` | นักลงทุนที่ลงเงินตรง แยกจากผลิตภัณฑ์สินเชื่อ |
| `users` | ผู้ใช้ + `role` เป็นหลักยึด RBAC |
| `simulations` | พารามิเตอร์และผล What-If |
| `ai_analyses` | cache คำตอบ LLM ด้วย `(scope, input_sha256)` ลดค่า API |
| `cash_events` | ความเคลื่อนไหวเงินสดแบบระบุวันที่ |
| `sales_products` / `sales_channels` | ยอดขายรายสินค้าและรายช่องทาง |
| `shared_resources` | ทรัพยากรที่ร้านแบ่งกันใช้ (SME UNLOCK) |
| `chaos_scenarios` | ฉากทัศน์วิกฤตสำหรับ simulator |
| `project_deliveries` / `project_evidence` | ตารางส่งมอบและเอกสารประกอบ |

`users` มี constraint บังคับว่า `sme_owner` ต้องผูก `sme_id` และ `investor` ต้องผูก `investor_id`
จึงไม่มีแถว role ที่ไม่มีความหมาย

**ข้อมูลเดโม** `db/seed.sql` สร้างร้าน 2 แบบตาม checklist ของ Codex: Baan Suan (สุขภาพดี
เงินสดเหนือเงินสำรองมาก ไม่มีส่วนขาด) และ Rung Charoen (วิกฤต เงินสดเหนือเงินสำรองแค่ 30,000 บาท
สถานะ `blocked`) ทุกแถวใช้ UUID คงที่ จึง**รันซ้ำได้โดยข้อมูลไม่ซ้ำ** — จุดนี้พลาดครั้งแรก
(`ON CONFLICT DO NOTHING` ไม่มี unique constraint ให้ชน) ตรวจเจอตอนรัน seed สองรอบแล้วแถวเพิ่มเป็นเท่าตัว

---

## Module 8 — API Endpoints

| Method | Endpoint | หมายเหตุ |
| --- | --- | --- |
| POST | `/api/upload` | เรียก parser ของ Codex คืน metrics + unit economics + เกรด A-D บันทึก record และ upload event · ไฟล์ที่ parse ไม่ผ่านก็บันทึกเป็น `rejected` พร้อมเหตุผล |
| POST | `/api/calculate` | รัน engine แล้วบันทึก `financial_records` |
| POST | `/api/calculate/excel` | เหมือนกัน แต่รับ workbook |
| POST | `/api/swarm` | จัดสรรออเดอร์ข้ามร้าน คิดเงินทุนหมุนเวียนและส่วนขาดต่อร้าน |
| GET | `/api/swarm/{order_ref}` | อ่านข้อเสนอที่บันทึกไว้ |
| POST | `/api/simulate` | Module 6 เทียบ Plan A / Plan B |

ทุก route เสิร์ฟทั้ง `/api/*` และ `/api/v1/*` เพราะ client ที่ deploy แล้วยิงไปที่ `/api/v1`

Persistence เป็น opt-in: ไม่มี `DATABASE_URL` ทุก endpoint ยังตอบปกติ แค่ไม่เขียน DB
(`"persisted": false`) เส้นทางคำนวณไม่เคยขึ้นกับฐานข้อมูล

---

## Module 6 — What-If Simulator

`POST /api/simulate` เทียบ Plan A (ฐาน) กับ Plan B (ฉากทัศน์)

**ตัวแปรที่ปรับได้** รายได้: `revenue_change_pct`, `units_sold_change_pct`, `unit_price_change_pct` ·
ต้นทุน: `cost_change_pct` (เหมารวม) กับตัวเจาะจง `cogs/operating_expenses/fixed_costs/variable_cost_change_pct`
ซึ่ง**ชนะตัวเหมารวมในฟิลด์ของตัวเอง** · เงินสด: `collection_delay_days`, `extra_funding` ·
หนี้: `loan`, `drop_loan` · ทีม: `remove_shops`, `add_shops`

**สมมติฐานที่ engine ใช้ ส่งกลับใน `assumptions` ทุกครั้ง ไม่มีการปรับค่าแบบเงียบ ๆ:**

- กำไรถูกคำนวณใหม่จากบรรทัด P&L ที่ scale แล้ว `net_income` ขยับตามส่วนต่าง
- ส่วนต่างกำไรถือเป็นเงินสดในงวดเดียวกัน จึงขยับ `operating_cash_flow`,
  `cash_available_for_debt_service` และ `cash_balance` ด้วย — **ถ้าไม่ทำข้อนี้ DSCR จะไม่ขยับเลย
  และ DSCR คิดเป็น 35% ของเกรด ทำให้ simulator ไร้ประโยชน์**
- `extra_funding` ถือเป็นการกู้ จึงเพิ่ม `assets` และ `liabilities` พร้อมกัน สมการบัญชียังสมดุล
- เงินสดติดลบถูกตรึงที่ 0 แล้วบอกส่วนที่ขาดไว้ใน `notes`

ผลลัพธ์มี `delta.summary.verdict` = `better` / `worse` / `mixed` / `unchanged`
โดยตัวชี้วัดที่ "ยิ่งต่ำยิ่งดี" (`funding_gap`, `total_cost`, `cost_per_unit`, `breakeven_units`,
`debt_ratio`, `pmt`) ถูกตีความกลับทาง

ถ้าฉากทัศน์ดันงบออกนอกสัญญา input จะได้ 422 พร้อมชื่อฟิลด์ **ไม่ส่งตัวเลขการเงินกลับไปใน error**

---

## เชื่อม Frontend — 16 / 16 contract

`src/api/client.ts` ยิง 16 เส้นทางใต้ `/api/v1` ซึ่ง**เดิม 404 ทั้งหมด** ทำให้ปลดจาก mock mode ไม่ได้เลย
ตอนนี้ตอบ 200 ครบ

| Endpoint | สร้างจาก |
| --- | --- |
| `/overview` | metrics + business metrics + `findings` |
| `/health/indicators` | `build_analysis().indicators` (ตรง type `HealthIndicator` อยู่แล้ว) |
| `/ai/explain?page=` | `build_analysis().explanation` (ตรง type `AIResponse`) |
| `/cost/breakdown` | business metrics + บรรทัดต้นทุนใน input |
| `/swarm/proposal` | โครงการที่อัปเดตล่าสุด + allocations |
| `/shops` | `sme_profiles` + allocation ล่าสุดของแต่ละร้าน |
| `/order` | `swarm_projects` ล่าสุด |
| `/shops/{id}/finance` | allocation + cost lines + `cash_events` (รับ `?order_ref=` เพื่อกำหนดโครงการแน่นอน) |
| `/cashflow/timeline` | `cash_events` คิดยอดสะสมจากเงินสดต้นงวด |
| `/funding/options` | `funding_products` + PMT จาก engine เดิม + เกณฑ์วงเงิน/DSCR |
| `/sales/products` · `/sales/channels` | ตารางยอดขาย |
| `/unlock/resources` | `shared_resources` |
| `/simulator/chaos` | `chaos_scenarios` |
| `/projects` | `swarm_projects` + `project_deliveries` |
| `/funder/projects` | `swarm_projects` + `project_evidence` + ผลรวมส่วนขาด |

**ลำดับลงทะเบียน router มีผล:** `frontend_router` และ `catalog_router` ต้องมาก่อน `swarm_router`
ไม่งั้น `/swarm/{order_ref}` จะจับคำว่า `proposal` เป็นเลขออเดอร์แล้วตอบ 404 — มี test คุมไว้

### กฎที่ยึดตลอด: ไม่สร้างตัวเลขขึ้นมาเอง

ชุดข้อมูลที่ input contract ไม่มี จะส่งค่าว่างและประกาศชื่อไว้ใน `missing` แล้วปล่อยให้ UI
แสดงสถานะ insufficient-data ของตัวเอง ดีกว่าโชว์เลขที่ดูดีแต่อธิบายไม่ได้

- `weeklyTrend: []` + `weekly_cash_movements` — input ไม่มีความเคลื่อนไหวรายวัน
- `trend: []` ทุก indicator + `indicator_history` — มีงบงวดเดียว
- `investmentPlans: []` + `investment_cash_schedule` — NPV/IRR/payback ต้องมีตารางกระแสเงินสดลงทุน
- `lastPeriodDiff` เป็น 0 + `previous_period_statement` เมื่อไม่มีงบงวดก่อน
- `matchScore: 0` + `funding_match_score` — การจัดอันดับเป็น Module 4 ของ Codex
- `postMortem` ถูกละไว้ + `project_post_mortem` — ยังไม่มีต้นทุนจริงและวันจ่ายจริง
- `/cashflow/timeline` ออกแถวเฉพาะวันที่มี event จริง ไม่เติมวันว่างระหว่างกลาง เพราะจะเป็นการสมมติรูปของเส้น

`status` ผูกกับ `missing` ตรง ๆ: ถ้า `missing` ไม่ว่าง `status` จะเป็น `insufficient_data` เสมอ
ไม่มีกรณีอ้าง `ok` ทั้งที่ข้อมูลขาด

ทุก response มีฟิลด์ `source` (`stored_record` / `demo_dataset` / `none`) เพื่อไม่ให้เลขเดโม
ถูกเข้าใจผิดว่าเป็นเลขจริง · `/ai/explain` ส่ง `aiMode` (`rules` / `model`) เพื่อไม่ให้ UI
ทำเหมือนเรียกโมเดลไปแล้วทั้งที่ rule ตอบ

### `src/services/api.ts` — ไฟล์ frontend เดียวที่เพิ่ม

ไม่ import component ไม่แตะ CSS/Tailwind/layout และ**ไม่มีใคร import มัน** Vite จึง tree-shake
ออกทั้งหมด พิสูจน์ด้วย build ก่อน/หลัง: module count `1955` เท่าเดิม hash เท่าเดิมทุกตัว

`src/api/client.ts` ของเดิมไม่ถูกแก้แม้บรรทัดเดียว

ฟังก์ชัน `health`, `uploadStatement`, `calculate`, `analyze`, `buildSwarm`, `getSwarm`, `simulate` ·
hooks `useBackend` (ยกเลิก request เก่าเมื่อ deps เปลี่ยนหรือ unmount), `useBackendHealth`,
`useBackendAction` · base URL ตั้งผ่าน `VITE_BACKEND_URL`

---

## RBAC

`app/rbac.py` มี role model และจุดตัดสินใจ `Principal.may()`, `.owns_sme()`, `funder_access()`

**สิ่งที่ยังไม่ใช่: authentication** ตัวตนผู้เรียกมาจาก header `X-User-Email` ซึ่งใครก็ตั้งได้
ไม่มีหลักฐานยืนยัน ใช้เป็นสวิตช์ role สำหรับเดโมและการต่อ UI เท่านั้น **ห้ามใช้เป็นเส้นแบ่งความปลอดภัย**
ก่อนแตะข้อมูลการเงินจริงต้องมี credential จริง (token ที่เซ็นแล้วตรวจกับ secret หรือ session
หลังตรวจรหัสผ่าน) และจุดนั้นควรอยู่ในโมดูลนี้

> **หมายเหตุ (อัปเดต 2026-10-15 ช่วงบ่าย):** ทำแล้วตามที่ย่อหน้าข้างบนระบุไว้ —
> token เซ็นด้วย HMAC-SHA256 ตรวจกับ `AUTH_SECRET` และรหัสผ่าน hash ด้วย scrypt ·
> `X-User-Email` ไม่ถือเป็นตัวตนอีกแล้ว (เหลือเป็น escape hatch สำหรับ dev เท่านั้น
> ซึ่งปิดเป็นค่าเริ่มต้นและรายงานผ่าน `/health`) · ดูหัวข้อรอบช่วงบ่ายด้านบน

เปิดด้วย `RBAC_ENFORCED=true` **ค่าเริ่มต้นคือปิด** เพราะ frontend ที่ deploy แล้วเรียกโดยไม่ส่ง header
ถ้าเปิดทันทีจะเด้ง UI ที่ใช้งานได้อยู่

ทดสอบทั้งสองโหมดแล้ว (โหมดเปิดรันใน subprocess เพราะ flag อ่านตอน import):

| กรณี | ผล |
| --- | --- |
| ปิด enforcement ไม่ส่ง header | 200 + `rbacEnforced: false` + `missing: ["rbac_not_enforced"]` |
| เปิด enforcement ไม่ส่ง header | **401** |
| เปิด enforcement อีเมลไม่รู้จัก | **403** (คำตอบเดียวกับบัญชีที่ปิดใช้งาน จึงไม่ยืนยันว่าอีเมลไหนมีอยู่) |
| เปิด enforcement บัญชี investor | 200 · `hasAccessPermission: true` |
| เปิด enforcement บัญชี sme_owner | 200 · `hasAccessPermission: false` |

`/funder/projects` เอา role จาก principal ที่ resolve แล้วเท่านั้น **ไม่ใช่จาก query param ที่ผู้เรียกเลือกเอง**
และส่ง `rbacEnforced` กลับด้วย เพื่อให้ UI แยก "อนุญาต" ออกจาก "ยังไม่ได้ตรวจ" ได้

---

## บั๊กที่เจอและแก้ไปวันนี้

| บั๊ก | อาการ | สาเหตุและการแก้ |
| --- | --- | --- |
| asyncpg pool ข้าม event loop | request ที่ 2 พัง `Event loop is closed` | connection ผูกกับ loop ที่เปิดมัน เปลี่ยน default เป็น `NullPool`, เปิด pool จริงด้วย `DB_POOL=queue` |
| `date`/`Decimal` ลง JSONB | `TypeError: Object of type date is not JSON serializable` | ใช้ `model_dump(mode="json")` + `date.fromisoformat()` สำหรับคอลัมน์ DATE |
| route ชน | `/swarm/proposal` ตอบ 404 | `/swarm/{order_ref}` จับ `proposal` เป็น order_ref — ลงทะเบียน literal path ก่อน |
| seed ไม่ idempotent | รันซ้ำแล้วแถวเพิ่มเป็นเท่าตัว | `ON CONFLICT DO NOTHING` ไม่มี unique constraint ให้ชน ใส่ UUID คงที่ + `ON CONFLICT (id)` |
| seed ไม่ self-contained | โครงการเดโมไม่มี allocation เลย cost lines เป็น 0 | seed สร้าง allocations เองพร้อม cost lines ที่ผูกกับ `cost_per_unit` ของแต่ละร้าน |
| `/swarm/proposal` กำไร 0 | `totalCost`/`totalProfit` เป็น 0 ทั้งที่มีข้อมูล | คำนวณจาก `sme_profiles.cost_per_unit` · ถ้าร้านใดไม่มีค่านี้คืน 0 พร้อม `missing` ไม่นับครึ่ง ๆ |
| response shape ไม่คงที่ | `/funder/projects` คืนฟิลด์ต่างกันเมื่อมี/ไม่มี DB | ให้ `rbacEnforced` และ `role` อยู่ครบทั้งสองโหมด UI อ่าน shape เดียว |
| `distinct(expr)` deprecated | SADeprecationWarning | เลี่ยง DISTINCT ON ไปคัดใน Python ให้ query พอร์ตได้ |
| `VAR=x cmd` ใน cmd.exe | `'DATABASE_URL' is not recognized` | เป็น syntax ของ bash ย้ายค่าไป `backend/.env` + เพิ่ม `run.cmd` |
| port 8000 ไม่คืน | `WinError 10048` แม้ฆ่า process แล้ว | uvicorn `--reload` ทิ้ง worker ที่สืบทอด socket ไว้ ต้องฆ่าทั้ง tree (`/T`) · `run.cmd` ตรวจและบอก PID ให้แล้ว |

---

## ⚠️ P0 ของ Codex ที่กระทบตัวเลขของผม

`DEMO_READINESS.md` ชี้สูตรใน `app/swarm.py`:

```
working_capital = share/day × cost/unit × (duration_days + payment_terms_days)
```

**ผมคำนวณทวนแล้วและเห็นด้วยว่าสูตรนี้เกินจริง** ตัวอย่างของ Codex: 40 ชิ้น/วัน × 10 วันผลิต ×
70 บาท เครดิต 30 วัน → ต้นทุนผลิตทั้งออเดอร์ 28,000 บาท แต่สูตรให้ 112,000 บาท คือ **4 เท่า**

เงินสดไหลออก 28,000 กระจายใน 10 วัน เงินเข้าหลังส่งมอบ 30 วัน **peak cumulative deficit = 28,000**
สูตรนี้ถูกเฉพาะกรณีธุรกิจผลิตต่อเนื่องไม่หยุด (steady state ค้างของ duration+terms วัน)
ไม่ใช่ออเดอร์ที่จบเป็นชิ้น

กระทบ: `funding_gap` ที่เกินจริงไหลเข้า `/funding/options`, `investor_matches` และหน้า funder ทั้งหมด
**ต้องแก้ก่อนเอาตัวเลขไปเสนอใคร**

ตามแบ่งบทบาท Module 5 เป็นของ Codex แต่ไฟล์เป็นของผม เสนอให้ **Codex แก้โมเดล cash exposure**
(เป็นสมมติฐานธุรกิจ) **ผมดูแล route / contract / persistence** · test ชุดเดิมยืนยันแค่ว่าโค้ดตรงกับสูตรเดิม
ไม่ได้ยืนยันว่าสมมติฐานถูก ต้องเขียนใหม่ตาม acceptance ที่เขาระบุ

แถวใน `seed.sql` ใช้ค่าที่ engine คำนวณ ณ ตอนนี้ เพื่อให้ข้อมูลที่เก็บกับการคำนวณสดตรงกัน
**เมื่อแก้สูตรแล้วต้อง reseed**

---

## งานที่เหลือของ Role 2

| งาน | สถานะ |
| --- | --- |
| `/api/match-funding` | route เป็นของผม แต่ **algorithm เป็น Module 4 ของ Codex** · `swarm.py` ชี้ `actionTarget` ไปที่ endpoint นี้อยู่แล้วทั้งที่ยังไม่มี · `/funding/options` ทำเกณฑ์วงเงิน/DSCR ไว้แล้ว เหลือส่วนให้คะแนนและเหตุผลความเสี่ยง |
| Deploy backend | **ยังไม่ทำ** ต้องใช้บัญชี/credential ของทีม · เว็บบน Vercel ยังไม่มี backend ให้คุย ต้อง host แล้วตั้ง `VITE_BACKEND_URL` และ `VITE_USE_MOCK=false` |
| Auth จริง | RBAC มี role model แล้ว แต่ยังไม่มี credential ที่ตรวจได้ (ดูหัวข้อ RBAC) |
| `/cashflow/timeline` 30/60/90 วัน | ตอนนี้สร้างจาก `cash_events` ที่มีอยู่ · การพยากรณ์ล่วงหน้าเป็น Module 3 ของ Codex |

### เรื่องที่ควรรู้ก่อนเดโม

1. **`actionableItems` เป็นภาษาอังกฤษ** เพราะ text มาจาก `findings` ของ Codex ตรง ๆ ขณะที่ UI เป็นไทย
   การแปลเป็นงาน Module 3 ไม่ใช่สิ่งที่ผมควรแต่งเอง
2. **"โครงการล่าสุด" คือสิ่งที่ถูกเขียนล่าสุด** รวมถึง order ที่ test สร้าง (`PO-PERSIST-TEST`, `PO-LIVE-001`)
   ตอนเดโมให้ส่ง `?order_ref=PO-STP-2026-091` หรือรัน order จริงเป็นตัวสุดท้าย
3. **เว็บจริงกับ repo ไม่ตรงกัน** bundle บน Vercel ใหญ่กว่าที่ repo build ได้ (JS +48.6 kB, CSS +21.6 kB)
   และ UI นั้นไม่มีอยู่ใน git ยังไม่ได้แก้ รอการตัดสินใจของทีม

---

## คำสั่งที่ใช้บ่อย

```powershell
docker compose -f backend/docker-compose.yml up -d
docker exec -i sme_swarm_db psql -U postgres -d sme_swarm -v ON_ERROR_STOP=1 < backend/db/schema.sql
docker exec -i sme_swarm_db psql -U postgres -d sme_swarm -v ON_ERROR_STOP=1 < backend/db/seed.sql
backend\run.cmd
& backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini -q
```

API docs: `http://127.0.0.1:8000/docs`
