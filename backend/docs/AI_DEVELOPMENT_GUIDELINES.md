# SME SWARM: Finance Copilot - ข้อตกลงและแนวทางการพัฒนาสำหรับ AI

## ⚠️ 1. กฎเหล็กขั้นเด็ดขาด (เพื่อประหยัด Token และป้องกันระบบพัง)
> ข้อตกลงล่าสุด 2026-10-16: ทีมอนุญาต frontend wiring เพื่อให้ backend/AI และเว็บ
> ทำงานร่วมกันได้ **ไม่จำกัดสอง/ห้าไฟล์เดิม** · CODEX เน้น backend/AI, contracts,
> adapters, integration tests และ wiring ที่จำเป็น; ทีม frontend รับ presentation ต่อ

- **คง UI เดิม:** แก้ client/types/store/hooks/props/handlers/validation/data bindings ได้
  ตามจำเป็น โดยไม่ขอสิทธิ์รายไฟล์ซ้ำ · ห้ามเปลี่ยน CSS/Tailwind/สี/spacing/layout/motion
  design/component hierarchy/routing หรือสร้างหน้าใหม่ · ไม่ตีความคำว่า wiring ว่า redesign
- **หน้าตาเสร็จไม่เท่ากับระบบเสร็จ:** ทุก action ต้องระบุ read/preview/write/unavailable;
  toast/animation/local state ไม่ใช่หลักฐานว่าเรียก API, บันทึก DB หรือส่งคำขอจริง
- **การประหยัด TOKEN (Speed Mode):** เราอยู่ในช่วง Hackathon 48 ชั่วโมง ให้สร้างเฉพาะโค้ดที่พร้อมใช้งานจริงบน Production เท่านั้น ห้ามพิมพ์ข้อความเกริ่นนำ ห้ามอธิบายยืดเยื้อ และห้ามพิมพ์คำขอโทษ[cite: 1]
- **ตำแหน่งไฟล์และ Git:** โค้ดทั้งหมดต้องอยู่ใน `D:\code-project\sme-finance-copilot`[cite: 1] เมื่อเขียนโค้ดชุดใหญ่เสร็จ ต้องให้คำสั่ง Terminal สำหรับ Push โค้ดไปยัง `https://github.com/XevilA/sme-finance-copilot` branch main เสมอ[cite: 1]
- **กลยุทธ์ AI:** ไม่ต้องเทรน ML โมเดลใหม่ ให้ใช้สูตรคณิตศาสตร์, Rule-based systems และต่อ API ของ LLM ภายนอก (ผ่าน Prompt Engineering) เพื่อวิเคราะห์ข้อมูลและตอบกลับเป็น JSON[cite: 1]
- **ลำดับการทำงานของระบบ (Pipeline):** Read Data → Calculate → AI Analyze → Match Funding → Simulate → Return JSON to Web[cite: 1]

---

## 🤖 2. การแบ่งหน้าที่: ใครทำอะไร (ROLE DELEGATION)

บทบาทด้านล่างเป็นการแบ่งเดิมเพื่ออ้างอิง. คำสั่งล่าสุดให้ CODEX ดูแล backend/AI, DB/API/adapter
และ frontend integration ที่จำเป็นก่อนทีม frontend รับช่วง; lane split เดิมไม่บล็อกงานนี้.
รายละเอียด scope/owner/acceptance อยู่ใน `FRONTEND_INTEGRATION_HANDOFF.md`.

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

> ตรวจซ้ำ 2026-10-16 ที่ runtime source `48d9385` + validation regression repair ในรอบนี้ · **510 tests ผ่าน + 3 skip** มี PostgreSQL ·
> ไม่มี DB **410 ผ่าน + 103 skip** · **36 API routes**, **27 ตาราง** ·
> implementation ที่ผ่านมาเปลี่ยน frontend 5 ไฟล์; สิทธิ์ปัจจุบันครอบคลุม wiring ที่จำเป็น: **1955 modules**, CSS `index-DEindwiw.css` คงเดิม,
> JS `index-CBenrrOQ.js` · มี warning bundle >500kB และ Starlette/httpx เดิม

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
python -m pytest -c backend/pytest.ini -q    # 510 ผ่าน + 3 skip (ยังไม่ตั้ง DEMO_LOGIN_PASSWORD 2 + เคสเฉพาะตอนไม่มี DB 1)
```

**เอกสารอ่านตามลำดับนี้:** ไฟล์นี้ (ภาพรวม) → `progress.md` (งานฝั่ง CLAUDE) →
`CODEX_HANDOFF.md` (งานฝั่ง CODEX) → `DEPLOY.md` (ขึ้น production) ·
เฉพาะเรื่อง: `FINANCIAL_ENGINE.md`, `ANALYSIS_CONTRACT.md`, `LIVE_PROVIDER_VERIFICATION.md`

### Pipeline backend มีแล้ว — integration ทุกหน้า/action ยังไม่ครบ

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
| รับ forecast ในการวิเคราะห์ | `build_analysis(data, *, forecast=None, expense_history=None)` | มีหลักฐานวันเริ่มขาดเงินสด เงินสดต่ำสุด และยอด 30/60/90 วัน · ไม่คำนวณซ้ำ · CLAUDE ต่อ route แล้วใน `addf28e` |
| เทียบประวัติค่าใช้จ่าย | `analysis.py` | Rung Charoen วัตถุดิบ 168,000 เทียบฐาน 99,166.67 เพิ่ม 69.41% · Baan Suan ไม่ถูกแจ้งเตือน · CLAUDE ต่อ route แล้ว · เกณฑ์อยู่ใน `ANALYSIS_CONTRACT.md` |
| ตรวจทรัพยากรของร้านใน SWARM | `ShopCapacity.resources`, `shop_eligibility()` | ตรวจ required ก่อนจัดสรร พร้อมเหตุผลใน `audit.eligibility` · CLAUDE ต่อ `sme_ids` และกรองตามโครงการแล้วใน `addf28e` |

### ✅ CLAUDE (บทบาทที่ 2)

| Module | สถานะ | หมายเหตุ |
| --- | --- | --- |
| 8 · Database schema | ✅ | 27 ตาราง ครอบคลุม Users, SME Profiles, Investors, Projects, Analysis Results · `schema.sql` และ seed ทั้งสองไฟล์รันซ้ำได้ |
| 8 · RESTful API | ✅ | 36 routes · เสิร์ฟทั้ง `/api/*` และ `/api/v1/*` |
| 8 · RBAC + Authentication | ✅ | token HMAC-SHA256 + รหัสผ่าน scrypt · DB เป็นผู้ตัดสิน role ไม่ใช่ token · ปิด enforcement เป็นค่าเริ่มต้น |
| 8 · เพิกถอน token | ✅ | `revoked_tokens` เพิกถอนรายเซสชัน · `users.tokens_valid_from` เพิกถอนทั้งบัญชี · `POST /api/auth/logout`, `/auth/revoke-all`, `/auth/revoke` (admin) |
| 6 · What-If Simulator | ✅ | `POST /api/simulate` · 11 levers · เทียบ Plan A/B |
| Frontend Integration | ✅ Import/Overview/order Simulator/SWARM / ⏳ ยังไม่ครบทุก action | implementation ที่ `4d39680` ต่อจริง; สิทธิ์ใหม่ให้แก้ wiring หน้าอื่นได้แล้ว · ผล Overview/Health/Cost/AI มาจากคำขอเดียวกันในแท็บ · `src/services/api.ts` ไม่ถูกกู้คืน · 16 GET contracts ผ่าน HTTP แต่ยังมีข้อความ/สูตรคงที่ในหน้าอื่น ดู §4 |
| เตรียม Deploy | ✅ | `Dockerfile`, `railway.json`, bootstrap schema ตอน startup · ทดสอบด้วยการรัน container จริงแล้ว |
| ตารางภาระแบบระบุวันที่ | ✅ | `receivables`, `payables`, `expense_transactions`, `allocation_resources` · ต่อ `project_cash_events()` ของ CODEX เข้า `/api/forecast` แล้ว |
| ข้อมูลเสริมเข้าการวิเคราะห์ | ✅ | ส่ง `forecast` + `expense_history` ของ SME เดียวกันเข้า `build_analysis` ทั้งสี่จุด · ความครบของตารางมาจาก `schedule_complete_through` ของผู้เรียก · sub-status ถูกยกขึ้น `missing` ของ envelope |
| ทรัพยากรใน SWARM | ✅ | `ShopCapacity.resources` จาก `load_shop_resources()` เส้นทาง `sme_ids` · ไม่มีบันทึก = `None` ไม่ใช่ `[]` · loader กรองตาม `project_id` ของออเดอร์ที่กำลังจัดทีม |
| จำกัดอัตราคำขอ | ✅ | `provider_fetch_state` ล็อกข้าม worker + backoff · `auth_throttle` จำกัด login ข้าม replica |

---

## 🔜 4. งานที่เหลือ — backend/AI และ integration ก่อนส่ง frontend team

Current state และเกณฑ์รับงานฉบับเต็ม: [FRONTEND_INTEGRATION_HANDOFF.md](FRONTEND_INTEGRATION_HANDOFF.md).
สิทธิ์แก้ frontend wiring ได้แล้ว; งานค้างด้านล่างไม่ใช่งานที่ต้องขอขยายสิทธิ์รายไฟล์อีก

| ลำดับ | งานที่เราต้องปิด / เจ้าของ | ผลที่ต้องพิสูจน์ |
| --- | --- | --- |
| P0 | SME/project/input context — CODEX | ทุกหน้าใช้บริบทเดียวกัน, ไม่ default ไป demo/คนละ SME เงียบ ๆ; draft เปลี่ยนไม่อ้าง accepted result เก่าเป็นผลใหม่ |
| P0 | API/types/null/source/missing/error/CORS auth — CODEX | types ตรง runtime; partial data ใช้งานส่วนที่มี; invalid/network failure ไม่มี fake success หรือ skeleton ค้าง |
| P0 | Stored order constraints/collections — CODEX + ทีมข้อมูล | schema/loader เก็บข้อกำหนดจริง; ไม่ยืนยัน packaging เป็นอาหาร, ไม่เดาพิกัดหรือเปลี่ยนรถ offered เป็น confirmed |
| P0 | Demo business handlers — CODEX + ทีมกำหนด scope | apply/sign/info/export ต่อ operation จริงพร้อม read-back หรือ unavailable; ไม่เรียก endpoint สมมติ/แจ้งสำเร็จจาก toast |
| P1 | Saved plan read/replay — CODEX | POST save ที่มีอยู่ต้องอ่านกลับตาม ID/project ได้; full input/results/audit ตรวจซ้ำได้ |
| P1 | AI context/evidence/fallback — CODEX | SME/งวด/coverage ตรงหน้าจอ; rules/model status ตามจริง; ไม่ยืม baseline forecast ไปยืนยัน scenario |
| P1 | Chaos/resource effects — CODEX | ใช้ engine สำหรับผล scenario ไม่ใช้ timer/สูตรเงินใน component เป็นผลคำนวณ |
| P2 | Deploy/unmock — ทีมโฮสต์ + CODEX ตรวจ | backend URL/CORS และ Vercel สอง env ถูกต้อง; ห้ามอ้างว่ามี deployment ใหม่ในรอบนี้ |
| P2 | Live news — CODEX + ทีมโฮสต์ | ทดสอบจาก deployed host ผ่าน gate; ข่าวสดยังไม่ยืนยันสำเร็จ ไม่ force/retry หรือแต่งบทความ |
| ส่งต่อ | Presentation/UX/UI — ทีม frontend | ใช้ contract ที่ผ่าน acceptance; CODEX คงดีไซน์เดิมระหว่าง wiring |

**สิ่งที่ตรวจซ้ำผ่านแล้ว:** 510/3 DB, 410/103 ไม่มี DB, 36 main routes, 27 tables,
16 HTTP read contracts, build 1955 / CSS index-DEindwiw.css / JS index-CBenrrOQ.js;
import/page client regression scripts ผ่าน. ดูวิธีทดสอบใน TESTER_READINESS_CURRENT.md

Validation regression จาก main ใหม่แก้แล้ว: optional ยังเป็น None, required ต้องส่ง,
nonfinite ถูกปฏิเสธ. Inventory backend nullable + Excel aliases คงไว้; schema 39 fields
แต่ Import 38 fields; ไม่เพิ่ม stock/DIO math. เพิ่ม 16 tests โดยไม่ลด assertion เดิม.

Legacy Cost adapter ยังคืน 0 เป็น placeholder เมื่อ metrics ไม่พร้อม (HTTP minimal analyze
ตรวจแล้ว มี insufficient_data/missing). ต้องแก้ adapter/types/consumer คู่กันใน P0;
Overview ที่เป็น null แล้วไม่ได้แปลว่าทุก widget ปลอด placeholder ครบแล้ว

**ข้อจำกัดข้อมูล SWARM:** project 1,000/วัน 30 วัน; สองร้านอาหารติดรถ required ที่ยัง
ไม่พร้อม. preview จัดสรร Sahai (packaging) 450 และขาด 550; required_business_types,
buyer coordinates/radius/collection schedule ยังไม่เก็บใน project จึงรับรอง suitability
ไม่ได้. Backend/schema ต่อได้ภายใต้สิทธิ์ปัจจุบัน; ข้อมูลจริงต้องมาจากเจ้าของ

**ก่อนข้อมูลลูกค้าจริง:** auth มีใน backend แต่ frontend ยังไม่ส่ง token; health ปัจจุบัน
enforced=false / secretConfigured=false / devHeaderAccepted=false. Login 2 เคสยัง skip
เมื่อไม่ตั้ง DEMO_LOGIN_PASSWORD; admin มี password hash ใน local DB แล้ว แต่ไม่อ้างว่า
ทดสอบ admin login/revoke ด้วยบัญชีนี้สำเร็จ. อ่าน DEPLOY.md; ก่อน browser auth ต้องแก้ CORS ให้รับ Authorization ตาม contract ด้วย (preflight ปัจจุบัน
400 Disallowed CORS headers); ไม่เปิด enforcement แทนการทำ identity/authorization ให้ครบ และไม่ใส่ credential ใน repo/VITE_*.

---

## ⚠️ 5. เรื่องที่ทีมต้องยืนยัน

1. **ข้อมูลธุรกิจจริง:** ประเภทงาน/ร้าน, พิกัด/รัศมี, collection schedule และสถานะทรัพยากร.
   งาน schema/API เป็นของ CODEX; ค่า business requirements ต้องมาจากเจ้าของ ไม่แต่งเอง
2. **ขอบเขต transaction:** ปุ่มสมัครทุน/ลงนาม/ขอเอกสารจะเป็น preview หรือ workflow จริง;
   ถ้า workflow จริงต้องระบุ actor, state transitions และการอ่านกลับก่อนต่อปุ่ม
3. **Host/deploy:** ทีมสร้าง service/ให้ backend URL และตั้ง Vercel env/redeploy.
   รอบนี้ไม่มีการตรวจ production ใหม่; ข้ออ้าง bundle บน Vercel ต่างจาก repo ในบันทึกเก่า
   ไม่ใช่ข้อเท็จจริงที่วัดใหม่ในรอบนี้
4. **บริบทโครงการ:** ปัจจุบัน ACTIVE_PROJECT_ORDER เลือก start_date desc nulls last
   ก่อน updated_at/created_at. ถ้าทีมต้องเลือก project เอง ให้กำหนด contract/context ให้ชัด
   ไม่เขียน demo order ทับหรือ reseed เพื่อแก้การเลือกโครงการ
