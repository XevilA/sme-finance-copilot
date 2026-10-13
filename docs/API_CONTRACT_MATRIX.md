# ตารางข้อตกลง API Contract (Screen ↔ IT Backend)

> เอกสารแนบข้อตกลงระหว่างทีมออกแบบ/Frontend และทีม IT สำหรับระบบ **SME Finance Copilot**

---

## 1. มาตรฐาน Response Envelope (Part J)

ทุก Endpoint ส่งข้อมูลกลับมาในรูปแบบ Envelope มาตรฐานเดียวกัน:

```typescript
type Envelope<T> = {
  data: T;
  kind: "actual" | "forecast" | "simulated";
  status: "ok" | "insufficient_data" | "stale" | "error";
  missing?: string[]; // ระบุชื่อข้อมูลที่ขาดเมื่อ status === 'insufficient_data'
  asOf: string;       // ISO 8601 Timestamp วันที่ของข้อมูล
  analyzedAt?: string;
  evidenceRefs?: { id: string; label: string; targetId: string }[];
  unit?: string;
  period?: string;
};
```

---

## 2. ตารางแมปหน้าจอ ↔ Endpoint

| หน้าจอ | Endpoint | Method | Response Payload | DataKind | หมายเหตุสำหรับทีม IT |
|---|---|---|---|---|---|
| **G1 & G3 ภาพรวมธุรกิจ** | `/overview` | `GET` | `BusinessOverview` | `actual` | ส่ง `cashBalance`, `usableCashAfterReserve` และแยกกำไรกับเงินสด |
| **G2 นำเข้าไฟล์** | `/import/upload`<br>`/import/validate`<br>`/import/confirm` | `POST` | `{ rows: number, errors: [] }` | `actual` | ตรวจสอบดุลบัญชีและส่งสถานะการอ่านไฟล์ |
| **G4 เงินสด (Time Travel)** | `/cashflow/timeline` | `GET` | `CashflowDay[]` (30-90 วัน) | `forecast` | ส่ง `projectedCash`, `reserveLine`, `events[]`, `isDeficit` |
| **G5 สุขภาพการเงิน** | `/health/indicators` | `GET` | `HealthIndicator[]` | `actual` | หากข้อมูลไม่พอ ให้ส่ง `value: null` + `missingFields[]` |
| **G6 ต้นทุน & ความคุ้มค่า** | `/cost/breakdown` | `GET` | `CostBreakdown` | `actual` | แจกแจงต้นทุนต่อหน่วยและโมเดลประเมินแผนลงทุน A/B |
| **G7 ยอดขายและสินค้า** | `/sales/products`<br>`/sales/channels` | `GET` | `ProductSales[]`<br>`ChannelSales[]` | `actual` | หักค่า GP แพลตฟอร์มและค่าส่งเพื่อคำนวณกำไรสุทธิแท้จริง |
| **G8 จับคู่แหล่งเงินทุน** | `/funding/options` | `GET` | `FundingOption[]` | `forecast` | ส่งคะแนนความเหมาะสม (`matchScore`), ดอกเบี้ย และวันรับเงิน |
| **G9 SME SWARM** | `/swarm/proposal` | `GET` | `SwarmProposal` | `forecast` | ส่ง 6 ร้านค้า, ส่วนแบ่งกล่อง, `stuckReasons[]` สำหรับ S3 |
| **G10 แผนเงินรายร้าน** | `/shops/:id/finance` | `GET` | `ShopFinance` | `forecast` | ไทม์ไลน์เงินสดรายวันของร้าน, ทุนที่ขาด และสถานะลงนาม 4 ฝ่าย |
| **G11 SME UNLOCK** | `/unlock/resources` | `GET` | `UnlockResource[]` | `actual` | รายการทรัพยากร ครัว/รถ พร้อมข้อมูลผลกระทบหากถูกถอด (`impactIfDetached`) |
| **G12 ฝั่งผู้ให้ทุน** | `/funder/projects` | `GET` | `FunderProject[]` | `forecast` | ระดับหลักฐาน 3 ขั้น (`confirmed_po`, `quotation`, `interest`) |
| **G13 ห้องจำลอง & Chaos** | `/simulator/chaos` | `GET` | `ChaosScenario[]` | `simulated` | เส้นทางการลามของความเสียหาย (`propagationPath[]`) สำหรับ S6 |
| **G14 โครงการ & รายงาน** | `/projects` | `GET` | `ProjectRecord[]` | `actual` | ตารางส่งมอบจริงเทียบแผน และผลกำไรสุทธิหลังจบงาน |
| **G15 AI Assistant** | `/ai/explain?page=:id` | `GET` | `AIResponse` | `forecast` | ส่ง `dataUsed[]` ที่มี `refNum` และ `targetElementId` สำหรับ S7 |

---

## 3. ข้อมูลเฉพาะที่ลูกเล่น (S1–S7) ต้องใช้

1. **S3 Project Stuck:** ต้องมี `stuckReasons[]` ระบุประเภท (`capacity` / `funding` / `delivery`), `shopId`, และข้อความชี้ทางแก้
2. **S6 Chaos Propagation:** ต้องมี `triggerNodeId` และ `propagationPath[]` เรียงลำดับโหนดที่ได้รับผลกระทบ
3. **S7 AI Evidence Beam:** ต้องมี `dataUsed[].targetElementId` ตรงกับ ID บน DOM เพื่อให้ลำแสงเลเซอร์ยิงถูกตำแหน่ง
