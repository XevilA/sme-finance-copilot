# SME Finance Copilot — ห้องประกอบโอกาสธุรกิจ (Opportunity Studio)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FXevilA%2Fsme-finance-copilot)
[![GitHub Repository](https://img.shields.io/badge/GitHub-XevilA%2Fsme--finance--copilot-181717?style=flat&logo=github)](https://github.com/XevilA/sme-finance-copilot)

> **ระบบ Frontend เว็บไซต์ระดับสตูดิโอสำหรับการประกอบแผนธุรกิจ การเงินกระแสเงินสด และการรวมทีมรับงานขนาดใหญ่**
> *พัฒนาขึ้นตามข้อกำหนด UX/UI + Frontend + Motion System (Part A – M)*

> **For frontend contributors:** start with the [Frontend Integration Guide](docs/FRONTEND_INTEGRATION_GUIDE.md) for local setup, API configuration, contracts, and safe UI integration patterns.

---

## สถานะโครงการและข้อตกลงทีม — 2026-10-16

โปรเจกต์มี FastAPI/PostgreSQL และ math/AI backend พร้อม frontend adapter แล้ว;
Import/Overview/order Simulator/SWARM ต่อ operation จริงบางส่วน แต่ยังไม่ครบทุกปุ่ม.
ทีมอนุญาตให้ CODEX แก้ frontend wiring ที่จำเป็น **โดยคง UI เดิม** ไม่จำกัดห้าไฟล์เดิม.
งานหลักตอนนี้คือ backend/AI/API/contracts/integration; ทีม frontend รับ presentation ต่อ

- [สถานะทั้งแปดโมดูลและงานส่งต่อ](backend/docs/FRONTEND_INTEGRATION_HANDOFF.md)
- [API ที่มีจริงและ request shapes](docs/API_CONTRACT_MATRIX.md)
- [เริ่มทดสอบและข้อจำกัดปัจจุบัน](backend/docs/TESTER_READINESS_CURRENT.md)
- [กติกาทำงานและ work list §4](backend/docs/AI_DEVELOPMENT_GUIDELINES.md)

ตรวจ source `48d9385` + validation regression repair ในรอบนี้: 510/3 tests มี DB, 410/103 ไม่มี DB, 36 main API paths,
27 tables, 16 read contracts. Build 1955 modules / CSS index-DEindwiw.css / JS index-CBenrrOQ.js.
หน้า/animations ด้านล่างอธิบาย UI และ demo design ไม่ใช่หลักฐานว่า action ทุกปุ่มมี persistence.
Local backend integration ใช้ localhost:5173 ตาม tester guide; default pnpm dev ที่ 3000
เป็น frontend/demo server และต้องตรวจ CORS ก่อนใช้กับ backend

---

## 🌟 แนวคิดหลัก (Core Concept)

**"ห้องประกอบโอกาสธุรกิจ"** เปลี่ยนมุมมองจากการอ่านรายงานตัวเลขแห้งๆ เป็นการ **ประกอบแผนธุรกิจจากชิ้นส่วนจริง** (ร้านค้า ลูกค้า ครัว รถขนส่ง ทีมงาน และแหล่งเงินทุน) เมื่อปรับเปลี่ยนชิ้นส่วน ผู้ใช้และคณะกรรมการจะเห็นผลลัพธ์ทางการเงินและเข้าใจเหตุผลทันทีแบบโปร่งใส

---

## 🛡️ กฎเหล็กที่ระบบยึดถืออย่างเคร่งครัด (Non-Negotiable Rules)

1. **ห้ามคิดหรือแต่งตัวเลขเอง 100%:** ข้อมูลทั้งหมดส่งตรงมาจาก API Adapter และ Mock Data Seed ที่ผ่านการทดสอบ Invariants
2. **ติดป้าย DataKind ทุกจุด:** ตัวเลขสำคัญกำกับด้วย `● จริง (actual)` | `◐ คาดการณ์ (forecast)` | `◇ จำลอง (simulated)` ทั้งสัญลักษณ์และข้อความ
3. **ข้อมูลไม่พอ ไม่แสดง 0:** แสดงข้อความชัดเจนว่า **"คำนวณไม่ได้ ขาด: …"** (เช่น ตัวชี้วัด DIO ในหน้าสุขภาพการเงิน)
4. **โหมดจำลองไม่แตะข้อมูลจริง:** มีปุ่ม **"คืนค่าเดิม (Reset)"** เสมอ
5. **ปุ่มทางเลือกแทนการลากทุกจุด:** รองรับการใช้งานผ่านคีย์บอร์ด, สไลเดอร์คู่ช่องกรอก, และปุ่มกด
6. **สถานะไม่พึ่งสีอย่างเดียว:** มีข้อความ + สัญลักษณ์ Lucide ควบคู่เสมอ
7. **เอฟเฟกต์ไม่บล็อกการกด:** ทุกแอนิเมชัน interrupt ได้ทันที ปุ่มหลักกดได้ตั้งแต่เฟรมแรก
8. **รองรับ Reduced Motion & WCAG AA:** มีสวิตช์เปิด-ปิดภาพเคลื่อนไหวบนแถบบน และตรวจจับ `prefers-reduced-motion`

---

## ⚡ 7 Signature Animations & Story Mode

| รหัส | ชื่อลูกเล่น | หน้าจอที่ใช้ | การทำงาน |
|---|---|---|---|
| **S1** | **Hero Assembly** | หน้าแรก (Overview) | การ์ด ลูกค้า → ร้าน → ครัว → รถ → ทุน ลอยเข้าที่ด้วย Spring Stagger พร้อมเส้นวาด Bézier และลำแสงวิ่ง มีปุ่มจำลองโจทย์ปัญหา 2 แบบ |
| **S2** | **Swarm Assembly** | SME SWARM | กด "เสนอทีมให้ฉัน" เกิด Radar Scan วงแหวนม่วงกวาด 6 ร้านบินเข้าสู่วงโคจรรอบคำสั่งซื้อ 300 กล่อง |
| **S3** | **Project Stuck Spotlight** | SME SWARM | ปุ่มแยก 3 ด้าน (กำลังผลิต / เงินทุน / ส่งมอบ) ดิมจอ 70% ไฮไลต์จุดติดด้วยคลื่นสีแดงและข้อความชี้ทางแก้ |
| **S4** | **Time Travel Scrubber** | เงินสด (Cashflow) | แคปซูลเรืองแสงเลื่อนดูอนาคต 30 วัน หมุดเหตุการณ์เงินผุดขึ้น แถบแดงเตือนช่วงเงินต่ำกว่าสำรอง และเส้นจำลองปรับมัดจำ |
| **S5** | **Part Removal & Detach** | SME UNLOCK | กดถอดครัว/รถ การ์ดสลายตัวเป็นอนุภาค เส้นเชื่อมขาด ส่งผลกระทบต้นทุนทั้งโครงการ และมีตัวเลื่อน Before-After Split |
| **S6** | **Chaos Rehearsal Playback** | ห้องจำลอง (Simulator) | ซ้อมวันที่ทุกอย่างพัง 4 ช่วง: เกิดเหตุ → คลื่นลามตามเส้นทาง → เงินสดดิ่ง → ทางเลือกสำรองสลับร้าน |
| **S7** | **AI Evidence Beam** | แผงข้าง AI Panel | ลำแสงเลเซอร์โค้งสีม่วงส่องตรงจากข้อความ AI ไปยังการ์ดตัวเลขจริงบนหน้าจอ พร้อมเลข ①②③ |
| **E5** | **Story Mode** | โหมดเล่าโครงการ | เต็มจอธีม Dark Navy สำหรับเดโมกรรมการ 6 ฉาก cinematic ควบคุมด้วย Spacebar / ลูกศร |

---

## 📂 โครงสร้างสถาปัตยกรรมโค้ด (Clean Architecture)

```
src/
  api/
    client.ts             ← Adapter เชื่อมต่อ (สลับ mock ↔ จริงได้ที่นี่ที่เดียว)
    contracts/
      types.ts            ← TypeScript Envelope และ Types ทั้งระบบตามที่ตกลงกับ IT
    mock/
      seedData.ts         ← Master Seed ข้อมูลสาธิต (demo-300-boxes)
  components/
    ui/
      AppHeader.tsx       ← แถบบน: ค้นหา ⌘K, บริบท, สลับบทบาท, ทดสอบ 9 สถานะ
      AppSidebar.tsx      ← เมนู 13 หมวดตามบทบาท
      CommandPalette.tsx  ← ค้นหาด่วนสไตล์ ⌘K
      StateRenderer.tsx   ← แสดงผล 9 สถานะตาม Part H
    signature/
      ShopCard.tsx        ← การ์ดร้านค้าพร้อมขั้วต่อ 4 จุดและแถบกำลังผลิต
      ResourceTile.tsx    ← การ์ดทรัพยากร ครัว/รถ พร้อมปุ่มถอดชิ้นส่วน (S5)
      FundingChip.tsx     ← การ์ดแหล่งเงินทุนและคะแนนความเหมาะสม
      EventPin.tsx        ← หมุดเหตุการณ์เงิน 5 ชนิดทรงหยดน้ำ
      LinkLine.tsx        ← เส้นเชื่อม Bézier พร้อมลำแสงวิ่ง
      DataKindBadge.tsx   ← ป้ายจริง / คาดการณ์ / จำลอง
  features/
    overview/             ← G1 & G3: ภาพรวม + S1 Hero Assembly
    import/               ← G2: ข้อมูลธุรกิจ & นำเข้าไฟล์ (8 หมวด)
    cashflow/             ← G4: เงินสด & S4 Time Travel Scrubber
    health/               ← G5: สุขภาพการเงิน 5 มิติ
    cost/                 ← G6: ต้นทุนต่อหน่วยและแผนลงทุน A/B
    sales/                ← G7: ยอดขาย กำไรรายเมนู และช่องทาง
    funding/              ← G8: จับคู่เงินทุนเฉพาะโครงการ
    swarm/                ← G9: SME SWARM + S2 Radar Scan + S3 Stuck Spotlight
    shop-finance/         ← G10: แผนเงินรายร้านและลงนาม 4 ฝ่าย
    unlock/               ← G11: SME UNLOCK + S5 ถอดชิ้นส่วน
    funder/               ← G12: พอร์ทัลผู้ให้ทุน + ตรวจหลักฐาน 3 ระดับ
    simulator/            ← G13: ห้องจำลอง + S6 Chaos Rehearsal
    projects/             ← G14: โครงการ & Post-Mortem สรุปผลจริง
    ai-panel/             ← G15: แผง AI Assistant + S7 Evidence Beam
  store/
    useAppStore.ts        ← Zustand Store กลาง (บริบท, แซนด์บ็อกซ์, สถานะ 9 แบบ)
scripts/
  test-invariants.ts      ← สคริปต์ตรวจความถูกต้องทางคณิตศาสตร์ของ Seed Data
```

---

## 🚀 การติดตั้งและรันระบบ

### 1. ติดตั้ง Dependencies
```bash
pnpm install
```

### 2. รันโหมด Development
```bash
pnpm dev
```
เปิดบราวเซอร์ที่ `http://localhost:3000`

### 3. รันการทดสอบความสอดคล้องทางคณิตศาสตร์ (Invariant Test Suite)
```bash
pnpm test:invariants
```
*ตรวจผลรวม 6 ร้าน = 300 กล่อง/วัน, รายได้ ฿240,000, ต้นทุน ฿171,000, กำไร ฿69,000, และทุนที่ขาด ฿29,500 ตรงตามสูตร 100%*

### 4. บิลด์สำหรับ Production
```bash
pnpm build
```

---

## 🔄 การสลับระหว่าง Mock และ API จริง

สามารถสลับการทำงานได้ง่ายๆ ผ่านตัวแปรสภาพแวดล้อม `.env`:

```env
# ใช้ข้อมูลจำลอง (ค่าเริ่มต้นสำหรับการเดโม)
VITE_USE_MOCK=true

# เมื่อพร้อมเชื่อมต่อ Backend จริงของทีม IT:
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://<backend-host>/api/v1
```
*ตัวแปรนี้สลับ adapter ที่ `src/api/client.ts`; ไม่ได้เปลี่ยน demo handlers ทุกปุ่มให้เป็น API operation โดยอัตโนมัติ. ดู handoff ก่อนอ้างว่าเชื่อมครบแล้ว*

---

## 🧪 การทดสอบ 9 สถานะของระบบ (Part H)

บนแถบเมนูด้านบน (AppHeader) มีเมนู **"สถานะ: normal"** ให้คณะกรรมการคลิกทดสอบการแสดงผลทั้ง 9 สถานะได้ทันที:
1. `empty` — ยังไม่มีข้อมูล พร้อมภาพ Illustration การ์ดว่างเชื่อมเส้นประ
2. `loading` — โครงกระดูกเรืองแสง (Skeleton Shimmer)
3. `insufficient_data` — ข้อมูลไม่เพียงพอ ระบุรายการที่ขาด (ไม่แสดง 0)
4. `error` — เกิดข้อผิดพลาด พร้อมปุ่มลองใหม่
5. `not_found` — ค้นหาไม่พบ พร้อมปุ่มล้างตัวกรอง
6. `no_permission` — ไม่มีสิทธิ์ พร้อมปุ่มขอข้อมูล
7. `stale` — ผลลัพธ์ล้าสมัยหลังข้อมูลเปลี่ยน พร้อมปุ่มวิเคราะห์ใหม่
8. `success` — บันทึกสำเร็จพร้อมเครื่องหมายถูก
9. `unsaved` — มีการแก้ไขจำลองค้างอยู่
