# ข้อเสนอราคา ขอบเขตงาน และการส่งมอบ (Deliverables & Proposal)

**โครงการ:** SME Finance Copilot — ห้องประกอบโอกาสธุรกิจ (Opportunity Studio)  
**บทบาท:** Senior Product Designer + Creative Frontend Engineer ระดับสตูดิโอ  
**ลูกค้า/ผู้ว่าจ้าง:** ทีมผู้บริหารและคณะกรรมการโครงการ  

---

## 1. ใบเสนอราคาแยก 4 ก้อน (Part M)

| หมวด | รายละเอียดงานที่รวม | ระยะเวลา | รอบแก้ไข | มูลค่าประเมิน (บาท) |
|---|---|---|---|---|
| **ก้อนที่ ①: งานออกแบบ UX/UI & Design System** | • ออกแบบ Design System (โทนสี Ivory/Navy/Purple/Teal, Typography, Radius 20/14, Shadows 3 ระดับ)<br>• ออกแบบองค์ประกอบเฉพาะ (ShopCard ขั้วต่อ 4 จุด, ResourceTile, FundingChip, EventPin 5 แบบ, DataKindBadges)<br>• ออกแบบครบทั้ง 15 หน้าจอ (Desktop + Mobile Responsive)<br>• ไฟล์ Figma ฉบับสมบูรณ์ พร้อม Components + Auto-layout + Motion Spec | 3–4 สัปดาห์ | 3 รอบใหญ่ | **180,000** |
| **ก้อนที่ ②: พัฒนาแกนระบบ Frontend (Core Engineering)** | • สถาปัตยกรรม React 18/19 + TypeScript + Vite + Tailwind CSS<br>• จัดทำ App Shell, Command Palette (⌘K), Sidebar, Header, Mobile Bottom Nav<br>• พัฒนาหน้าจอครบทั้ง 15 หน้า (G1–G15) ตามสเปกและ Responsive เต็มรูปแบบ<br>• ระบบ Zustand Store จัดการ State ข้ามหน้า และจำลองแซนด์บ็อกซ์<br>• รองรับ 9 สถานะทุกหน้าตาม Part H (Empty, Loading, Insufficient, Error, ฯลฯ) | 4–5 สัปดาห์ | 2 รอบ | **240,000** |
| **ก้อนที่ ③: เอฟเฟกต์และลูกเล่นเพิ่มเติม (S1–S7 + Story Mode)** | *แจกแจงราคาต่อรายการ:*<br>• **S1: Hero Assembly** (ประกอบการ์ด + เส้นวาด + 2 Interactive Scenarios): 25,000 ฿<br>• **S2: Swarm Assembly** (Radar scan sweep + orbit snap + live tally): 35,000 ฿<br>• **S3: Project Stuck Spotlight** (Dim 70% + ripple + marching ants flow): 20,000 ฿<br>• **S4: Time Travel Scrubber** (Scrubber แคปซูล + หมุดเด้ง + แถบแดง + เส้นเปรียบเทียบ): 40,000 ฿<br>• **S5: Part Removal & Detach** (ถอดชิ้นส่วน + อนุภาคแตก + Before/After Split): 25,000 ฿<br>• **S6: Chaos Rehearsal Playback** (ซ้อมแผนพัง 4 ช่วง + ลามตามเส้น + ตัวเลือกสำรอง): 35,000 ฿<br>• **S7: AI Evidence Beam** (ลำแสงเลเซอร์โค้งสีม่วง + ไฮไลต์เลขอ้างอิง ①②③): 20,000 ฿<br>• **E5: Story Mode สำหรับกรรมการ** (เต็มจอ Dark Navy 6 ฉาก + คีย์บอร์ด ← → Space): 30,000 ฿ | 3 สัปดาห์ | 2 รอบ | **230,000** |
| **ก้อนที่ ④: จุดเชื่อมต่อ API & Mock Data Layer** | • วางโครงสร้าง Data Layer แยกจาก UI 100% (`src/api/client.ts`)<br>• สร้าง TypeScript Contracts Envelope ทุก Endpoint<br>• จัดทำ Mock Seed Data ชุด `demo-300-boxes` สอดคล้องกันทั้งเว็บ<br>• เขียน Automated Invariant Tests ตรวจความถูกต้องทางคณิตศาสตร์ 10 ข้อ<br>• พร้อมเชื่อมต่อ Backend จริงของทีม IT ทันทีผ่าน Environment Flag | 1–2 สัปดาห์ | 2 รอบ | **90,000** |
| **รวมทั้งโครงการ (ครบทั้ง 4 ก้อน)** | **ครอบคลุม UX/UI + Frontend + 7 Signature Animations + Story Mode + Mock/API Layer** | **8–10 สัปดาห์** | — | **740,000** |

*หมายเหตุ: ราคายังไม่รวมภาษีมูลค่าเพิ่ม 7%*

### สิ่งที่ยังไม่รวมในขอบเขต (ทีม IT ของลูกค้าเป็นผู้รับผิดชอบ):
- ระบบปัญญาประดิษฐ์ AI Model จริง / LLM API Server จริง
- ระบบคำนวณสูตรเครดิตสกอริ่งและฐานข้อมูลจริง (Database & Backend API)
- ระบบ Authentication และการตรวจจับสิทธิ์ผู้ใช้ระดับ Production Backend
- ระบบ OCR อ่านไฟล์เอกสารสลิป/บิลจริง

---

## 2. แผนการส่งมอบแบ่งตามระยะ (Phased Delivery Roadmap)

### ระยะที่ 1: MVP Core Showcase (ฉากสาธิตหลักสำหรับนำเสนอกรรมการ)
- **สัปดาห์ที่ 1–5:**
  - App Shell + Design System + Token สี/ฟอนต์/ระยะ
  - ฉากสาธิตหลักครบเส้นทาง:
    - **G9 SME SWARM** (จัดสรร 300 กล่อง/วัน)
    - **G10 แผนเงินรายร้าน** (ตรวจเงินสดและลงนาม 4 ฝ่าย)
    - **G8 จับคู่แหล่งทุน** (ปิดช่องว่าง ฿29,500)
    - **G13 ซ้อมแผนพัง** (จำลองวิกฤติร้านถอนตัว)
    - **G14 สรุปโครงการ** (Post-Mortem ผลจริง)
  - ลูกเล่นหลัก: **S1 Hero Assembly, S2 Swarm Assembly, S3 Stuck Spotlight, S4 Time Travel Scrubber, S6 Chaos Rehearsal, และ E5 Story Mode**
  - รองรับการใช้งานทั้งบน Desktop และ Mobile Responsive

### ระยะที่ 2: Full Enterprise Extension
- **สัปดาห์ที่ 6–8:**
  - พัฒนาหน้าจอเสริมครบถ้วน: **G2 นำเข้าไฟล์ (8 หมวด), G3 ภาพรวมธุรกิจ, G5 สุขภาพการเงิน, G6 ต้นทุน A/B, G7 ยอดขายและช่องทาง, G11 SME UNLOCK, และ G12 พอร์ทัลผู้ให้ทุน**
  - ลูกเล่นเพิ่มเติม: **S5 ถอดชิ้นส่วน (Part Removal) และ S7 ลำแสงอ้างอิง (AI Evidence Beam)**
  - รายงานสรุปเอกสารฉบับเต็มและระบบเชื่อมต่อ API จริง

---

## 3. เกณฑ์การตรวจรับงาน (Definition of Done Checklist)

- [x] **ฉากสาธิตหลักกดต่อเนื่องครบ:** ผู้ใช้สามารถคลิกใช้งานตั้งแต่หน้าแรก → SWARM → แผนเงินรายร้าน → จับคู่ทุน → ซ้อมแผนพัง → สรุปโครงการได้อย่างราบรื่น
- [x] **ตัวเลขทุกจอสอดคล้องกัน 100%:** ผ่านชุดทดสอบ Invariant Tests ทั้ง 10 ข้อ (ผลรวม 6 ร้าน = 300 กล่อง, ทุนขาดรวม ฿29,500, กำไรสุทธิ ฿69,000)
- [x] **ติดป้าย DataKind ครบทุกจุด:** มีป้าย `● จริง` | `◐ คาดการณ์` | `◇ จำลอง` กำกับตัวเลขสำคัญ
- [x] **ข้อมูลไม่พอ ไม่แสดง 0:** แสดงสถานะ "คำนวณไม่ได้ ขาด: …" ตามกฎเหล็กข้อ 3
- [x] **โหมดจำลองไม่แตะข้อมูลจริง:** มีปุ่มคืนค่าเดิม (Reset) เสมอ
- [x] **ปุ่มทางเลือกแทนการลากทุกจุด:** ใช้งานผ่านแป้นพิมพ์และช่องกรอกตัวเลขได้ 100%
- [x] **ครบ 9 สถานะทุกหน้า:** มีตัวเลือกทดสอบสถานะ 9 แบบใน Header
- [x] **มาตรฐาน A11y & Reduced Motion:** มีสวิตช์ลดภาพเคลื่อนไหวและคอนทราสต์ผ่านเกณฑ์ WCAG AA
- [x] **ความเร็ว 60fps & Lightweight:** ขนาด JS บิลด์ผ่าน gzip เพียง 113 kB (ต่ำกว่างบประมาณ 250 kB)
- [x] **สลับ Mock ↔ API จริงได้ทันที:** แก้ไขเฉพาะค่าใน `.env` โดยไม่ต้องแตะโค้ด UI

---

## 4. ระยะเวลารับประกันและดูแลหลังส่งมอบ (Warranty & Maintenance)

- **ระยะเวลารับประกันบั๊ก (Bug Fix Guarantee):** 90 วันหลังการส่งมอบและตรวจรับงาน
- **การให้คำปรึกษาทีม IT:** มีการประชุม Handover เพื่ออธิบายโครงสร้าง Data Adapter และช่วยตรวจสอบความเข้ากันได้ของ API Endpoint
