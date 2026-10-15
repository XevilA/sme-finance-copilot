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

## 📊 3. สถานะงาน: ทำแล้ว / ยังไม่ได้ทำ

> อัปเดต 2026-10-15 ตรวจกับ commit `ee320dd` · 330 tests ผ่าน (มี PostgreSQL) ·
> 29 API routes · 20 ตารางฐานข้อมูล · รายละเอียดอยู่ใน `progress.md` และ `CODEX_HANDOFF.md`

### ✅ Pipeline หลัก — ครบทุกขั้นแล้ว

`Read Data → Calculate → AI Analyze → Match Funding → Simulate → Return JSON to Web`

| ขั้น | Endpoint | สถานะ |
| --- | --- | --- |
| Read Data | `POST /api/upload` | ✅ |
| Calculate | `POST /api/calculate` | ✅ |
| AI Analyze | `POST /api/analyze` | ✅ ระบบกฎเกณฑ์ + ตรวจ OpenAI จริงด้วย `gpt-6-luna` แล้วเมื่อ 2026-10-15 |
| Match Funding | `POST /api/match-funding` | ✅ |
| Simulate | `POST /api/simulate` | ✅ |
| Return JSON | `/api/v1/*` 16 contract | ✅ ตอบ 200 ครบ |
| เพิ่มเติม | `GET /api/forecast` · `GET /api/industry/trends` | ✅ |

### ✅ CODEX (บทบาทที่ 1) — ทำแล้ว

| Module | สถานะ | หมายเหตุ |
| --- | --- | --- |
| 1 · ตรวจข้อมูล Excel + สมการบัญชี | ✅ | `parsers/excel_parser.py`, `statement_parser.py` |
| 2 · Math Engine + เกรด A-D | ✅ | `engines/financial_engine.py`, `grading.py` · สูตร `G = 0.35(DSCR) + 0.30(Cash flow) + 0.20(Debt burden) + 0.15(Cash reserve)` |
| 3 · วิเคราะห์ธุรกิจ + พยากรณ์ 30/60/90 วัน | ✅ | `analysis.py`, `forecasting.py` |
| 4 · จับคู่แหล่งทุนและนักลงทุน | ✅ | `matching.py` · ให้คะแนน 0-100 + ตรวจ DSCR หลังรับทุน |
| 5 · SWARM Logic | ✅ | `swarm.py` v2 แบบออเดอร์จบชิ้น + เกณฑ์ประเภทธุรกิจและระยะทาง |
| 7 · แนวโน้มอุตสาหกรรม | ✅ | `industry.py` · ดึงข่าวผ่าน GDELT + สถานะ stale/unavailable |
| ตรวจสอบ LLM จริง | ✅ | เรียก Structured Outputs จริงสองคำขอ · ตัวชี้วัด เกรด และ finding ทุกฟิลด์คงเดิม · โมเดล `gpt-6-luna` · เพดาน token ขาออก 600 |
| คำแนะนำจากการวิเคราะห์เป็นภาษาไทย | ✅ | แปล finding และ action ครบทั้ง 12 เงื่อนไข · ตรวจ overview ผ่าน HTTP ของ SME เดโมทั้งสองรายแล้ว · ID และโครงสร้างคงเดิม |

### ✅ CLAUDE (บทบาทที่ 2) — ทำแล้ว

| Module | สถานะ | หมายเหตุ |
| --- | --- | --- |
| 8 · Database schema | ✅ | 20 ตาราง · Users, SME Profiles, Investors, Projects, Analysis Results ครบ · `schema.sql` รันซ้ำได้ |
| 8 · RBAC | ⚠️ ครึ่งทาง | role model + จุดตัดสินใจทำแล้ว ปิดเป็นค่าเริ่มต้น · **ยังไม่ใช่ authentication จริง** |
| 8 · FastAPI + RESTful endpoints | ✅ | 29 routes · เสิร์ฟทั้ง `/api/*` และ `/api/v1/*` |
| 6 · What-If Simulator | ✅ | `POST /api/simulate` · 11 levers · เทียบ Plan A/B |
| Frontend Integration | ⚠️ ครึ่งทาง | 16/16 contract ตอบ 200 + `src/services/api.ts` · **แต่เว็บยังเป็น mock เพราะ backend ยังไม่ได้ deploy** |

**UI ไม่ถูกแตะเลย** — build ได้ `1955 modules` และ asset hash เท่าเดิมทุกครั้ง

### ❌ ยังไม่ได้ทำ

| งาน | เจ้าของ | ติดอะไร |
| --- | --- | --- |
| **Deploy backend ขึ้น host** | CLAUDE | ต้องใช้บัญชี/credential ของทีม · **นี่คือตัวบล็อกใหญ่สุดของการเดโมเว็บจริง** |
| **ปลด frontend จากโหมด mock** | CLAUDE | ต้อง deploy ก่อน แล้วตั้ง `VITE_API_BASE_URL` + `VITE_USE_MOCK=false` |
| **Authentication จริง** | CLAUDE | ตอนนี้ใช้ header `X-User-Email` ซึ่งใครก็ตั้งได้ · ต้องมี token ที่เซ็น/ตรวจได้ |
| ดึงข่าวอุตสาหกรรมจริงได้สำเร็จ | CODEX / ทีมดูแลโฮสต์ | ยังไม่สำเร็จ: DNS และ TCP เชื่อมต่อได้ แต่ HTTPS TLS handshake หมดเวลารอ · การวินิจฉัยแยกผ่าน HTTP ตอบ 429 · ลดความซับซ้อนของคำค้นแล้วไม่แก้ TLS · ต้องตรวจ TLS จากโฮสต์ที่จะ deploy และประสานจำกัดอัตราคำขอผู้ให้บริการ · ดู `LIVE_PROVIDER_VERIFICATION.md` |
| พิกัดร้านค้าจริง | ทีม | คอลัมน์ `latitude`/`longitude` พร้อมแล้วแต่ยังไม่มีข้อมูล · ตัวกรองระยะทางจึงตัดร้านที่ไม่มีพิกัดออกเมื่อบังคับรัศมี |
| `industry_news_fetch_state` | CLAUDE | ยังไม่มีการล็อก/จำกัดอัตราระดับผู้ให้บริการข้าม worker ควรเพิ่มก่อนรันหลายเครื่อง |
| ต่อ `project_cash_events()` เข้า route | CLAUDE | ยังไม่มีแหล่งข้อมูลลูกหนี้/เจ้าหนี้แบบระบุวันที่ในระบบ |

### ⚠️ เรื่องที่ทีมต้องตัดสินใจ (ไม่ใช่งานโค้ด)

1. **เว็บจริงกับ repo ไม่ตรงกัน** — bundle บน Vercel ใหญ่กว่าที่ repo build ได้
   (JS +48.6 kB, CSS +21.6 kB) และ UI นั้นไม่มีอยู่ใน git
2. **"โครงการล่าสุด"** ที่ `/api/v1/order`, `/projects`, `/swarm/proposal` ใช้
   คือสิ่งที่ถูกเขียนล่าสุด **รวมออเดอร์ที่เทสต์สร้าง** · ตอนเดโมให้ส่ง
   `?order_ref=PO-STP-2026-091` หรือรันออเดอร์จริงเป็นตัวสุดท้าย
3. **ข้อมูลเดโมเป็นข้อมูลสังเคราะห์ทั้งหมด** — Baan Suan เกรด A (88.37),
   Rung Charoen เกรด D (34.61) · เกรดและการจับคู่แหล่งทุนเป็นนโยบายเดโม
   **ไม่ใช่การอนุมัติสินเชื่อ**
