# SME SWARM Backend — คู่มือภาษาไทย

Backend ใช้ Python 3.12 ขึ้นไป ร่วมกับ FastAPI, Pydantic, openpyxl และ Decimal สำหรับตรวจข้อมูลและคำนวณการเงิน โค้ดอยู่ใน `D:\code-project\sme-finance-copilot\backend`

## ติดตั้งครั้งแรก

เปิด PowerShell แล้วรัน:

```powershell
Set-Location "D:\code-project\sme-finance-copilot"
python -m venv backend/.venv
python -m pip --python backend/.venv/Scripts/python.exe install -r backend/requirements.txt
```

หากสร้าง environment แล้วเกิดข้อผิดพลาดจาก `ensurepip` ให้ใช้ `python -m venv --without-pip backend/.venv` แล้วรันคำสั่งติดตั้ง dependencies ด้านบนอีกครั้ง

`requirements.txt` รวม dependencies ของ backend ปัจจุบัน ส่วน `requirements.lock.txt` บันทึกเวอร์ชันของชุด dependencies ที่ล็อกไว้

## เริ่มใช้งานและแก้ 404 ที่หน้าแรก

วิธีที่สั้นสุด ใช้ได้ทั้ง cmd.exe และ PowerShell โดยไม่ต้องตั้ง environment variable เอง เพราะสคริปต์อ่าน `backend\.env` ให้

```powershell
backend\run.cmd
```

เปลี่ยน port ด้วย `set PORT=8001 && backend\run.cmd` (cmd.exe) หรือ `$env:PORT="8001"; backend\run.cmd` (PowerShell)

หรือเรียก uvicorn ตรง ๆ พร้อม auto-reload

```powershell
Set-Location "D:\code-project\sme-finance-copilot"
& backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload --reload-dir backend/app
```

ระวัง: `DATABASE_URL=... command` เป็น syntax ของ bash ใช้ใน cmd.exe ไม่ได้ จึงควรตั้งค่าใน `backend\.env` แทน ถ้าแก้ `.env` ขณะ server รันอยู่ ต้องรีสตาร์ท server เพราะ `--reload` เฝ้าแค่ `backend/app`

- เปิด [หน้าเริ่มต้น](http://127.0.0.1:8000/) ระบบจะพาไป API Docs อัตโนมัติ
- เปิด [API Docs](http://127.0.0.1:8000/docs) เพื่อทดลองส่ง JSON หรืออัปโหลด Excel ผ่าน **Try it out**
- เปิด [สถานะบริการ](http://127.0.0.1:8000/health) เพื่อตรวจว่า backend ทำงานอยู่
- กด `Ctrl+C` เพื่อหยุดเซิร์ฟเวอร์

หากเซิร์ฟเวอร์เดิมแสดง `GET / 404 Not Found` ให้หยุดด้วย `Ctrl+C` แล้วรันใหม่ เพราะเวอร์ชันเดิมไม่มี route `/` เวอร์ชันปัจจุบันเพิ่ม route นี้แล้ว และ `--reload` จะโหลดโค้ดใหม่เมื่อแก้ไขไฟล์ใน `backend/app`

พอร์ต 8000 ให้บริการ backend และ API Docs ส่วน UI อยู่ที่ [เว็บไซต์โครงการ](https://sme-finance-copilot.vercel.app/) หรือเซิร์ฟเวอร์ frontend ที่รันแยกต่างหาก

## ทดสอบและทดลองคำนวณ

```powershell
& backend/.venv/Scripts/python.exe -m pytest -c backend/pytest.ini -q
$requestBody = Get-Content -Raw backend/examples/manual_input.json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/finance/calculate -ContentType application/json -Body $requestBody
```

ชุดทดสอบครอบคลุมการนำเข้าข้อมูล ข้อมูลผิดรูปแบบ ไฟล์ Excel เสีย สูตรการเงิน กรณีตัวหารศูนย์ การผ่อนชำระ HTTP routes และ CORS

ข้อมูลตัวอย่างเป็นข้อมูลจำลอง (`kind: simulated`) ได้ผลลัพธ์ FCF 50,000 บาท, Net Cash Flow 40,000 บาท, ROA 5.2632%, ROE 13.3333%, Liquidity 2, Funding Gap 70,000 บาท, DSCR 2 และ PMT 10,661.85 บาทต่องวด

## โครงสร้างโมดูล

| โมดูล | หน้าที่ |
| --- | --- |
| `app/schemas.py` | กำหนดชนิดข้อมูลและตรวจสมการบัญชี |
| `app/extraction.py` | อ่าน JSON และ Excel ตามแม่แบบ |
| `app/finance.py` | คำนวณตัวชี้วัดการเงินทั้ง 8 ตัว |
| `app/main.py` | HTTP API และ CORS |
| `app/routers/` | API สำหรับคำนวณและจัดทีม SWARM |
| `app/db.py`, `app/models.py`, `app/repository.py` | เชื่อมต่อและจัดเก็บข้อมูลในฐานข้อมูล |
| `db/schema.sql` | โครงสร้างตารางฐานข้อมูล |

## เส้นทาง API

| Method | Endpoint | ข้อมูลที่รับ / ผลลัพธ์ |
| --- | --- | --- |
| GET | `/` | เปลี่ยนเส้นทางไป `/docs` |
| GET | `/health` | สถานะบริการและสถานะการเปิดใช้ฐานข้อมูล |
| POST | `/api/v1/inputs/manual` | JSON ตาม FinancialInput เพื่อตรวจข้อมูล |
| POST | `/api/v1/inputs/excel` | multipart field `file` เพื่อตรวจข้อมูล |
| POST | `/api/v1/finance/calculate` | JSON ตาม FinancialInput เพื่อคำนวณ |
| POST | `/api/v1/finance/calculate/excel` | multipart field `file` เพื่อคำนวณ |

API เพิ่มเติม ได้แก่ `/api/calculate`, `/api/calculate/excel` และ `/api/swarm` โดยมีเส้นทาง `/api/v1/` รองรับด้วย ดูรูปแบบ request ใน API Docs เพราะ `/api/calculate` รับข้อมูลการเงินภายใน field `input` ต่างจาก `/api/v1/finance/calculate` ที่รับ FinancialInput โดยตรง

ข้อมูลไม่ผ่านการตรวจสอบจะได้ HTTP 422 เนื้อหาไฟล์เกินขนาดจะได้ HTTP 413 หากขาดข้อมูลเสริมสำหรับบางตัวชี้วัด จะได้ HTTP 200 พร้อม `insufficient_data` แต่ถ้าขาดข้อมูลบังคับ เช่น ยอดงบดุลหรือวันที่งวด จะได้ HTTP 422

## Task 1: การนำเข้าและตรวจข้อมูล

ข้อมูลบังคับ: `currency`, `kind`, `period_start`, `period_end`, `assets`, `liabilities`, `equity`

- สกุลเงินเป็น `THB` และ `kind` เป็น `actual`, `forecast` หรือ `simulated`
- วันที่เป็น ISO `YYYY-MM-DD` ยอดปลายงวดอ้างอิง `period_end` ยอดต้นงวดอ้างอิงก่อน `period_start`
- ตรวจสมการบัญชีด้วย `abs(assets - liabilities - equity) <= 0.01` ยอมให้คลาดเคลื่อนได้ไม่เกิน 0.01 บาท
- ส่วนของเจ้าของ กำไร และกระแสเงินสดติดลบได้ แต่สินทรัพย์ หนี้สิน และยอดค่าใช้จ่ายหรือยอดชำระต้องไม่ติดลบ
- สินทรัพย์และหนี้สินหมุนเวียนต้องไม่เกินยอดรวม เงินสดต้องไม่เกินสินทรัพย์หมุนเวียนถ้าระบุไว้ หรือสินทรัพย์รวมถ้าไม่ได้ระบุ
- ปฏิเสธชื่อ field ที่ไม่รู้จัก ชื่อซ้ำใน Excel ค่า boolean ในช่องตัวเลข NaN Infinity และข้อความตัวเลขที่มีสัญลักษณ์สกุลเงินหรือ comma
- จำนวนเงินรองรับไม่เกิน 20 หลัก รวมทศนิยมไม่เกิน 2 ตำแหน่ง แนะนำส่งเป็นข้อความ เช่น `"10000.25"` เพื่อรักษาความแม่นยำ
- กระแสเงินสดและยอดชำระหนี้ต้องอยู่ในงวดและสกุลเงินเดียวกัน ผู้ส่งต้องตรวจความสอดคล้องนี้ ระบบไม่แปลงงวดและไม่ปรับ ROA/ROE เป็นรายปีอัตโนมัติ

### แม่แบบ Excel

ใช้ `.xlsx` ที่มี worksheet ชื่อ `Financials` เฉพาะคอลัมน์ A และ B แถวแรกเป็น `field` และ `value`:

| field | value |
| --- | --- |
| currency | THB |
| kind | actual |
| period_start | 2026-09-01 |
| period_end | 2026-09-30 |
| assets | 1000000.00 |
| liabilities | 600000.00 |
| equity | 400000.00 |
| operating_cash_flow | 70000.00 |
| capital_expenditure | 20000.00 |
| loan.principal | 120000.00 |
| loan.annual_interest_rate | 0.12 |
| loan.periods | 12 |
| loan.payments_per_year | 12 |
| loan.timing | end |

เพิ่ม field แบบค่าเดี่ยวจาก FinancialInput เป็นแถวได้ ช่องข้อมูลเสริมที่เว้นว่างถือว่าไม่มีข้อมูล ชื่อ field ของเงินกู้ใช้ `loan.field` โดย `loan.periods` และ `loan.payments_per_year` ต้องเป็นเซลล์ตัวเลขจำนวนเต็ม วันที่รับทั้งเซลล์วันที่ Excel และข้อความ ISO

ห้ามใช้เซลล์สูตรหรือเซลล์ error ให้คัดลอกแล้ววางเป็นค่าก่อนนำเข้า ระบบอ่านเฉพาะ `Financials` ยังไม่รองรับ `.xls` การจับคู่คอลัมน์อัตโนมัติ หรือแบบฟอร์มบัญชีอื่น

ขีดจำกัด: ไฟล์ไม่เกิน 5 MiB, เนื้อหา ZIP หลังขยายไม่เกิน 25 MiB, ไม่เกิน 1,000 รายการใน ZIP และไม่เกิน 100 แถวข้อมูล

## Task 2: สูตรและความหมาย

| ตัวชี้วัด | สูตร / ความหมาย | หน่วย |
| --- | --- | --- |
| FCF | `operating_cash_flow - capital_expenditure` | บาท |
| Net Cash Flow | `operating_cash_flow + investing_cash_flow + financing_cash_flow` | บาท |
| ROA | `net_income / ((opening_assets + assets) / 2) * 100` | เปอร์เซ็นต์ของงวดที่ส่งมา |
| ROE | `net_income / ((opening_equity + equity) / 2) * 100` | เปอร์เซ็นต์ของงวดที่ส่งมา |
| Liquidity | `current_assets / current_liabilities` | อัตราส่วนสภาพคล่อง |
| Funding Gap | `max(0, working_capital_needed - usable_cash - buyer_deposit - committed_funding)` | บาท |
| DSCR | `cash_available_for_debt_service / (debt_principal_due + debt_interest_due)` | อัตราส่วน |
| PMT | ค่างวดคงที่ ใช้อัตราดอกเบี้ยต่องวดจาก `annual_interest_rate / payments_per_year` | บาทต่องวด |

`usable_cash = max(0, cash_balance - minimum_cash_reserve)`

FCF ใช้กระแสเงินสดจากการดำเนินงานหักรายจ่ายลงทุน โดย `capital_expenditure` ส่งเป็นยอดบวก ส่วน `investing_cash_flow` ต้องรวมรายจ่ายลงทุนแล้ว จึงไม่หักซ้ำใน Net Cash Flow

DSCR รับเงินสดก่อนชำระหนี้ผ่าน `cash_available_for_debt_service` โดยตรง ควรตรวจการจัดประเภทดอกเบี้ย ภาษี และการชำระหนี้ก่อนนำ CFO หรือ FCF มาใช้แทน

Funding Gap เป็นเงินทุนหมุนเวียนที่ขาดก่อนเริ่มงาน `cash_balance` ต้องเป็นเงินของร้านก่อนรวมมัดจำและเงินทุนที่ระบุแยก ส่วน `buyer_deposit` และ `committed_funding` ต้องเป็นแหล่งเงินคนละส่วนและพร้อมใช้ก่อนจ่ายค่าใช้จ่าย เพื่อไม่ให้นับเงินซ้ำ สูตรนี้ยังไม่ได้หาจุดขาดเงินสดสูงสุดจาก timeline รายวัน

PMT รับอัตราดอกเบี้ยเป็นสัดส่วน เช่น `0.12` หมายถึงดอกเบี้ยรายปี 12% ไม่รวมค่าธรรมเนียม เงินก้อนปลายสัญญา หรือการชำระไม่สม่ำเสมอ ดอกเบี้ยศูนย์ใช้ `principal / periods` ถ้า `timing` เป็น `beginning` จะนำค่างวดปลายงวดหารด้วย `(1 + periodic_rate)`

ตัวหารศูนย์ หรือค่าเฉลี่ยสินทรัพย์/ส่วนของเจ้าของไม่เป็นบวก จะได้ `undefined` หากขาดข้อมูลจะได้ `insufficient_data` พร้อม `missingFields` ระบบไม่แทนข้อมูลที่ขาดด้วยศูนย์ หากทราบว่าไม่มีมัดจำหรือเงินทุน ให้ส่งศูนย์อย่างชัดเจน

คำนวณด้วย Decimal ความละเอียด 50 หลัก จำนวนเงินปัดแบบ half up เป็น 2 ตำแหน่ง เปอร์เซ็นต์และอัตราส่วนเป็น 4 ตำแหน่ง ค่าใน JSON เป็นข้อความหรือ `null` เช่น:

```json
{
  "value": "2.0000",
  "unit": "ratio",
  "formula": "cash_available_for_debt_service / (debt_principal_due + debt_interest_due)",
  "status": "ok",
  "missingFields": [],
  "reason": null
}
```

ผลลัพธ์ระดับบนมี `data`, `kind`, `status`, `missing`, `asOf`, `analyzedAt`, `period` และ `unit` หากสถานะระดับบนเป็น `insufficient_data` แสดงว่ามีตัวชี้วัดที่ข้อมูลขาดหรือคำนวณไม่ได้ ให้ตรวจ `status` และ `reason` ของแต่ละตัว

## ฐานข้อมูลและการเชื่อม frontend

### เริ่ม PostgreSQL โดยไม่ต้องติดตั้ง psql

`docker-compose.yml` สั่งรันทุกไฟล์ใน `db/` อัตโนมัติตอน boot ครั้งแรก จึงไม่ต้องติดตั้ง PostgreSQL หรือ psql client ในเครื่อง

```powershell
docker compose -f backend/docker-compose.yml up -d
```

`backend/.env` (คัดลอกจาก `.env.example` ให้อัตโนมัติเมื่อรัน `run.cmd`) ถือค่า `DATABASE_URL` ไว้แล้ว ไฟล์นี้อยู่ใน `.gitignore` จึงไม่ถูก commit

`db/schema.sql` สร้างตารางทั้ง 9 ตาราง แล้ว `db/seed.sql` ใส่ข้อมูลตัวอย่าง: SME 3 ราย, ผลิตภัณฑ์สินเชื่อ 4 รายการ และคำสั่งซื้อ 1 รายการ โดยใช้ UUID คงที่ หลังแก้ไฟล์ใน `db/` ต้องลบ volume เพื่อให้ init script รันใหม่

```powershell
docker compose -f backend/docker-compose.yml down -v
docker compose -f backend/docker-compose.yml up -d
```

ถ้ามี PostgreSQL ติดตั้งอยู่แล้ว ใช้ `psql -d sme_swarm -f backend/db/schema.sql -f backend/db/seed.sql` ได้ผลเหมือนกัน

### ตารางที่เพิ่มใน Module 8

| ตาราง | เก็บอะไร |
| --- | --- |
| `users` | ผู้ใช้ + `role` (`sme_owner`, `investor`, `analyst`, `admin`) เป็นหลักยึดของ RBAC มี constraint บังคับว่า `sme_owner` ต้องผูก `sme_id` และ `investor` ต้องผูก `investor_id` |
| `investor_profiles` | นักลงทุน/ผู้ให้ทุนที่ลงเงินกับโครงการโดยตรง (angel, VC, ภาครัฐ) แยกจาก `funding_products` ที่เป็นผลิตภัณฑ์สินเชื่อ |
| `investor_matches` | ผลการจับคู่ SME กับนักลงทุนพร้อมคะแนนและเหตุผล |

การบังคับสิทธิ์ (enforcement) ยังไม่ได้ผูกกับ route ใด เพราะจะทำให้ frontend ที่เรียก API อยู่ตอนนี้ถูกปฏิเสธทันที schema พร้อมแล้ว เหลือขั้นเพิ่ม dependency ตรวจ role ตอนที่ตกลงเรื่อง auth กันแล้ว

`schema.sql` เป็น idempotent ทั้งไฟล์ (`IF NOT EXISTS` ทุกจุด) รันซ้ำบน DB ที่มีข้อมูลอยู่ได้เพื่อ apply ตารางใหม่

```powershell
docker exec -i sme_swarm_db psql -U postgres -d sme_swarm -v ON_ERROR_STOP=1 < backend/db/schema.sql
```

### Endpoint ที่เพิ่ม (Module 8 + Module 6)

| Method | Endpoint | Input | หมายเหตุ |
| --- | --- | --- | --- |
| POST | `/api/upload` | multipart workbook + `sme_id?` | เรียก parser ของ Codex แล้วคืน metrics + unit economics + เกรด A-D บันทึก `financial_records` และ `upload_events` โดย**ไม่เก็บไฟล์** เก็บแค่ชื่อ ขนาด และ SHA-256 ไฟล์ที่ parse ไม่ผ่านก็ถูกบันทึกเป็น `rejected` พร้อมเหตุผล |
| POST | `/api/simulate` | `{ input, scenario, swarm? }` | Module 6 เทียบ Plan A กับ Plan B |

### `/api/simulate` — ตัวแปรที่ปรับได้

ฝั่งรายได้: `revenue_change_pct`, `units_sold_change_pct`, `unit_price_change_pct`
ฝั่งต้นทุน: `cost_change_pct` (เหมารวม) และตัวเจาะจง `cogs_change_pct`, `operating_expenses_change_pct`, `fixed_costs_change_pct`, `variable_cost_change_pct` — **ตัวเจาะจงชนะตัวเหมารวมในฟิลด์ของตัวเอง**
กระแสเงินสดและเงินทุน: `collection_delay_days`, `extra_funding`
หนี้: `loan` (แทนเงื่อนไขเดิม), `drop_loan`
ทีมร้านค้า: `remove_shops`, `add_shops`

สมมติฐานที่ engine ใช้จะถูกส่งกลับใน `assumptions` ทุกครั้ง ไม่มีการปรับค่าแบบเงียบ ๆ:
- กำไรถูกคำนวณใหม่จากบรรทัด P&L ที่ถูก scale แล้ว `net_income` ขยับตามส่วนต่าง
- ส่วนต่างกำไรถือเป็นเงินสดในงวดเดียวกัน จึงขยับ `operating_cash_flow`, `cash_available_for_debt_service` และ `cash_balance` ด้วย **ถ้าไม่ทำข้อนี้ DSCR จะไม่ขยับเลย และ DSCR คิดเป็น 35% ของเกรด ทำให้ simulator ไร้ประโยชน์**
- `extra_funding` ถือเป็นการกู้ จึงเพิ่มทั้ง `assets` และ `liabilities` พร้อมกัน สมการบัญชีจึงยังสมดุล
- ถ้า `cash_balance` ติดลบจะถูกตรึงที่ 0 และบันทึกไว้ใน `notes` ว่าขาดเท่าไร

ผลลัพธ์มี `delta.summary.verdict` เป็น `better` / `worse` / `mixed` / `unchanged` พร้อมรายชื่อตัวชี้วัดใน `improved` และ `worsened` โดยตัวชี้วัดที่ "ยิ่งต่ำยิ่งดี" (`funding_gap`, `total_cost`, `cost_per_unit`, `breakeven_units`, `debt_ratio`, `pmt`) ถูกตีความกลับทางให้ถูกต้อง

ถ้า scenario ดันงบออกนอกสัญญา input (เช่น เงินสดเกินสินทรัพย์หมุนเวียน) จะได้ 422 พร้อมชื่อฟิลด์ที่ผิด ไม่ส่งตัวเลขการเงินกลับไปใน error

### Adapter สำหรับ contract เดิมของ frontend (P0)

`src/api/client.ts` เรียก 16 เส้นทางใต้ `/api/v1` ซึ่งเดิม **404 ทั้งหมด** ทำให้ปลดจาก mock mode ไม่ได้เลย รอบนี้ทำ 5 เส้นทางที่ engine มีข้อมูลพร้อมแล้ว

| Endpoint | สร้างจาก |
| --- | --- |
| `GET /api/v1/overview` | `calculate_financials` + `calculate_business_metrics` + `findings` จาก `build_analysis` |
| `GET /api/v1/health/indicators` | `build_analysis().indicators` ซึ่งตรงกับ type `HealthIndicator` อยู่แล้ว |
| `GET /api/v1/ai/explain?page=` | `build_analysis().explanation` ตรงกับ type `AIResponse` |
| `GET /api/v1/cost/breakdown` | `calculate_business_metrics` + บรรทัดต้นทุนใน input |
| `GET /api/v1/swarm/proposal` | โครงการที่อัปเดตล่าสุดใน `swarm_projects` + `swarm_allocations` |

ทุกเส้นทางเสิร์ฟทั้ง `/api/*` และ `/api/v1/*` เหมือน router อื่น

**ลำดับการลงทะเบียน router มีผล:** `frontend_router` ต้องมาก่อน `swarm_router` ไม่งั้น `/swarm/{order_ref}` จะจับคำว่า `proposal` เป็นเลขออเดอร์แล้วตอบ 404

**ที่มาของข้อมูล** ตอบตามลำดับนี้และบอกไว้ในฟิลด์ `source` ทุกครั้ง:
1. `?sme_id=<uuid>` + มี `DATABASE_URL` → งบล่าสุดของ SME รายนั้น พร้อมงบงวดก่อนหน้าเพื่อคำนวณส่วนต่างจริง (`source: "stored_record"`)
2. ไม่ส่ง `sme_id` → ชุดข้อมูลตัวอย่าง `examples/analysis_input.json` (`source: "demo_dataset"`)

ส่ง `sme_id` ที่ไม่มีในระบบจะได้ 404 ไม่ใช่เงียบ ๆ ตอบข้อมูลตัวอย่างกลับไป

**กฎที่ยึดตลอด: ไม่สร้างตัวเลขขึ้นมาเอง** ชุดข้อมูลที่ไม่มีจะส่งค่าว่างและประกาศชื่อไว้ใน `missing` แล้วปล่อยให้ UI แสดงสถานะ insufficient-data ของตัวเอง แทนที่จะโชว์เลขที่ดูดีแต่อธิบายไม่ได้
- `weeklyTrend: []` + `missing: ["weekly_cash_movements"]` — input contract ไม่มีความเคลื่อนไหวรายวัน
- `trend: []` ของทุก indicator + `missing: ["indicator_history"]` — มีงบงวดเดียว
- `investmentPlans: []` + `missing: ["investment_cash_schedule"]` — NPV/IRR/payback ต้องมีตารางกระแสเงินสดลงทุน
- `lastPeriodDiff` เป็น 0 ทั้งหมด + `missing: ["previous_period_statement"]` เมื่อไม่มีงบงวดก่อน

`status` ผูกกับ `missing` ตรง ๆ: ถ้า `missing` ไม่ว่าง `status` จะเป็น `insufficient_data` เสมอ ไม่มีกรณีอ้าง `ok` ทั้งที่ข้อมูลขาด

`/api/v1/ai/explain` ส่ง `aiMode` กลับด้วย (`rules` หรือ `model`) เพื่อไม่ให้ UI ทำเหมือนเรียกโมเดลไปแล้วทั้งที่คำตอบมาจาก rule

`totalCost`/`totalProfit` ใน `/swarm/proposal` คำนวณจาก `sme_profiles.cost_per_unit` ของแต่ละร้าน ถ้าร้านใดไม่มีค่านี้จะคืน 0 พร้อม `missing: ["shop_unit_cost"]` ไม่นับแบบครึ่ง ๆ

### เชื่อม Frontend แบบไม่แตะ UI

`src/services/api.ts` เป็นไฟล์ใหม่ล้วน ไม่ import component ไม่แตะ CSS/Tailwind/layout และ **ไม่มีใคร import มัน** Vite จึง tree-shake ออกจาก bundle ทั้งหมด ยืนยันด้วยการ build: hash ของ `index-*.js` และ `index-*.css` เท่าเดิมทุกตัว และ module count เท่าเดิมที่ 1955

ของเดิม `src/api/client.ts` (client ที่ใช้ mock) ไม่ถูกแก้แม้แต่บรรทัดเดียว หน้าไหนจะต่อ backend จริงก็เรียกฟังก์ชันหรือ hook จากไฟล์ใหม่แล้วส่งค่าเข้า state ของตัวเอง

ฟังก์ชัน: `health`, `uploadStatement`, `calculate`, `analyze`, `buildSwarm`, `getSwarm`, `simulate`
Hooks: `useBackend` (ยกเลิก request เก่าอัตโนมัติเมื่อ deps เปลี่ยนหรือ unmount), `useBackendHealth`, `useBackendAction` (สำหรับ POST ที่ผู้ใช้กดเอง)

ตั้ง base URL ผ่าน `VITE_BACKEND_URL` ค่าเริ่มต้นคือ `http://127.0.0.1:8000`

### Connection pool

asyncpg ผูก connection ไว้กับ event loop ที่เปิดมัน จึงนำ connection จาก pool ไปใช้ข้าม loop ไม่ได้ ซึ่งเป็นสิ่งที่ `TestClient` (สร้าง loop ใหม่ทุก request) และ serverless ทำ ค่าเริ่มต้นจึงเป็น `NullPool` คือเปิด connection ใหม่ต่อหนึ่ง session หากรันหลัง uvicorn ที่อยู่ยาว ให้ตั้ง `DB_POOL=queue` เพื่อใช้ pool จริง

หากไม่กำหนด `DATABASE_URL` ระบบทำงานโดยไม่บันทึกลงฐานข้อมูล เส้นทางที่อ่านข้อมูลที่บันทึกไว้จำเป็นต้องเปิดใช้ฐานข้อมูล ส่วน routers สำหรับคำนวณและ SWARM สามารถบันทึกผลเมื่อกำหนดฐานข้อมูลและส่ง `persist: true` ได้ ระบบไม่เก็บไฟล์ Excel ต้นฉบับ

ต้องเพิ่ม adapter ของ frontend สำหรับส่งข้อมูลเข้า POST และแปลงข้อความตัวเลขกับสถานะรายตัวชี้วัดให้เข้ากับ UI ก่อนใช้งานจริง การตั้ง `VITE_USE_MOCK=false` เพียงอย่างเดียวไม่พอ ควรเปิด mock ไว้จน endpoint ที่ dashboard ต้องใช้พร้อม

CORS อนุญาต localhost พอร์ต 3000/5173 และเว็บไซต์ frontend ที่ deploy แล้ว เปลี่ยนได้ผ่าน `CORS_ORIGINS` โดยคั่นหลาย URL ด้วย comma ก่อนให้บริการข้อมูลการเงินจริงผ่านอินเทอร์เน็ต ต้องตั้งการยืนยันตัวตนและจำกัดขนาด request ที่จุดรับเข้า โดย CORS ไม่ใช่การยืนยันตัวตน

## วิเคราะห์ธุรกิจและเกรด A–D

เพิ่มกำไร ต้นทุน จุดคุ้มทุน ROI และเกรด A–D แล้ว โดยเกรดใช้เกณฑ์เดโม `demo-v1` ปรับแต่ละองค์ประกอบเป็นคะแนน 0–100 ก่อนถ่วงน้ำหนัก 35% / 30% / 20% / 15% ข้อมูลที่ขาดไม่ถูกแทนด้วยศูนย์ และจะไม่ให้เกรดถ้ามีองค์ประกอบที่คำนวณไม่ได้ ดูสูตรและสัญญา API ใน [ANALYSIS_CONTRACT.md](docs/ANALYSIS_CONTRACT.md)

```powershell
$financialInput = Get-Content -Raw backend/examples/analysis_input.json | ConvertFrom-Json
$analysisBody = @{ input = $financialInput; use_llm = $false } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/analyze -ContentType application/json -Body $analysisBody
```

ตัวอย่างได้เกรด **B / 75.00**, กำไรสุทธิ 50,000 บาท, จุดคุ้มทุน 1,154 หน่วย และ ROI 15% API ยังคืนเหตุผล จุดแข็ง จุดอ่อน ความเสี่ยง และหลักฐานที่อ้างอิงตัวเลขจริงจากข้อมูลที่ส่งมา

## ซ้อมเดโม backend โดยคงดีไซน์ frontend เดิม

Frontend ถูกคืนให้ตรงกับ commit ต้นฉบับ `73649fc` แล้ว รวมหน้า Health, AI Panel, API client และ Vite configuration ไม่มีช่อง JSON ปุ่มอัปโหลด หรือกล่องเกรดที่เพิ่มเข้าไปในหน้าเว็บอีกต่อไป

1. เปิด backend ที่พอร์ต 8000 ด้วย `backend\run.cmd`
2. เปิด `http://127.0.0.1:8000/docs`
3. ใช้ `GET /api/analysis/example` อ่านข้อมูลตัวอย่างที่ระบุ `kind: simulated`
4. ส่งข้อมูลตัวอย่างภายใน field `input` ไป `POST /api/analyze` โดยตั้ง `use_llm: false` ต้องได้เกรด **B / 75.00**
5. ดาวน์โหลดแม่แบบจาก `GET /api/analysis/template.xlsx` แล้วอัปโหลดผ่าน `POST /api/analyze/excel` ต้องได้ผลตรงกับ JSON
6. ลองเปลี่ยน `equity` เป็น `"1"` แล้วส่งใหม่ ต้องได้ HTTP 422 เพราะงบบัญชีไม่สมดุล

ทดสอบหน้าเว็บดีไซน์เดิมได้โดยเปิด PowerShell อีกหน้าต่างแล้วรัน `pnpm dev` จากโฟลเดอร์โครงการ หน้าเว็บยังใช้พฤติกรรม mock/API adapter เดิมของทีม Frontend

หาก backend เดิมรันอยู่ก่อนอัปเดตโค้ด ให้หยุดแล้วเริ่มใหม่ หรือใช้ `backend\run.cmd --reload --reload-dir backend/app`

สูตร การให้เกรด และ API วิเคราะห์ยังอยู่ครบใน `backend/app` การเชื่อม API ใหม่เข้าหน้าเว็บต้องผ่าน fetch hooks หรือ props ของทีม Frontend โดยคง tags, styling และ layout เดิม ส่วน POST สำหรับวิเคราะห์ยังไม่ได้ผูกกับ UI ต้นฉบับ การ push โค้ด frontend ไม่ได้ deploy FastAPI ให้อัตโนมัติ

## ทางเลือกใช้ AI Model

โหมดเริ่มต้นเป็น **Rules-based** ใช้งานได้ทันทีโดยไม่ต้องมี API key หากต้องการให้โมเดลช่วยจัดลำดับประเด็น ให้เพิ่ม `OPENAI_API_KEY` และ `OPENAI_MODEL` ใน `backend/.env` แล้ว restart backend จากนั้นส่ง `use_llm: true` ไป API วิเคราะห์ ห้ามนำ API key ไปใส่ตัวแปรที่ขึ้นต้น `VITE_`

โมเดลเลือกเฉพาะประเด็นที่ backend คำนวณและตรวจไว้แล้ว ไม่แก้สูตร ตัวเลข เกรด หรือหลักฐาน หากยังไม่มี key หรือโมเดลตอบผิด/timeout ระบบจะกลับมาใช้กฎพร้อมแจ้งสาเหตุ ไม่แสร้งว่าเรียกโมเดลสำเร็จ การเรียกโมเดลจริงยังต้องทดสอบด้วย key ที่ใช้งานได้

งานถัดไปคือคาดการณ์เงินสดจากรายการรับ–จ่ายที่มีวันที่ การจับคู่ทุน และ Simulator ส่วนการยืนยันค่าใช้จ่ายผิดปกติต้องมีข้อมูลรายการหรือประวัติเปรียบเทียบก่อน ระบบจะระบุข้อมูลเหล่านี้เป็นสิ่งที่ยังไม่ทราบ

เอกสารอ้างอิง: [คู่มืออ่านงบการเงินของ SEC](https://www.sec.gov/investor/pubs/begfinstmtguide.htm), [การวิเคราะห์สินเชื่อธุรกิจของ Federal Reserve](https://www.federalreserve.gov/boarddocs/supmanual/us_branches/3000_2.pdf)
