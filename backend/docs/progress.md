# CLAUDE (Role 2) — บันทึกความคืบหน้า

ขอบเขตตาม `AI_DEVELOPMENT_GUIDELINES.md` บทบาทที่ 2: Database, API Architect
และการเชื่อม Frontend แบบไม่แตะ UI — Module 8 (Backend & DB Infrastructure)
และ Module 6 (What-If Simulator)

บันทึกเมื่อ 2026-10-14 (Asia/Bangkok) · โค้ดทั้งหมดอยู่ใน `D:\code-project\sme-finance-copilot`

---

## สรุปสถานะ

| ตัวชี้วัด | ค่า |
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
