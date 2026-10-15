# การส่งมอบงานของ CODEX

## ผลการตรวจสอบล่าสุด: 2026-10-15

ข้อมูลอัปเดตส่วนนี้ใช้แทนบันทึกเดิมด้านล่างเรื่องยังไม่มีข้อมูลลับสำหรับเรียก OpenAI
และยังไม่เคยตรวจเส้นทาง LLM จริง · งานต่อระบบและ reseed ของ Claude บันทึกไว้ใน
`progress.md` · หมายเหตุประวัติด้านล่างจึงไม่ใช่รายการงานต่อระบบที่ยังค้างอยู่ในปัจจุบัน

- `backend/.env` มี key บนเครื่องและ `OPENAI_MODEL=gpt-6-luna` แล้ว · Git ละเว้น key
  และไม่มีการใส่ key ลงในเอกสารหรือไฟล์ส่งมอบงาน
- คำขอวิเคราะห์ HTTP จริงสองคำขอสำเร็จด้วย `aiMode: openai` · ตัวชี้วัด เกรด
  และ finding ทุกฟิลด์เมื่อเทียบตาม ID ตรงกับผลระบบกฎเกณฑ์ทุกไบต์ ·
  กรณีเงินสดขาดมือเปลี่ยนเฉพาะลำดับภายในกลุ่ม severity ตามที่อนุญาตไว้
- ค่าใช้จ่ายตาม usage รวมการเขียนลงแคช: **$0.00144635** · ประมาณการยอดคงเหลือ
  จากยอด $5.98 ที่ผู้ใช้แจ้ง: **$5.97855365** · ยังไม่ได้ยืนยันยอด billing จริง
- finding/action ทั้ง 12 เงื่อนไข และ summary/reasoning ใน explanation เป็นภาษาไทยแล้ว ·
  ID, category, severity, การอ้างอิงหลักฐาน, ปลายทาง และโครงสร้าง JSON คงเดิม ·
  Endpoint overview ของ SME เดโมทั้งสองรายส่งฟิลด์คำแนะนำภาษาไทยผ่าน HTTP จริงแล้ว
- ข่าวยังมีสถานะ unavailable ตามข้อเท็จจริง · DNS/TCP สำเร็จ แต่ HTTPS ค้างที่ TLS
  และการวินิจฉัยแยกผ่าน HTTP ธรรมดาตอบ 429 · ไม่ได้อ้างว่าดึงบทความสำเร็จ
  หรือตรวจการตัดข่าวซ้ำและวันเผยแพร่จากข้อมูลจริงแล้ว · Claude ยังรับผิดชอบการกำหนด
  จังหวะคำขอผู้ให้บริการ และต้องตรวจเครือข่ายหรือ TLS ของผู้ให้บริการตอน deploy เพิ่มเติม
- Frontend และไฟล์ของ Claude ทั้งหมดคงเดิม

หลักฐานและข้อจำกัดโดยละเอียด: `LIVE_PROVIDER_VERIFICATION.md`.

> แปลจากต้นฉบับภาษาอังกฤษของ CODEX · signature ของฟังก์ชัน ชื่อฟิลด์ ชื่อ key ตัวเลข
> และ code block ทั้งหมดคงเดิม · หัวข้อที่ CLAUDE ดำเนินการแล้วหรือยังค้าง มีหมายเหตุกำกับ

## ส่วนที่ 1: cash exposure ของ SWARM แบบออเดอร์จบชิ้น

สมมติฐานทางธุรกิจเปลี่ยนจาก "ผลิตต่อเนื่องตลอดช่วงเครดิต" เป็น **"ออเดอร์จบชิ้น"** ·
ต้นทุนการผลิตเกิดเฉพาะวันที่ 1 ถึง `duration_days` · รับมัดจำวันที่ 0 ·
ยอดคงเหลือตามใบแจ้งหนี้เก็บได้ในวันส่งมอบบวกเครดิตเทอม เว้นแต่มีการระบุสัดส่วน
การรับชำระมาอย่างชัดเจน · **ต้นทุนเกิดก่อนการรับชำระของผู้ซื้อในวันเดียวกัน**

เงินทุนหมุนเวียน = **peak cumulative deficit โดยไม่นับมัดจำตั้งต้น** ·
ส่วนขาดเงินทุน = นับมัดจำหนึ่งครั้ง แล้วหักเงินสดที่ใช้ได้ส่วนที่เกินเงินสำรองออก

ตัวอย่าง 40 ชิ้น/วัน 10 วัน 70 บาท/ชิ้น เครดิต 30 วัน ตอนนี้ต้องใช้ **28,000 บาท
ไม่ใช่ 112,000 บาท** · เทสต์สองตัวที่ผูกกับสูตรเดิมถูกแก้เพราะ**สมมติฐานทางธุรกิจเปลี่ยน** ·
ทุกเทสต์ 241 รายการผ่านกับ Postgres ณ ส่วนนี้ · envelope ของ `allocate()` แถวข้อมูลร้าน
และ key ของ audit ไม่เปลี่ยน · ค่า version ของ engine และข้อเสนอเป็น `v2` แล้ว

### สิ่งที่ CLAUDE ต้องทำ

- คำนวณและอัปเดตยอด allocation ใน `db/seed.sql` แล้ว reseed ตามกระบวนการที่ทีมอนุมัติ ·
  ข้อมูลที่เก็บอยู่ยังมีค่าเดิม · **CODEX ไม่ได้รีเซ็ตฐานข้อมูลหรือแก้ไฟล์ seed**
- ส่งต่อ input ที่เป็น optional ของ `SwarmRequest` ผ่าน `SwarmBody` และ input ของ simulator:
  `production_start` (วันที่แบบ ISO), `collection_schedule` (คู่ day_index/fraction
  ที่รวมกันได้ 1 ของยอดใบแจ้งหนี้หลังหักมัดจำ), `required_business_types`,
  `buyer_coordinates` (latitude/longitude) และ `max_distance_km`
- ส่งต่อ `ShopCapacity.business_type` และ `.coordinates` · `sector` ที่มีอยู่ใช้เป็น
  business_type ได้ · เพิ่มคอลัมน์ latitude/longitude แบบ nullable ใน `sme_profiles`
  และตรวจช่วง latitude -90..90 กับ longitude -180..180 · **CODEX ไม่ได้แก้ schema
  และไม่สร้างพิกัดขึ้นเองจากชื่อจังหวัด**
- ดัก `ValidationError` ตอนสร้าง `SwarmRequest` ใน route แล้วคืน HTTP 422 หรือทำ
  validator เรื่อง shop id ซ้ำบน `SwarmBody` ด้วย · **การตรวจ id ซ้ำของ core
  เกิดหลัง `SwarmBody` ตรวจผ่านไปแล้ว**
- `shop_eligibility(shop, request)` คืน eligible, distance_km และ reasons ·
  ระยะทางเป็น Haversine แบบเส้นตรง **ไม่ใช่ระยะทางขับรถ** · ถ้าบังคับรัศมี
  ร้านที่ไม่มีพิกัดจะถูกตัดออก · ประเภทธุรกิจเทียบแบบตรงตัวโดยไม่สนตัวพิมพ์ ·
  ผู้สมัครที่ผ่านเกณฑ์เรียงตามต้นทุน ระยะทาง กำลังผลิตที่ว่าง แล้วจึง id
- `app/order_cash.py::finite_order_schedule()` เปิดความเคลื่อนไหวแบบระบุวันที่ให้
  ถ้าส่ง production_start มา · ถ้าไม่ส่ง day_index จะเป็นค่าสัมพัทธ์และ date เป็น null

ไฟล์ frontend, adapters, catalog, repository, models, routers, RBAC และไฟล์ SQL
ไม่ถูกแก้

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE ทำครบทุกข้อแล้ว — reseed จาก
> `SWARM_RESEED_VALUES.json`, ส่งต่อ input ใหม่ทั้งหมด, เพิ่ม latitude/longitude/business_type
> ใน `sme_profiles` และแปลง `ValidationError` เป็น 422 · ส่วนขาดรวมของออเดอร์เดโม
> ลดจาก 465,000 เป็น 45,000

## ส่วนที่ 2: การจัดอันดับสินเชื่อและนักลงทุน

```python
from app.matching import match_funding, match_investors

def match_funding(data: FinancialInput, grade: dict, requested_amount: Decimal,
                  products: list[dict]) -> list[dict]: ...

def match_investors(data: FinancialInput, grade: dict, requested_amount: Decimal,
                    investors: list[dict], *, sector: str | None = None,
                    investment_horizon_months: int | None = None) -> list[dict]: ...
```

`products` รับแถวแบบ camelCase จาก `load_funding_products()` ได้ตรง ๆ ·
แถวนักลงทุนรองรับทั้ง snake_case ของฐานข้อมูลและ camelCase · ทั้งสองฟังก์ชันเป็น pure
ตรวจผู้สมัคร ปฏิเสธ ID ซ้ำ และเรียงผลแบบคงที่ตามสถานะ คะแนนจากมากไปน้อย แล้วจึง ID ·
**ต้องส่งวงเงินที่เป็นบวก**

รูปผลลัพธ์ของสินเชื่อ (เงินและอัตราส่วนทุกตัวเป็นสตริงทศนิยม):

```json
{
  "product_id": "catalog-id",
  "match_score": 91,
  "match_reason": "Meets supplied numerical screening criteria; verify documents and provider conditions",
  "status": "eligible",
  "monthly_payment": "888.49",
  "period_installments": "1",
  "additional_period_debt_service": "888.49",
  "post_funding_dscr": "1.9425",
  "missing": [],
  "notice": "Demo ranking of supplied numerical criteria only; not credit approval or an investment offer. Verify documents and provider conditions.",
  "policy_version": "funding-match-demo-v1",
  "assumptions": ["Declared demo scoring and repayment assumptions"]
}
```

dict ที่คืนมามีสมมติฐานครบถ้วนระบุไว้ตอน runtime ·
การทดสอบความทนทาน DSCR หลังรับสินเชื่อ ใช้ค่างวดรายเดือนคูณจำนวนเดือนตามปฏิทิน
ที่เทียบเท่างวดบัญชีเดียวกัน โดยจำกัดไม่เกินอายุสัญญา · หนึ่งปีปฏิทินเต็มคือ 12 งวด
หนึ่งเดือนเต็มคือ 1 งวด และเดือนไม่เต็มคิดตามสัดส่วน ·
**นี่คือแบบจำลองความทนทาน ไม่ใช่การอนุมานวันชำระงวดแรกหรือตารางชำระของผู้ให้กู้**

ความสามารถชำระหนี้ใหม่ต้องผ่านค่าที่สูงกว่าระหว่าง `min_dscr` ของผลิตภัณฑ์
กับพื้นเดโมที่ 1.0 · คะแนนถ่วงน้ำหนัก: ความสามารถชำระหนี้ 45% เกรด 25%
ต้นทุนทางการเงิน 20% ความเร็วในการได้รับเงิน 10%

ผลิตภัณฑ์ประเภทเงินให้เปล่าไม่มีการชำระคืนและไม่เพิ่มภาระหนี้ ·
**CLAUDE ควรใช้ค่างวดศูนย์จาก matcher แทนการคิดเงินให้เปล่าอัตรา 0%
เป็นสินเชื่อแบบผ่อนคืน** · adapter เดิมไม่ถูกแก้ · เกณฑ์วงเงินแบบ hard ที่มีอยู่ยังคงอยู่
และเพิ่มการทดสอบความสามารถชำระหนี้หลังรับทุนเข้ามา

ผลลัพธ์ของนักลงทุนใช้ `investor_id` แทน `product_id` พร้อม match_score, match_reason,
status, missing, notice, policy_version และ assumptions · **ไม่มี** ฟิลด์ monthly_payment
หรือภาระหนี้ที่เสนอ · ขนาดการลงทุน sector เป้าหมาย เกรดขั้นต่ำ DSCR ที่มีอยู่ (ถ้ามี)
และระดับความเสี่ยงที่ยอมรับตามนโยบายเดโม ถูกคัดกรองแยกจากฝั่งหนี้ ·
ถ้าขาด sector เกรด หรือ horizon จะได้สถานะ requires_info ·
**ไม่มีการอนุมานมูลค่ากิจการ สัดส่วนที่ถูกลดทอน หรือการอนุมัติการลงทุน**

CLAUDE ต่อ `POST /api/match-funding` ได้ โดย map ผล snake_case เข้าฟิลด์
matchScore/matchReason ที่ frontend มีอยู่ ใช้ status ที่คืนมา และบันทึกลง
`funding_matches`/`investor_matches` · **CODEX ไม่ได้เพิ่ม route หรือการเข้าถึงฐานข้อมูล**

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE ต่อแล้ว · `POST /api/match-funding` คืนหนี้
> และทุนแยกกันพร้อมบันทึกผล และ `/api/v1/funding/options` ใช้คะแนนจาก matcher แล้ว ·
> พบว่าตอนแรกผม map `period_installments` ไปเป็น `totalRepayment` ซึ่งผิดความหมาย
> (เป็นจำนวนงวดใน**งวดบัญชี** สำหรับ stress test ไม่ใช่อายุสัญญา) แก้เป็น `term_months` แล้ว ·
> ส่วน `Investor` model ใช้ key `id` ไม่ใช่ `investor_id` ซึ่งเป็น key ของผลลัพธ์

## ส่วนที่ 3: การพยากรณ์ 30/60/90 วันแบบระบุวันที่

```python
from app.forecasting import forecast_cashflow, project_cash_events

def forecast_cashflow(events: list[dict] | None, *, opening_cash: Decimal | None,
                      as_of: date, minimum_cash_reserve: Decimal | None = None,
                      schedule_complete_through: date | None = None,
                      include_simulated: bool = False) -> dict: ...

def project_cash_events(*, as_of: date, sme_id: str, project_id: str | None = None,
                        receivables: list[dict] | None = None,
                        payables: list[dict] | None = None,
                        operating_costs: list[dict] | None = None,
                        installments: list[dict] | None = None) -> dict: ...
```

input ของการพยากรณ์รับแถว camelCase จาก `load_cash_events()` หรือ dict แบบ snake_case
ของ cash_events ได้ · **ต้องเรียก catalog ด้วย SME ID ที่ระบุเสมอ** เพราะ dict ของ catalog
ไม่มี tenant ID จึงตรวจขอบเขตย้อนหลังหลัง map ไม่ได้ ·
เงินสดต้นงวดนับความเคลื่อนไหวถึงวัน as_of แล้ว แถวที่เป็นอดีตหรือตรงวัน as_of
จะไม่ถูกนับซ้ำ · การคำนวณใช้เงินสดสุทธิปลายวัน **ไม่อนุมานลำดับภายในวัน** ·
**ไม่มีการแทรกความเคลื่อนไหวรายวันที่สร้างขึ้นเองระหว่างวันที่มี event**

key ของผลลัพธ์: `minimum_cash`, `minimum_cash_date`, `first_shortfall_date`,
`first_negative_date`, `first_reserve_breach_date`, `period_end_balances`
(key เป็น `"30"`, `"60"`, `"90"`), `timeline`, `missing`, `status` และ `assumptions` ·
เงินถูก serialize เป็นสตริงทศนิยม · การขาดมือหมายถึงต่ำกว่าเงินสำรองที่ระบุ
หรือเงินสดในธนาคารติดลบเมื่อไม่ได้ระบุเงินสำรอง ·
**เงินสำรองที่ไม่รู้ค่าจะเป็น null และไม่มีการยืนยันแบบเงียบ ๆ ว่าเป็นศูนย์**

`schedule_complete_through` **ต้องยืนยันโดยผู้เรียกอย่างชัดเจน** ·
ถ้าไม่ได้ยืนยันความครบ ฟิลด์พยากรณ์หลักของ horizon นั้นจะเป็น null และสถานะเป็น
insufficient_data · `conditional_minimum_cash`, `conditional_first_shortfall_date`
และ `conditional_period_end_balances` แสดงเฉพาะสิ่งที่ตารางที่ส่งมาบอกได้
**ห้ามนำไปแสดงเป็นการพยากรณ์ที่ครบถ้วน** · ตารางที่ขาดหรือว่างโดยไม่ได้ยืนยัน
จะถูกประกาศใน missing **ไม่กลายเป็นการพยากรณ์ที่เป็นศูนย์** ·
ตารางว่างที่ยืนยันว่าครบแล้วอย่างชัดเจน สามารถรักษาภาพเงินสดที่รู้ค่าไว้
โดยไม่มีความเคลื่อนไหวในอนาคตได้อย่างถูกต้อง

event เดโม 7 รายการ เล่นซ้ำ ณ วันที่ 2026-09-30 ด้วยเงินสดต้นงวด 5,000,000 บาท
และยืนยันความครบถึง 2026-12-29 ให้ผล: เงินสดต่ำสุด **3,370,000 บาท วันที่ 2026-10-25**
และยอดปลายงวด 30/60/90 = **3,370,000 / 3,370,000 / 5,770,000** ·
การรับชำระวันที่ 2026-11-30 เป็นวันที่ 61 จึง**ไม่ถูกนับในวันที่ 60**

DTO ของภาระที่คาดการณ์: `{id, due_date, amount, title, partner?}` ·
ส่งเฉพาะภาระต้นทางที่ยังค้างอยู่ · **หมวดที่ไม่รู้ค่า (`None`) ต่างจากหมวดที่รู้ว่าว่าง (`[]`)** ·
แถวที่เลยกำหนดต้องมีวันที่เลื่อนนัดจริง และจะถูกรายงานใน overdue/missing
**ไม่ถูกย้ายไปวันในอนาคตที่สร้างขึ้นเอง** · generator คืน
`{events, missing, overdue, status}` · แต่ละ event มี UUID ที่คงที่, sme_id, project_id,
event_date, day_index, type, title, amount, is_inflow, partner, status=projected,
impact_reason · day index สัมพัทธ์กับ as_of ที่ส่งมา ·
**ID คงเดิมเมื่อมีการแก้ยอดหรือวันครบกำหนด**

CLAUDE ควร upsert แถวที่สร้างขึ้นด้วย id แปลง event_date แบบ ISO เป็น DATE ตามต้องการ
และรักษาความสัมพันธ์กับ tenant/project · ไม่ต้องเพิ่มคอลัมน์ใด ·
**อย่ายืนยันว่าข้อมูลครบขณะที่หมวดต้นทางยังไม่รู้ค่า** · CODEX ไม่ได้อ่าน/เขียนฐานข้อมูล
หรือแก้ route · `build_analysis()` คง signature และรูปผลลัพธ์เดิม ·
ส่วน unknowns ของมันเปลี่ยนไปชี้ให้ผู้เรียกไปใช้ฟังก์ชันพยากรณ์นี้
แทนการบอกว่าโมดูลไม่มีอยู่

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE เปิด `GET /api/forecast` แล้ว
> ให้ผลตรงกับค่าที่ระบุไว้ข้างบนทุกตัว และหากไม่ส่ง `schedule_complete_through`
> ค่าหลักจะเป็น null พร้อมสถานะ insufficient_data ตามที่ออกแบบ ·
> ส่วน `project_cash_events()` ยังไม่ถูกต่อเข้า route (ยังไม่มีแหล่งข้อมูลลูกหนี้/เจ้าหนี้
> แบบระบุวันที่ในระบบ)

## ส่วนที่ 4: ข่าวอุตสาหกรรมและสัญญาณแบบคงที่

```python
from app.industry import fetch_industry_trends, analyze_industry_articles

async def fetch_industry_trends(sector: str, *, as_of: datetime,
                                 cached_articles: list[dict] | None = None,
                                 client: httpx.AsyncClient | None = None,
                                 force_refresh: bool = False) -> dict: ...
```

ใช้ GDELT DOC 2.0 ArticleList API แบบสาธารณะ ด้วย query ที่กำหนดต่อ sector
ไม่ต้องใช้ API key ค้นย้อนหลัง 7 วัน และจำกัดขนาด response/จำนวนรายการ ·
sector ที่รองรับ: food_processing, food, packaging, manufacturing, agriculture,
retail, logistics, services · **ไม่มีการส่งข้อมูลการเงินหรือตัวตนของ SME ไปยัง GDELT** ·
เอกสารผู้ให้บริการ: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/

ผลลัพธ์มี sector, as_of, status, source_status, source_error, retry_after_seconds,
articles, findings, missing, notice, assumptions · สถานะเป็น ok, empty, stale
หรือ unavailable · ข่าวใน cache ที่เพิ่งดึงถูกนำมาใช้ซ้ำได้ 5 นาที ·
วันที่ของแหล่งที่เก่ากว่า 72 ชั่วโมง หรือการดึงที่เก่ากว่า 1 ชั่วโมง ถือเป็น stale ·
ข้อมูลใน cache ที่เก่ากว่า 7 วันจะไม่ถูกคืน · ผู้ให้บริการล้มเหลวแต่มี cache ที่ใช้ได้
จะคืน stale · ล้มเหลวโดยไม่มีข้อมูลจะคืน unavailable พร้อม articles/findings ว่าง
และ missing=industry_news · **ไม่มีการ retry อัตโนมัติ** ·
HTTP 429 จะเปิดคำใบ้ retry ที่มีขอบเขต โดยมีค่าต่ำสุด 5 วินาที

ฟิลด์ของบทความ: id (SHA-256 ของ sector กับ URL แบบ canonical), provider,
source (host ของ URL), sector, url, title, published_at, observed_at, fetched_at,
date_source, status · **หัวข้อและลิงก์มาจากแถวของแหล่งข่าวเท่านั้น** ·
`seendate` ของ GDELT เก็บเป็น observed_at พร้อม date_source=gdelt_first_seen ·
**API ไม่ได้ระบุเวลาเผยแพร่จริง จึงให้ published_at เป็น null และใส่เรื่องวันที่เผยแพร่
ไว้ใน missing แทนการสร้างขึ้นเอง** · ลิงก์ติดตาม URL ซ้ำ และหัวข้อที่เผยแพร่ซ้ำแบบเดียวกัน
ถูกตัดออกอย่างคงที่

สัญญาณที่ได้เป็นการคัดกรองด้วยคำสำคัญในหัวข้อซึ่งประกาศไว้ชัดเจน
**ไม่ใช่การตีความบทความทั้งฉบับ และไม่ใช่การกล่าวอ้างเกี่ยวกับ SME รายใด** ·
finding เรื่องความเสี่ยง/โอกาสมี article_id, evidence_url, matched_terms,
สถานะความสดของข้อมูล และ notice · เส้นทาง rules ปัจจุบันไม่ต้องใช้เครดิต LLM ·
**หัวข้อข่าวย้อนหลังหรือที่ใช้ทดสอบ จะไม่ถูกใส่เป็นข่าวสด** ·
ข่าวไม่ถูกเพิ่มเข้า finding/เกรดทางการเงินโดยอัตโนมัติ

### ที่จัดเก็บที่ขอจาก CLAUDE

- `industry_news`: id TEXT primary key (64 ตัวอักษร hex), provider TEXT, source TEXT,
  sector TEXT, url TEXT, title TEXT, published_at TIMESTAMPTZ nullable,
  observed_at TIMESTAMPTZ, fetched_at TIMESTAMPTZ, date_source TEXT;
  unique(provider, sector, url) · raw JSONB เป็น optional สำหรับ metadata
  ของผู้ให้บริการเท่านั้น
- `industry_news_fetch_state`: provider เป็น primary key, last_attempt_at,
  last_success_at, next_allowed_at TIMESTAMPTZ, last_error TEXT ·
  ประสานการล็อก/จำกัดอัตราระดับผู้ให้บริการข้าม worker และ sector ·
  **อย่าดึงข้อมูลทุกครั้งที่ render หน้า**
- metadata ของ cache เก็บเป็นการสังเกตจริง · ความสดคำนวณใหม่ตอนตอบคำขอ
  และ**ห้ามเก็บเป็น flag ว่าสดถาวร**
- เก็บ finding ที่สรุปได้เฉพาะเมื่อจำเป็น โดยอ้าง article id และเวอร์ชันนโยบาย ·
  **ไม่มีการสร้างเนื้อหาบทความเต็ม บทสรุปที่แต่งขึ้น หรือค่าความเชื่อมั่นของ sentiment** ·
  ฟิลด์ summary/sentiment ที่เคยเสนอไว้ไม่จำเป็น

CODEX ไม่ได้สร้างตารางหรือ API route · การยิง GDELT จริงตอนพัฒนาได้ HTTP 429 ·
**การจัดการเมื่อแหล่งข่าวล่มเป็นเส้นทางที่ทดสอบแล้วว่าทำงาน ไม่ใช่หลักฐานว่าดึงหัวข้อข่าวสด
ได้สำเร็จ**

> **หมายเหตุ (อัปเดต 2026-10-15):** CLAUDE สร้างตาราง `industry_news` และเปิด
> `GET /api/industry/trends` แล้ว โดย upsert ด้วย id ของ fetcher ·
> **ยังไม่ได้ทำ 2 ข้อ:** (1) unique(provider, sector, url) — ปัจจุบันบังคับความไม่ซ้ำ
> ด้วย id ซึ่งเป็น hash ของ sector กับ URL อยู่แล้ว (2) ตาราง
> `industry_news_fetch_state` และการประสานจำกัดอัตราระดับผู้ให้บริการ —
> route ปัจจุบันจึงยังไม่มีการล็อกข้าม worker ควรเพิ่มก่อนใช้งานจริงหลายเครื่อง

## การตรวจสอบรอบสุดท้ายและงานต่อระบบที่เหลือ

- ชุดเทสต์เต็มรอบสุดท้ายผ่าน **308 tests** กับ Postgres · เทสต์ baseline 225 รายการเดิม
  ยังผ่าน โดยค่าที่คาดหวังซึ่งผูกกับสูตรถูกเปลี่ยนอย่างตั้งใจตามสมมติฐานออเดอร์จบชิ้น ·
  ยังมี deprecation warning ของ Starlette/httpx หนึ่งรายการ และ
  **ไม่ได้อัปเกรด dependency ที่ไม่เกี่ยวข้อง**
- เริ่ม Docker Compose โดยไม่ลบ volume · `backend/run.cmd` เปิด API ที่
  127.0.0.1:8000 · การตรวจผ่าน HTTP จริงได้ 200 ทั้ง health, docs และตัวอย่าง P0
  แบบออเดอร์จบชิ้น ซึ่งให้เงินทุนหมุนเวียน/ส่วนขาด **28,000 บาท**
- ทดสอบ matcher และ forecaster แบบ pure กับแถวสินเชื่อใน catalog ทั้ง 4 รายการ
  และ cash_events แบบระบุวันที่ 7 รายการจาก Postgres **โดยไม่เขียนฐานข้อมูล**
- `SWARM_RESEED_VALUES.json` มีค่า allocation v2 ที่แม่นยำสำหรับ PO-STP-2026-091
  คำนวณจากโปรไฟล์เดโมปัจจุบัน · ค่า allocation ใหม่ของ Rung Charoen คือ
  เงินทุนหมุนเวียน 105,000 บาท และส่วนขาด 45,000 บาท ·
  **ข้อมูล seed/DB ยังไม่ถูกอัปเดต CLAUDE ต้องแก้ seed แล้ว reseed**
- `OPENAI_API_KEY` และ `OPENAI_MODEL` ยังไม่ได้ตั้ง · ผู้ใช้ไม่มีเครดิต OpenAI
  จึง**ไม่มีการยิงคำขอ LLM จริงและไม่ได้อ้างว่าทดสอบแล้ว** ·
  มีเทสต์ mock ระดับ HTTP transport ใหม่ 9 กรณี ครอบคลุม JSON ที่ถูกโครงสร้าง,
  JSON/ผลลัพธ์โมเดลที่ผิดรูป, การปฏิเสธ, timeout, credential ล้มเหลว 401/403,
  429 เครดิต/จำกัดอัตรา และ 500 ฝั่งเซิร์ฟเวอร์ ·
  ตัวชี้วัด/เกรด/finding ทางการเงินไม่เปลี่ยน และโหมด rules ยังใช้ได้ ·
  อ้างอิง Structured Outputs:
  https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- การยิง news API จริงได้ HTTP 429 แล้วตามด้วย timeout · คำตอบรอบสุดท้ายเป็น
  unavailable โดยมีบทความ 0 รายการ บันทึกไว้ใน uploads ในเครื่อง ·
  **ไม่มีการอ้างว่าดึงหัวข้อข่าวสดหรือยืนยันวันเผยแพร่ได้**
- การเทียบคุณสมบัติหลังรับทุนใช้อัตราส่วนที่ยังไม่ปัดเศษ ·
  ค่าที่แสดงเป็น 1.5000 อาจยังต่ำกว่าเกณฑ์ 1.5 ก่อนปัดเศษได้ ·
  เหตุผลการปฏิเสธจะระบุความต่างนี้ แทนการแสดงการเปรียบเทียบที่ปัดเศษแล้วดูขัดแย้งกัน
- **ตรรกะใหม่ไม่ได้ถูกต่อเข้า endpoint ของ CLAUDE โดยอัตโนมัติ** · งานที่ต้องทำ:
  ส่งต่อ input ของ SWARM และดัก validation error; reseed; ต่อการจัดอันดับและบันทึกผล
  การจับคู่; กำหนดขอบเขต tenant/project ของ cash events และยืนยันความครบของ horizon;
  เพิ่มการเก็บข่าวและการประสานจำกัดอัตรา พร้อมต่อเข้า route
- ไม่มีการแก้ `src/`, adapters, catalog, repository, models, routers, RBAC,
  `schema.sql` หรือ `seed.sql` เทียบกับ baseline `94ad7ab`
