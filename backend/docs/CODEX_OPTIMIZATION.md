# โหมดการทำงานของ CODEX: ประสิทธิภาพสูงสุด ใช้ Token น้อยสุด

> อัปเดต 2026-10-16 ตามข้อตกลงทีมล่าสุด; ดู [FRONTEND_INTEGRATION_HANDOFF.md](FRONTEND_INTEGRATION_HANDOFF.md)
> สำหรับ scope, priority และเกณฑ์ส่งต่อ. ข้อห้าม frontend แบบเดิมไม่ใช้แล้ว

## 1. ห้ามมีเนื้อหาส่วนเกิน (สำคัญต่อการประหยัด Token)

- **สื่อสารสั้นและตรงงาน:** แจ้งผลที่พบ ขั้นถัดไป และ blocker ที่จำเป็นเป็นไทย
- **ห้ามอธิบายยืดเยื้อ:** ไม่ต้องอธิบายการทำงานของโค้ดเป็นย่อหน้า ใช้ comment สั้น ๆ
  ใน code block เฉพาะเมื่อจำเป็นจริง
- **ส่งมอบพร้อมหลักฐาน:** code/variables/endpoints/commit messages เป็นอังกฤษ;
  รายงานผลทดสอบและข้อจำกัดตามจริง ไม่ใช้ toast/animation แทน HTTP/DB read-back

## 2. กฎการสร้างโค้ด

- **แก้เฉพาะส่วนที่เกี่ยวข้อง:** ห้ามเขียนไฟล์ที่ไม่เกี่ยวข้องใหม่ทั้งไฟล์
  ส่งเฉพาะฟังก์ชันหรือโมดูลที่ถูกขอ
- **Frontend wiring อนุญาตแล้ว:** แก้ client/types/store/hooks/props/handlers/validation
  และ data bindings ที่จำเป็นได้ ไม่จำกัดสอง/ห้าไฟล์เดิม โดยคง CSS/Tailwind/สี/spacing/
  layout/motion design/component hierarchy/routing. ทีม frontend รับ presentation ต่อ

## 3. ข้อจำกัดด้าน Workspace

- Path: `D:\code-project\sme-finance-copilot`
- Repository: `https://github.com/XevilA/sme-finance-copilot` (branch `main`)
- บทบาท: Backend & AI Logic + contracts/adapters/integration ที่จำเป็นก่อนส่ง frontend team
