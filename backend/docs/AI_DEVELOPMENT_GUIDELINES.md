# SME SWARM: Finance Copilot - ข้อตกลงและแนวทางการพัฒนาสำหรับ AI

## ⚠️ 1. กฎเหล็กขั้นเด็ดขาด (เพื่อประหยัด Token และป้องกันระบบพัง)
- **ห้ามแก้ไข FRONTEND เด็ดขาด:** หน้าเว็บ (UI) เสร็จสมบูรณ์แล้ว 100% **ห้าม** แก้ไข React components, CSS, Tailwind classes หรือโครงสร้างหน้าเว็บใดๆ ทั้งสิ้น[cite: 1]
- **การประหยัด TOKEN (Speed Mode):** เราอยู่ในช่วง Hackathon 48 ชั่วโมง ให้สร้างเฉพาะโค้ดที่พร้อมใช้งานจริงบน Production เท่านั้น ห้ามพิมพ์ข้อความเกริ่นนำ ห้ามอธิบายยืดเยื้อ และห้ามพิมพ์คำขอโทษ[cite: 1]
- **ตำแหน่งไฟล์และ Git:** โค้ดทั้งหมดต้องอยู่ใน `D:\code-project\sme-finance-copilot`[cite: 1] เมื่อเขียนโค้ดชุดใหญ่เสร็จ ต้องให้คำสั่ง Terminal สำหรับ Push โค้ดไปยัง `https://github.com/XevilA/sme-finance-copilot` branch main เสมอ[cite: 1]
- **กลยุทธ์ AI:** ไม่ต้องเทรน ML โมเดลใหม่ ให้ใช้สูตรคณิตศาสตร์, Rule-based systems และต่อ API ของ LLM ภายนอก (ผ่าน Prompt Engineering) เพื่อวิเคราะห์ข้อมูลและตอบกลับเป็น JSON[cite: 1]
- **ลำดับการทำงานของระบบ (Pipeline):** Read Data → Calculate → AI Analyze → Match Funding → Simulate → Return JSON to Web[cite: 1]

---

## 🤖 2. การแบ่งหน้าที่: ใครทำอะไร (ROLE DELEGATION)

เพื่อป้องกันการทำงานซ้อนทับกัน (Conflict) และอาการ AI หลอน งานจะถูกแบ่งอย่างเด็ดขาด ให้อ่านบทบาทของคุณด้านล่างและทำเฉพาะงานที่ได้รับมอบหมายเท่านั้น

### 🟢 บทบาทที่ 1: CODEX (ดูแล Core Logic, ระบบคำนวณคณิตศาสตร์ & AI Algorithms)
**ภารกิจของคุณ:** สร้างระบบตรรกะคำนวณทางคณิตศาสตร์, ระบบตรวจสอบข้อมูล และเขียน Prompt Algorithms สำหรับ AI ในฝั่ง Backend[cite: 1]
**โมดูลที่รับผิดชอบ:**
- **Module 1 (Data Validation):** เขียนระบบอ่านข้อมูลจากไฟล์ Excel บัญชีและฟอร์มกรอกข้อมูล พร้อมตรวจสอบความถูกต้องของสมการบัญชี (Assets = Liabilities + Equity)[cite: 1]
- **Module 2 (Math Engine):** คำนวณกำไรสุทธิ, กระแสเงินสด, สัดส่วนการเงิน (ROA, ROE, Liquidity), ต้นทุน, จุดคุ้มทุน, ROI, Funding Gap, DSCR และ PMT พร้อมสร้างระบบจัดเกรดธุรกิจ (A-D) ด้วยสูตร: `G = 0.35(DSCR) + 0.30(Cash flow) + 0.20(Debt burden) + 0.15(Cash reserve)`[cite: 1]
- **Module 3 (AI Business Analyst):** เขียน Prompt logic และเชื่อมต่อ LLM API เพื่อวิเคราะห์สุขภาพการเงิน, จุดแข็ง, จุดอ่อน, สาเหตุเงินสดขาดมือ และคาดการณ์กระแสเงินสดล่วงหน้า 30-90 วัน[cite: 1]
- **Module 4 (AI Funding Matcher):** สร้างอัลกอริทึมประเมินความต้องการเงินทุนของ SME และจับคู่กับนักลงทุนหรือสินเชื่อที่เหมาะสมตามเกรดและความเสี่ยง[cite: 1]
- **Module 5 (SME SWARM Logic):** เขียนอัลกอริทึมหลักเพื่อแตกออเดอร์งานขนาดใหญ่ แล้วจับคู่ทีมร้านค้า SME ตามประเภทธุรกิจ กำลังผลิต และระยะทาง พร้อมคำนวณต้นทุน กำไร และเงินทุนเฉพาะกิจ (Micro-funding) ของ "แต่ละร้านค้า"[cite: 1]
- **Module 7 (AI Industry Trends):** เขียนระบบดึงข้อมูลข่าวสาร SME อุตสาหกรรมผ่าน API และวิเคราะห์โอกาส/ความเสี่ยง[cite: 1]

### 🔵 บทบาทที่ 2: CLAUDE (ดูแล Database, API Architect & การเชื่อมต่อ Frontend)
**ภารกิจของคุณ:** สร้างโครงสร้างเซิร์ฟเวอร์, ออกแบบ Database schema, ทำ RESTful API routing และเชื่อมต่อ Frontend เข้ากับระบบตรรกะของ Codex อย่างปลอดภัยโดยไม่ทำให้ UI พัง[cite: 1]
**โมดูลที่รับผิดชอบ:**
- **Module 8 (Backend & DB Infrastructure):** 
  - ออกแบบ Database schema สำหรับเก็บข้อมูล Users, SME Profiles, Investors, Projects และ Analysis Results พร้อมทำระบบ Role-Based Access Control (RBAC)[cite: 1]
  - สร้างเซิร์ฟเวอร์ Express.js / FastAPI และทำ RESTful API endpoints สำหรับทุกโมดูล (เช่น `/api/upload`, `/api/calculate`, `/api/swarm`)[cite: 1]
- **Module 6 (What-If Simulator):** สร้าง Endpoint `/api/simulate` โดยผูกลอจิกให้รับตัวแปรที่เปลี่ยนไป (เช่น ยอดขาย, ต้นทุน, การเพิ่ม/ลดร้านค้า) แล้วส่งไปกระตุ้นให้ระบบของ Codex คำนวณ Module 2-5 ใหม่แบบเรียลไทม์ เพื่อเปรียบเทียบแผน A/B[cite: 1]
- **Frontend Integration (แบบไม่กระทบ UI):** เขียนโค้ด `fetch` หรือ `axios` ภายใน State management ของหน้าเว็บเพื่อดึง API **กฎเหล็ก:** ส่งต่อข้อมูลผ่าน hooks/props เท่านั้น ห้ามแก้ไขดีไซน์และสไตล์ของ UI เด็ดขาด[cite: 1]

---

## 📊 3. สถานะงาน

> อัปเดต 2026-10-15 (commit `f54ec8f`+) · **419 tests ผ่าน + 3 skip** (มี PostgreSQL) ·
> **34 API routes** · **27 ตารางฐานข้อมูล** · frontend ไม่ถูกแตะ (`1955 modules`, asset hash เดิม)

### 🚀 นักพัฒนาใหม่เริ่มที่นี่

```bash
docker compose -f backend/docker-compose.yml up -d   # ฐานข้อมูล + schema + ข้อมูลเดโม
backend\run.cmd                                      # เซิร์ฟเวอร์ที่ 127.0.0.1:8000
```

เปิด `http://127.0.0.1:8000/docs` แล้วลองยิง API ได้เลย · UUID เดโมคงที่:

| ร้าน | UUID | เกรด |
| --- | --- | --- |
| Baan Suan Kitchen (สุขภาพดี) | `11111111-1111-4111-8111-111111111111` | A (88.37) |
| Rung Charoen Foods (วิกฤต) | `22222222-2222-4222-8222-222222222222` | D (34.61) |
| Sahai Packing Co | `33333333-3333-4333-8333-333333333333` | — |
| ออเดอร์เดโม | `PO-STP-2026-091` | — |

```bash
python -m pytest -c backend/pytest.ini -q    # 419 ผ่าน + 3 skip (ยังไม่ตั้ง DEMO_LOGIN_PASSWORD 2 + เคสเฉพาะตอนไม่มี DB 1)
```

**เอกสารอ่านตามลำดับนี้:** ไฟล์นี้ (ภาพรวม) → `progress.md` (งานฝั่ง CLAUDE) →
`CODEX_HANDOFF.md` (งานฝั่ง CODEX) → `DEPLOY.md` (ขึ้น production) ·
เฉพาะเรื่อง: `FINANCIAL_ENGINE.md`, `ANALYSIS_CONTRACT.md`, `LIVE_PROVIDER_VERIFICATION.md`

### ✅ Pipeline หลัก — ครบทุกขั้น

`Read Data → Calculate → AI Analyze → Match Funding → Simulate → Return JSON to Web`

| ขั้น | Endpoint |
| --- | --- |
| Read Data | `POST /api/upload` |
| Calculate | `POST /api/calculate` |
| AI Analyze | `POST /api/analyze` |
| Match Funding | `POST /api/match-funding` |
| Simulate | `POST /api/simulate` |
| Return JSON | `/api/v1/*` 16 contract ที่ frontend เรียก |
| เพิ่มเติม | `GET /api/forecast` · `GET /api/industry/trends` · `POST /api/auth/login` |

### ✅ CODEX (บทบาทที่ 1)

| Module | ไฟล์ | หมายเหตุ |
| --- | --- | --- |
| 1 · ตรวจข้อมูล Excel | `parsers/excel_parser.py`, `statement_parser.py` | ตรวจสมการบัญชี Assets = Liabilities + Equity |
| 2 · Math Engine + เกรด A-D | `engines/financial_engine.py`, `grading.py` | `G = 0.35(DSCR) + 0.30(Cash flow) + 0.20(Debt burden) + 0.15(Cash reserve)` |
| 3 · วิเคราะห์ + พยากรณ์ 30/60/90 วัน | `analysis.py`, `forecasting.py` | ข้อความวิเคราะห์เป็นภาษาไทยแล้ว (ID และโครงสร้างคงเดิม) |
| 4 · จับคู่แหล่งทุนและนักลงทุน | `matching.py` | คะแนน 0-100 + ตรวจ DSCR หลังรับทุน · แยกหนี้กับทุน |
| 5 · SWARM | `swarm.py` v2 | ออเดอร์จบชิ้น + เกณฑ์ประเภทธุรกิจและระยะทาง |
| 7 · แนวโน้มอุตสาหกรรม | `industry.py` | GDELT + สถานะ stale/unavailable |
| ต่อ LLM จริง | `ai_provider.py` | ตรวจ Structured Outputs จริงแล้ว · โมเดลและผลอยู่ใน `LIVE_PROVIDER_VERIFICATION.md` |

### ✅ CLAUDE (บทบาทที่ 2)

| Module | สถานะ | หมายเหตุ |
| --- | --- | --- |
| 8 · Database schema | ✅ | 27 ตาราง ครอบคลุม Users, SME Profiles, Investors, Projects, Analysis Results · `schema.sql` และ seed ทั้งสองไฟล์รันซ้ำได้ |
| 8 · RESTful API | ✅ | 34 routes · เสิร์ฟทั้ง `/api/*` และ `/api/v1/*` |
| 8 · RBAC + Authentication | ✅ | token HMAC-SHA256 + รหัสผ่าน scrypt · DB เป็นผู้ตัดสิน role ไม่ใช่ token · ปิด enforcement เป็นค่าเริ่มต้น |
| 8 · เพิกถอน token | ✅ | `revoked_tokens` เพิกถอนรายเซสชัน · `users.tokens_valid_from` เพิกถอนทั้งบัญชี · `POST /api/auth/logout`, `/auth/revoke-all`, `/auth/revoke` (admin) |
| 6 · What-If Simulator | ✅ | `POST /api/simulate` · 11 levers · เทียบ Plan A/B |
| Frontend Integration | ✅ โค้ด / ⏳ รอ deploy | 16/16 contract ตอบ 200 + `src/services/api.ts` · เว็บยังเป็น mock จนกว่า backend จะขึ้น host |
| เตรียม Deploy | ✅ | `Dockerfile`, `railway.json`, bootstrap schema ตอน startup · ทดสอบด้วยการรัน container จริงแล้ว |
| ตารางภาระแบบระบุวันที่ | ✅ | `receivables`, `payables`, `expense_transactions`, `allocation_resources` · ต่อ `project_cash_events()` ของ CODEX เข้า `/api/forecast` แล้ว |
| จำกัดอัตราคำขอ | ✅ | `provider_fetch_state` ล็อกข้าม worker + backoff · `auth_throttle` จำกัด login ข้าม replica |

---

## 🔜 4. งานที่เหลือ

เรียงตามผลกระทบ · แต่ละข้อบอกชัดว่า **ใครทำ** และ **ขั้นถัดไปคืออะไร**

### 🔴 บล็อกการเดโมเว็บจริง

**1. Deploy backend ขึ้น Railway** — เจ้าของ: **ทีม** (ต้องใช้บัญชี)

- โค้ดและ config พร้อมและทดสอบแล้ว: build image สำเร็จ และรัน container
  เทียบ PostgreSQL จริงผ่าน ทุก endpoint ตอบ 200
- **ขั้นถัดไป:** ทำตาม `DEPLOY.md` ข้อ 1-4 (สร้าง service → ตั้ง Root Directory
  เป็น `backend` → เพิ่ม PostgreSQL → ตั้ง env)

**2. ปลด frontend จากโหมด mock** — เจ้าของ: **ทีม** · ติดข้อ 1

- **ขั้นถัดไป:** หลัง deploy เสร็จ ตั้งบน Vercel 2 ตัว
  (`VITE_API_BASE_URL`, `VITE_USE_MOCK=false`) แล้ว redeploy · `DEPLOY.md` ข้อ 5

### 🟡 ทำได้แต่ยังไม่จำเป็นต่อการเดโม

**3. เทียบประวัติค่าใช้จ่าย + finding "ค่าใช้จ่ายผิดปกติ"** — เจ้าของ: **CODEX**

- ข้อมูลรออยู่แล้ว: ตาราง `expense_transactions` (16 แถว) และ loader
  `obligations.py::load_expense_history` มีเทสต์ครบ
- `analysis.py:139` ยังประกาศเป็นช่องว่างอยู่
  (`"No expense transaction history or comparable prior period..."`)
- เคสทดสอบที่ seed ไว้: วัตถุดิบของ Rung Charoen เดือน ต.ค. **168,000**
  เทียบค่าเฉลี่ยสามเดือนของตัวเอง **99,166.67** (96,000 / 102,000 / 99,500) = **+69.4%**
- **ขั้นถัดไป:** CODEX ใช้ประวัติใน `analysis.py` → แล้ว CLAUDE ส่งต่อเข้า route

**4. resource eligibility ใน SWARM allocator** — เจ้าของ: **CODEX**

- ข้อมูลรออยู่แล้ว: ตาราง `allocation_resources` (5 แถว) และ loader
  `obligations.py::load_shop_resources` · `available` ตามสถานะทรัพยากร เพราะ
  ทรัพยากรที่แค่ "ถูกเสนอ" ยังไม่ถือว่าได้มา ซึ่งคือเหตุที่ทรัพยากรแบบ required
  เป็นข้อจำกัดจริง · ร้านที่ไม่มีการบันทึกการพึ่งพาถูกตัดออกจาก dict
  ไม่ใช่คืน list ว่าง เพื่อให้ "ไม่ได้บันทึก" ต่างจาก "ไม่ต้องใช้อะไร"
- `swarm.py::ShopCapacity` มี `business_type` และ `coordinates` แล้ว
  แต่**ยังไม่มีฟิลด์ resources** และ `shop_eligibility()` ยังไม่มีเกณฑ์นี้
- **ขั้นถัดไป:** CODEX เพิ่มฟิลด์ลง `ShopCapacity` + เกณฑ์ใน `shop_eligibility()`
  → แล้ว CLAUDE ส่งต่อผ่าน route แบบเดียวกับที่ `business_type`/`coordinates` ทำอยู่

> ⚠️ loader ทั้งสองตัวของข้อ 3 และ 4 **ยังไม่มี caller** มีแต่เทสต์ ·
> ข้อมูลจึงยังไม่ไปถึง API จนกว่า CODEX จะส่งฝั่งตัวเองมาและ CLAUDE ต่อ route ให้ ·
> อย่าอ่านว่า "เสร็จแล้ว" เพราะเห็นว่ามีตารางและมีฟังก์ชัน

**5. ดึงข่าวอุตสาหกรรมจริงได้สำเร็จ** — เจ้าของ: **CODEX + ทีมดูแลโฮสต์**

- เส้นทาง unavailable ทำงานถูกต้อง แต่ยังไม่เคยดึงข่าวสดได้สำเร็จ
- อาการ: DNS และ TCP ต่อได้ แต่ **HTTPS TLS handshake หมดเวลารอ** ·
  ทดสอบแยกผ่าน HTTP ได้ 429 · ลดความซับซ้อนของคำค้นแล้วไม่ช่วย
- gate สำหรับ backoff มีแล้ว (`fetch_state.py`) ที่เหลือเป็นเรื่องเครือข่าย
- **ขั้นถัดไป:** ลองยิงจากโฮสต์ที่ deploy (egress ต่างกัน อาจผ่าน) ·
  รายละเอียดใน `LIVE_PROVIDER_VERIFICATION.md`

**6. พิกัดร้านค้าจริง** — เจ้าของ: **ทีม** (ต้องใช้ข้อมูลธุรกิจ)

- คอลัมน์ `latitude`/`longitude` ใน `sme_profiles` พร้อมแล้วแต่ยังว่างทั้ง 3 ร้าน
- ตัวกรองระยะทางจึงตัดร้านที่ไม่มีพิกัดออกเมื่อบังคับรัศมี **โดยเจตนา**
  (ไม่เดาพิกัดจากชื่อจังหวัด)
- `business_type` ก็ว่างทั้ง 3 ร้านเหมือนกัน แต่**ไม่ใช่ปัญหา**:
  `repository.py:154` fallback ไป `sector` ซึ่งเป็น NOT NULL
- **ขั้นถัดไป:** เติมพิกัดจริงลง `sme_profiles`

### 🟠 ต้องทำก่อนเปิดใช้กับข้อมูลจริง

ยังไม่จำเป็นต่อเดโม แต่**อย่าข้าม**ถ้าจะใช้กับข้อมูลลูกค้าจริง

- **เพิกถอน token ได้แล้ว** (`token_revocation.py`) · ยังคง clamp อายุไว้ 7 วัน
  **โดยเจตนา** เพราะการเพิกถอนต้องมีคนสังเกตและสั่ง แต่การหมดอายุไม่ต้อง —
  เป็นสองชั้น ไม่ใช่ทางเลือกแทนกัน
  - `POST /api/auth/logout` เพิกถอนเฉพาะ token ที่ใช้เรียก
  - `POST /api/auth/revoke-all` เพิกถอนทุก token ของบัญชีตัวเอง (กรณี token ถูกขโมย)
  - `POST /api/auth/revoke` `{email}` เพิกถอนทุก token ของบัญชีอื่น · **admin เท่านั้น**
  - ทั้งสามเส้นตรวจ token เสมอแม้ `RBAC_ENFORCED=false` และ**ไม่รับ `AUTH_DEV_HEADER`**
  - บัญชี `admin@example.test` ที่ seed ไว้**ยังไม่มีรหัสผ่าน** · ถ้าจะใช้
    `/auth/revoke` ต้องตั้งก่อนด้วย `python backend/scripts/set_password.py admin@example.test`
  - แถวใน `revoked_tokens` ตายเองเมื่อ token หมดอายุ · ล้างด้วย
    `token_revocation.purge_expired()` ซึ่งเป็นงาน maintenance **ไม่ได้ผูกกับ request**
- **`AUTH_DEV_HEADER` ต้องเป็น `false`** บนทุกเครื่องที่เข้าถึงได้จากภายนอก ·
  ตรวจที่ `/health` → `auth.devHeaderAccepted`
- **ข้อมูลเดโมเป็นข้อมูลสังเคราะห์** · เกรดและการจับคู่แหล่งทุนเป็นนโยบายเดโม
  **ไม่ใช่การอนุมัติสินเชื่อ**

---

## ⚠️ 5. เรื่องที่ทีมต้องตัดสินใจ (ไม่ใช่งานโค้ด)

1. **เว็บจริงกับ repo ไม่ตรงกัน** — bundle บน Vercel ใหญ่กว่าที่ repo build ได้
   (JS +48.6 kB, CSS +21.6 kB) และ UI เวอร์ชันนั้นไม่มีอยู่ใน git
2. **"โครงการล่าสุด"** ที่ `/api/v1/order`, `/projects`, `/swarm/proposal` ใช้
   คือสิ่งที่ถูกเขียนล่าสุด **รวมออเดอร์ที่เทสต์สร้าง** ·
   ตอนเดโมให้ส่ง `?order_ref=PO-STP-2026-091` หรือรันออเดอร์จริงเป็นตัวสุดท้าย
