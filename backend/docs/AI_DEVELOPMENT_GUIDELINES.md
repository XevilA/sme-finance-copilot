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