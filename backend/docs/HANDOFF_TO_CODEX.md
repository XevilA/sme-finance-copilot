# ส่งงานต่อให้ CODEX — สิ่งที่พร้อมแล้วและสิ่งที่รอคุณ

> Current handoff 2026-10-16: [FRONTEND_INTEGRATION_HANDOFF.md](FRONTEND_INTEGRATION_HANDOFF.md).
> เอกสารนี้เป็นประวัติ; lane split/ข้อห้าม frontend ด้านล่างถูกแทนด้วยสิทธิ์ wiring ล่าสุดโดยคง UI เดิม

> ## ✅ เอกสารนี้เสร็จสิ้นภารกิจแล้ว (2026-10-15)
>
> CODEX ทำครบทั้ง 4 โมดูลที่ขอไว้: Module 4 (จับคู่แหล่งทุน), Module 3
> (พยากรณ์ 30/60/90 วัน), Module 7 (แนวโน้มอุตสาหกรรม) และแก้ P0 สูตร SWARM
> และ CLAUDE ต่อเข้าระบบเรียบร้อย
>
> **เก็บไว้เป็นบันทึกว่าตอนนั้นขออะไรไปและด้วยเหตุผลใด** · ข้อความด้านล่าง
> เป็นสถานะ ณ commit `99c2aab` จึงบอกว่าหลายโมดูล "ยังไม่มีโค้ดเลย" ซึ่งไม่จริงแล้ว
>
> **สถานะปัจจุบันอยู่ที่:** `AI_DEVELOPMENT_GUIDELINES.md` (ภาพรวม) ·
> `CODEX_HANDOFF.md` (สิ่งที่ CODEX ส่งมอบ) · `progress.md` (งานฝั่ง CLAUDE)

จาก CLAUDE (บทบาทที่ 2: Database, API Architect, Frontend Integration)
ตรวจกับ commit `99c2aab` เมื่อ 2026-10-15 (Asia/Bangkok)

เอกสารนี้บอกว่า **โครงสร้างฝั่งผมพร้อมแค่ไหน** และ **คุณต้องเติมอะไรตรงไหน**
ขอบเขตตาม `AI_DEVELOPMENT_GUIDELINES.md` — ผมไม่แตะ Module 1-5, 7 และไม่แตะ frontend

เอกสารประกอบ: `progress.md` (งานฝั่งผม) · `DEMO_READINESS.md` (audit ของคุณ) ·
`../../docs/API_CONTRACT_MATRIX.md` (ข้อตกลง Envelope กับทีม frontend)

---

## สรุปใน 30 วินาที

| สิ่งที่พร้อมให้ต่อได้เลย | สิ่งที่รอคุณ |
| --- | --- |
| 19 ตาราง + ข้อมูลเดโม (ร้านสุขภาพดี / ร้านวิกฤต) | **Module 4** จับคู่แหล่งทุน — ยังไม่มีโค้ดเลย |
| 16/16 frontend contract ตอบ 200 แล้ว | **Module 3** พยากรณ์ 30/60/90 วัน |
| `/api/funding/options` กรองเกณฑ์ + คำนวณ PMT แล้ว เหลือใส่คะแนน | **Module 5** แก้สูตร working capital + เกณฑ์ระยะทาง/ประเภทธุรกิจ |
| `cash_events` เก็บกระแสเงินสดแบบระบุวันที่ | **Module 7** เทรนด์อุตสาหกรรม — ยังไม่มีโค้ดเลย |
| 225 tests ผ่าน (มี DB) / 194 ผ่าน + 31 skip (ไม่มี DB) | ต่อ LLM จริง (ยังไม่ได้ตั้ง key) |

**ลำดับที่แนะนำ: P0 (แก้สูตร) → Module 4 → Module 3 → Module 7**
เพราะ Module 4 กินตัวเลข `funding_gap` จาก Module 5 โดยตรง ถ้าไม่แก้สูตรก่อน
การจับคู่แหล่งทุนจะอ้างวงเงินที่เกินจริงประมาณ 4 เท่า

---

## 🔴 P0 — แก้สูตร working capital ก่อนทำ Module 4

คุณชี้ไว้ใน `DEMO_READINESS.md` **ผมคำนวณทวนแล้วและเห็นด้วยทุกข้อ** สูตรนี้เป็นของผมเอง

`app/swarm.py` บรรทัด 93 ปัจจุบัน:

```python
working_capital = share * shop.cost_per_unit * cash_cycle_days
# cash_cycle_days = duration_days + payment_terms_days
```

ตัวอย่างของคุณ: 40 ชิ้น/วัน × 10 วันผลิต × 70 บาท เครดิต 30 วัน

| | ค่า |
| --- | --- |
| ต้นทุนผลิตทั้งออเดอร์จริง | 40 × 10 × 70 = **28,000** |
| สูตรปัจจุบันให้ | 40 × 70 × (10+30) = **112,000** |
| เกินจริง | **4 เท่า** |

เหตุผล: เงินสดไหลออก 28,000 กระจายใน 10 วัน เงินเข้าหลังส่งมอบ 30 วัน
**peak cumulative deficit = 28,000** สูตรนี้ถูกเฉพาะกรณีธุรกิจผลิตต่อเนื่องไม่หยุด
(steady state ค้างของ duration+terms วัน) ไม่ใช่ออเดอร์ที่จบเป็นชิ้น

**สิ่งที่ต้องตัดสินใจก่อนเขียนโค้ด:** โปรดักต์เราคือออเดอร์จบชิ้น หรือธุรกิจผลิตต่อเนื่อง
ถ้าเป็นออเดอร์จบชิ้น ให้คิดเป็นตารางวันที่แล้วหา peak cumulative deficit ตามที่คุณเสนอ

**คำเตือน 2 ข้อ:**

1. `tests/test_swarm.py` ของผมยืนยันแค่ว่าโค้ดตรงกับสูตรเดิม **ไม่ได้ยืนยันว่าสมมติฐานธุรกิจถูก**
   ตัวที่ต้องแก้: `test_working_capital_and_funding_gap_math`, `test_deposit_closes_the_funding_gap`
2. `db/seed.sql` เก็บค่า `working_capital_needed` และ `funding_gap` ที่ engine คำนวณ ณ ตอนนี้
   เพื่อให้ข้อมูลที่เก็บกับการคำนวณสดตรงกัน **แก้สูตรแล้วต้อง reseed**:

```powershell
docker compose -f backend/docker-compose.yml down -v
docker compose -f backend/docker-compose.yml up -d
```

ตัวเลขที่ต้องอัปเดตใน `seed.sql` อยู่ใน block `INSERT INTO swarm_allocations`
(UUID `b1000000-0000-4000-8000-00000000000{1,2,3}`)

### ยังขาดในโมดูลนี้

- จับคู่ตาม **ประเภทธุรกิจ** และ **ระยะทาง** — `grep "distance|latitude|radius|sector"` ใน `swarm.py` = 0
  ถ้าต้องการพิกัดร้าน บอกผม ผมเพิ่มคอลัมน์ให้ (`sme_profiles` มี `location`, `province` แล้วแต่เป็น text)
- validation: ร้านซ้ำใน request, `capacity_used > capacity_total`
- `swarm.py` ชี้ `actionTarget: "/api/match-funding"` อยู่แล้วทั้งที่ endpoint ยังไม่มี

---

## 🟢 Module 4 — จับคู่แหล่งทุน (ยังไม่มีโค้ดเลย)

### ของที่พร้อมให้คุณใช้

**ตาราง `funding_products`** — มีข้อมูลเดโม 4 รายการ (Bank A term loan, Fintech B PO financing,
Fintech C invoice factoring, Government grant)

```
id, name, provider,
type            -- term_loan | invoice_financing | po_financing | grant | revolving
min_amount, max_amount          NUMERIC(20,2)
interest_rate_annual            NUMERIC(12,10)  -- เศษส่วน: 0.0725 = 7.25%
term_months, disbursement_days  INTEGER
min_dscr                        NUMERIC(12,4)   -- NULL = ไม่กำหนด
required_docs, eligibility      JSONB (array ของ string)
active                          BOOLEAN
```

**ตาราง `investor_profiles`** — มีข้อมูลเดโม 3 ราย (VC, angel, ภาครัฐ)

```
id, name, type, province,
ticket_min, ticket_max,
target_sectors   JSONB   -- ["food_processing","packaging"]
risk_appetite            -- low | medium | high
min_grade        CHAR(1) -- A | B | C | D
min_dscr, horizon_months
```

**ตารางปลายทางสำหรับเขียนผล** — สร้างไว้แล้ว รอคุณเติม `match_score` กับ `match_reason`

```
funding_matches   (sme_id, product_id, project_id, requested_amount,
                   monthly_payment, total_repayment,
                   match_score SMALLINT 0-100, match_reason TEXT,
                   status: eligible | requires_info | not_eligible)

investor_matches  (investor_id, sme_id, project_id, requested_amount,
                   sme_grade CHAR(1), match_score, match_reason, status)
                   -- UNIQUE (investor_id, sme_id, project_id)
```

**`GET /api/v1/funding/options` ทำไปแล้วบางส่วน** (`app/adapters_catalog.py` → `funding_options()`)

ทำแล้ว: กรองช่วงวงเงิน, กรอง `min_dscr` เทียบ DSCR จริงของ SME, คำนวณ `monthlyPayment` และ
`totalRepayment` ผ่าน PMT engine เดิม (ทดสอบแล้วว่าผลิตภัณฑ์ดอกเบี้ย 0% ผ่อนครบเท่าเงินต้นพอดี),
ประกอบข้อความ `impactOnCash`

**ยังไม่ทำ — ของคุณ:** `matchScore` คืน `0` และประกาศ `funding_match_score` ใน `missing`
เพราะการจัดอันดับเป็นการตัดสินใจเชิงธุรกิจ ผมไม่เดาแทน

### สิ่งที่ต้องทำ

1. ฟังก์ชันให้คะแนนจับคู่ — ข้อเสนอ: `backend/app/matching.py`

   ```python
   def match_funding(data: FinancialInput, grade: dict, requested_amount: Decimal,
                     products: list[dict]) -> list[dict]:
       """คืน match_score 0-100 + match_reason + status ต่อผลิตภัณฑ์"""
   ```

   รับ `products` เป็น list ของ dict จาก `app/catalog.py → load_funding_products()`
   (อย่า query DB ในชั้น logic ผมจะส่งแถวให้)

2. จับคู่นักลงทุนแยกจากสินเชื่อ — เปรียบเทียบหนี้กับทุนคนละเกณฑ์ ตามที่คุณเขียนใน `DEMO_READINESS.md`
3. **คำนวณ DSCR ใหม่หลังรับสินเชื่อ** — ค่างวดใหม่ต้องเข้า `debt_principal_due` + `debt_interest_due`
   แล้วเช็กว่า DSCR ยังผ่านเกณฑ์ไหม (ใช้งวดบัญชีเดียวกัน)
4. เหตุผลที่ปฏิเสธ ต้องระบุได้ว่าตกเกณฑ์ข้อไหน
5. **ห้ามให้ผลลัพธ์อ่านเหมือนการอนุมัติสินเชื่อ** — ใช้ถ้อยคำแบบ `grading.py` ที่มี `notice` กำกับ

### ผมจะทำต่อเมื่อคุณเสร็จ

สร้าง `POST /api/match-funding` ที่เรียก `match_funding()` แล้วบันทึกลง `funding_matches` /
`investor_matches` และเสียบคะแนนเข้า `/api/v1/funding/options` แทนค่า 0
**บอกผมแค่ signature กับรูป dict ที่คืน** ผมต่อให้ภายในรอบเดียว

---

## 🟢 Module 3 — พยากรณ์กระแสเงินสด 30/60/90 วัน

`app/analysis.py` บรรทัด 138 เขียนไว้เองว่า

> "No dated future cash schedule: a 30-90 day forecast is not produced in this milestone."

### ของที่พร้อมให้คุณใช้

**ตาราง `cash_events`** — ความเคลื่อนไหวเงินสดแบบระบุวันที่ มีข้อมูลเดโม 7 แถว
(มัดจำเข้า → ซื้อวัตถุดิบ 2 ล็อต → ค่าแรง → ค่างวดสินเชื่อ → ส่งมอบ → รับเงินงวดท้าย)

```
sme_id, project_id, event_date DATE, day_index INTEGER,
type       -- buy_materials | produce | deliver | receive_payment | pay_obligations
title, amount NUMERIC(20,2), is_inflow BOOLEAN,
partner, status: confirmed | projected | simulated, impact_reason
```

**`GET /api/v1/cashflow/timeline`** คิดยอดสะสมจากเงินสดต้นงวดแล้ว คืน `projectedCash`,
`reserveLine`, `inflow`, `outflow`, `netChange`, `isDeficit`, `deficitAmount` ต่อวันที่มี event

ตรวจกับมือแล้ว: เริ่ม 5,000,000 → +600k −900k −450k −850k −30k → +2,400k = **5,770,000** ✓

**ข้อจำกัดที่ประกาศไว้:** route ออกแถวเฉพาะวันที่มี event จริง ไม่เติมวันว่างระหว่างกลาง
เพราะการกระจายยอดรวมของงวดลงรายวันคือการสมมติรูปของเส้นกราฟที่ข้อมูลไม่รองรับ

### สิ่งที่ต้องทำ

สร้างแถว `cash_events` ล่วงหน้าจากลูกหนี้/เจ้าหนี้/ค่าใช้จ่ายดำเนินงาน/ค่างวด พร้อม `status="projected"`
แล้วคืน: **เงินสดต่ำสุด**, **วันแรกที่ขาดมือ**, **ยอดคงเหลือปลายงวด 30/60/90** และสมมติฐานที่ใช้

**ข้อสำคัญ: ตารางที่ไม่มีข้อมูล ต้องไม่กลายเป็น 0** ให้ประกาศใน `missing` ตามแนวที่ทำกันอยู่

ถ้าต้องการคอลัมน์เพิ่ม (เช่น ตารางลูกหนี้/เจ้าหนี้แยกใบ) บอกผม ผมเพิ่ม schema ให้

---

## 🟢 Module 7 — เทรนด์อุตสาหกรรม (ยังไม่มีโค้ดเลย)

ยังไม่มีตารางรองรับ **บอกผมว่าต้องการเก็บอะไร** แล้วผมสร้างให้ — ข้อเสนอเริ่มต้น:

```
industry_news (id, source, url, title, published_at, sector, fetched_at,
               summary, sentiment, raw JSONB)
```

สิ่งที่ guideline ขอ: ดึงข่าวผ่าน API → วิเคราะห์โอกาส/ความเสี่ยง
ข้อกำหนดจาก `DEMO_READINESS.md` ของคุณเอง: เก็บวันที่และลิงก์ต้นทาง, ตัดข่าวซ้ำ,
และต้องมีสถานะ stale/unavailable **ห้ามแต่งหัวข้อข่าวขึ้นมาเอง**

---

## 🟡 LLM ยังไม่ได้ต่อจริง

`app/ai_provider.py → apply_model_priorities()` มีอยู่แล้ว แต่

- `OPENAI_API_KEY` และ `OPENAI_MODEL` **ไม่ได้ตั้งใน `backend/.env`** → `aiMode` คืน `"rules"` ตลอด
- ฟังก์ชันนี้แค่**จัดลำดับ finding ที่มีอยู่** ยังไม่ได้สร้างคำวิเคราะห์ใหม่
- พฤติกรรม provider จริง (timeout, JSON เสีย, credential ผิด) ยังไม่เคยทดสอบกับของจริง

ตั้ง key ใน `backend/.env` (ไฟล์อยู่ใน `.gitignore` แล้ว ไม่ขึ้น git):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=...
```

**ให้คงโหมด rules ไว้เสมอเมื่อ provider ล่ม** และเปิดเผยผ่าน `aiMode` / `aiWarning` ตามที่ทำอยู่
ตัวเลขและเกรดต้อง deterministic ไม่ขึ้นกับโมเดล

---

## สัญญาที่อย่าทำให้พัง

ผมต่อ frontend ไว้กับ output ของคุณตรง ๆ 2 จุด ถ้ารูปเปลี่ยน UI จะพังเงียบ ๆ

| ฟังก์ชันของคุณ | ผมใช้ทำอะไร |
| --- | --- |
| `build_analysis(data)["data"]["indicators"]` | `GET /api/v1/health/indicators` — ตรงกับ type `HealthIndicator` ของ UI อยู่แล้ว |
| `build_analysis(data)["data"]["explanation"]` | `GET /api/v1/ai/explain` — ตรงกับ type `AIResponse` |
| `build_analysis(data)["data"]["findings"]` | `actionableItems` ใน `GET /api/v1/overview` |
| `calculate_financials(data)["data"]` | `/api/calculate`, `/api/upload`, `/api/simulate`, `/api/v1/overview` |
| `calculate_business_metrics(data)` | `/api/v1/cost/breakdown`, `/api/v1/overview` |
| `grade_financials(data)` | เกรดใน `/api/calculate`, `/api/upload`, เทียบ Plan A/B ใน `/api/simulate` |
| `parse_excel(content, filename)` | `/api/upload` |
| `app/swarm.py → allocate(SwarmRequest)` | `/api/swarm`, `/api/simulate` |

**ถ้าจะเปลี่ยนรูป output บอกผมก่อน** ผมแก้ adapter ให้ในรอบเดียว — อย่าแก้ไฟล์ใน
`app/adapters*.py`, `app/routers/`, `app/catalog.py`, `app/repository.py`, `app/models.py`,
`db/schema.sql` หรือ `src/` เพราะเป็นของฝั่งผมและจะชนกัน

---

## วิธีรันและตรวจงาน

```powershell
# ฐานข้อมูล (ไม่ต้องติดตั้ง psql)
docker compose -f backend/docker-compose.yml up -d

# เซิร์ฟเวอร์ — อ่านค่าจาก backend\.env ไม่ต้องตั้ง env var เอง
backend\run.cmd

# เทสต์
& backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini -q
```

API docs: `http://127.0.0.1:8000/docs`

**เกณฑ์ที่ต้องผ่านก่อนบอกว่าเสร็จ** — 225 tests ต้องยังผ่านทั้งหมด (ถ้าแก้สูตร P0
ให้แก้ test ที่ยืนยันสูตรเดิมด้วย และบอกในคอมมิตว่าแก้เพราะสมมติฐานเปลี่ยน ไม่ใช่เพราะ test เสีย)

ข้อมูลเดโม UUID คงที่ ใช้อ้างในเทสต์ได้:

```
Baan Suan Kitchen   11111111-1111-4111-8111-111111111111   สุขภาพดี เงินสด 5,000,000 ไม่มีส่วนขาด
Rung Charoen Foods  22222222-2222-4222-8222-222222222222   วิกฤต เงินสดเหนือเงินสำรอง 30,000 สถานะ blocked
Sahai Packing Co    33333333-3333-4333-8333-333333333333   ต้นทุน/หน่วยต่ำสุด
ออเดอร์เดโม          PO-STP-2026-091
```

⚠️ `/api/v1/order`, `/projects`, `/swarm/proposal` เลือก "โครงการล่าสุด" ซึ่งคือสิ่งที่ถูกเขียนล่าสุด
**รวมถึงออเดอร์ที่เทสต์สร้าง** (`PO-PERSIST-TEST`, `PO-LIVE-001`) ตอนเดโมให้ส่ง
`?order_ref=PO-STP-2026-091` หรือรันออเดอร์จริงเป็นตัวสุดท้าย

---

## งานที่ค้างฝั่งผม (ไม่บล็อกคุณ)

| งาน | ติดอะไร |
| --- | --- |
| `POST /api/match-funding` | รอ Module 4 ของคุณ |
| Deploy backend + ปลด frontend จาก mock | ต้องใช้ credential ของทีม (ตัวแปรคือ `VITE_API_BASE_URL` + `VITE_USE_MOCK=false`) |
| Auth จริง | RBAC มี role model แล้ว แต่ `X-User-Email` ไม่ใช่เส้นแบ่งความปลอดภัย |

## เรื่องที่ทีมต้องตัดสินใจ (ไม่ใช่งานโค้ดของใคร)

1. **สูตร working capital** — ออเดอร์จบชิ้น หรือธุรกิจผลิตต่อเนื่อง (ดู P0 ด้านบน)
2. **`actionableItems` เป็นภาษาอังกฤษบน UI ไทย** — text มาจาก `findings` ของคุณตรง ๆ
   ผมไม่แปลเองเพราะจะกลายเป็นการแต่งข้อความวิเคราะห์
3. **เว็บจริงกับ repo ไม่ตรงกัน** — bundle บน Vercel ใหญ่กว่าที่ repo build ได้
   (JS +48.6 kB, CSS +21.6 kB) และ UI นั้นไม่มีอยู่ใน git
