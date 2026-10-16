# งานที่มอบหมายให้ CODEX — 2026-10-16 (ส่งต่องานหนึ่งวัน)

Claude ลาจนถึงวันเสาร์ วันนี้คุณรับผิดชอบทั้งสองส่วน ได้แก่ โมดูลคณิตศาสตร์และ AI ตามปกติ รวมถึงส่วนของ Claude ได้แก่ ฐานข้อมูล เส้นทาง API ตัวแปลงข้อมูล และการเชื่อมต่อ frontend วันนี้ไม่มีข้อจำกัดจากการแบ่งงาน แต่ยังต้องทำตามกฎ UI ด้านล่าง

คอมมิตฐาน: `82a355f` บน `main` ขณะเขียนเอกสารนี้ working tree สะอาดและตรงกับ origin

> **เพิ่มขอบเขตการอนุญาต 2026-10-16:** ผู้ใช้ตอบชัดเจนว่า “อนุญาต” ให้เพิ่มการเชื่อมต่อใน OverviewPage.tsx, SimulatorPage.tsx และ SwarmPage.tsx รวมถึงแก้ข้อความชนิด/ขนาดไฟล์ในหน้า Import ขณะนี้อนุญาตเฉพาะไฟล์ `src/api/client.ts`, `src/features/import/ImportPage.tsx`, `src/features/overview/OverviewPage.tsx`, `src/features/simulator/SimulatorPage.tsx` และ `src/features/swarm/SwarmPage.tsx` โดยคงสไตล์/เลย์เอาต์/โครงสร้าง/เส้นทางเดิม ข้ออนุญาตนี้แทนข้อจำกัดสองไฟล์ใน §4 ซึ่งบันทึกโจทย์เดิมไว้ ผลการวัดปัจจุบันและส่วน UI สาธิตที่ยังไม่แก้อยู่ใน `CODEX_HANDOFF.md` หัวข้อ 2026-10-16 ตัวเลขที่คอมมิต `82a355f` ด้านล่างเป็นข้อมูลย้อนหลัง

---

## 1. อ่านเอกสารตามลำดับนี้ก่อน

| ลำดับ | ไฟล์ | เหตุผล |
| --- | --- | --- |
| 1 | `backend/docs/AI_DEVELOPMENT_GUIDELINES.md` | กฎพื้นฐาน การแบ่งบทบาท และ §4 ซึ่งเป็นรายการงานคงเหลือตามผลกระทบ ส่วน §3 แสดงจำนวนปัจจุบัน |
| 2 | `backend/docs/progress.md` | บันทึกงานของ Claude รอบล่าสุดอยู่ด้านบน ตารางสถานะปัจจุบันอยู่ต้นไฟล์ ส่วนตัวเลขของแต่ละรอบเป็นข้อมูลย้อนหลังโดยตั้งใจ |
| 3 | `backend/docs/CODEX_HANDOFF.md` | บันทึกส่งต่องานของคุณ เรียงรายการใหม่ไว้ด้านบน รวมสิ่งที่ขอให้ Claude เชื่อมต่อและสิ่งที่ Claude ส่งกลับ |
| 4 | `backend/docs/ANALYSIS_CONTRACT.md` | สัญญาของ `build_analysis` รวมกฎรับ forecast และนโยบาย `expense-history/v1` |
| 5 | `backend/docs/DEPLOY.md` | ขั้นตอน Railway และรายการตรวจสอบก่อนทดสอบ อ่านหัวข้อ “เช็กลิสต์ก่อนทีม frontend มาทดสอบ” ก่อนแก้สิ่งที่ผู้ทดสอบจะใช้ |
| 6 | `backend/docs/LIVE_PROVIDER_VERIFICATION.md` | สิ่งที่ยืนยันได้และยังยืนยันไม่ได้เกี่ยวกับผู้ให้บริการข่าวจริง |

**อย่าเชื่อสถานะจากความจำ รวมถึงข้อความในเอกสารนี้** เอกสารพยายามรักษาความถูกต้อง แต่โค้ดคือแหล่งข้อมูลจริง ตรวจสอบก่อนนำไปใช้อ้างอิง

---

## 2. วิธีเรียกใช้งาน

ใช้ Windows `cmd.exe` คำสั่งรูปแบบ `VAR=x command` ใช้ไม่ได้ที่นี่ การตั้งค่าอยู่ใน `backend\.env`

```text
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
python -m pytest -c backend/pytest.ini -q
```

ยืนยันที่ `82a355f`: ผ่าน **477 รายการ + ข้าม 3 รายการ** เมื่อใช้ PostgreSQL และผ่าน **378 รายการ + ข้าม 102 รายการ** เมื่อไม่มีฐานข้อมูล มี 34 เส้นทางใต้ `/api/*` และให้บริการซ้ำใต้ `/api/v1/*` มี 27 ตาราง โดย `schema.sql`, `seed.sql` และ `seed_obligations.sql` รันซ้ำได้

UUID เดโมเป็นค่าคงที่: Baan Suan `11111111-1111-4111-8111-111111111111` (เกรด A, สุขภาพดี), Rung Charoen `22222222-2222-4222-8222-222222222222` (เกรด D, มีปัญหาการเงิน, ขาดเงินทุน 45,000), Sahai Packing `33333333-3333-4333-8333-333333333333`, ออเดอร์เดโม `PO-STP-2026-091`

---

## 3. สถานะจริงของฟีเจอร์ทั้งแปด

ขณะนี้ทั้งแปดฟีเจอร์ตอบสนองผ่าน HTTP แล้ว Claude ตรวจสอบทุกรายการกับแอปที่กำลังทำงานบน `82a355f` ตัวเลขเหล่านี้มาจากการวัดจริง

| # | โมดูล | Endpoint | สถานะ |
| --- | --- | --- | --- |
| 1 | ตรวจข้อมูล / Excel | `POST /api/upload` | **ทำงาน** `GET /api/analysis/template.xlsx` ได้ 200 และ 5,781 ไบต์; ส่งไฟล์กลับไป `/api/upload` ได้ 200 พร้อม metrics; ไฟล์เสียได้ 422 และข้อความ `Invalid or unreadable .xlsx workbook` |
| 2 | Math engine + เกรด A–D | `POST /api/calculate`, `POST /api/v1/finance/calculate` | **ทำงาน** ยืนยันค่า `liquidity = 0.7500` จากข้อมูลที่สร้างขึ้นตรวจสอบเอง |
| 3 | AI analyst + forecast | `POST /api/analyze`, `GET /api/forecast` | **ทำงาน** ส่ง `findings`, `grading`, `indicators`, `explanation`, `aiMode`; forecast มี `projectedFromObligations` |
| 4 | จับคู่เงินทุน | `POST /api/match-funding`, `GET /api/v1/funding/options` | **ทำงาน** แยกหนี้กับทุน และ Rung Charoen ได้ช่องว่างเงินทุนจริง 45,000 |
| 5 | จัดสรร SWARM | `POST /api/swarm` | **ทำงาน** รวมการตรวจสิทธิ์ตามทรัพยากรและ `audit.eligibility` ของแต่ละร้าน |
| 6 | จำลองสถานการณ์ | `POST /api/simulate` | **ทำงาน** มีตัวแปรปรับ 11 รายการ และ Plan A/B |
| 7 | แนวโน้มอุตสาหกรรม | `GET /api/industry/trends` | **เส้นทางทำงาน แต่ผู้ให้บริการไม่ทำงาน** ตอบ `sourceStatus: "unavailable"`, `sourceError: "timeout"` เพราะ TLS handshake ของ GDELT หมดเวลาจากเครือข่ายนี้ เป็นข้อจำกัดสภาพแวดล้อม ไม่ใช่บั๊กโค้ด |
| 8 | Backend / DB / RBAC | 34 เส้นทาง, 27 ตาราง | **ทำงาน** รวม token ที่ลงนาม, รหัสผ่าน scrypt, การจำกัดการ login และการเพิกถอน token ราย session/ทั้งบัญชี |

ดังนั้นฟีเจอร์ทั้งแปดไม่ได้เสีย แต่ยังเรียกจากหน้าเว็บไม่ได้ ความแตกต่างนี้คือประเด็นทั้งหมดใน §4

---

## 4. 🔴 รายงานปัญหาจากผู้ใช้ — ตรวจแล้ว ต้นเหตุไม่ได้อยู่ตรงที่คาด

ผู้ใช้รายงานตามข้อความเดิม:

> ตอนนี้คือระบบมันเหมือนยังลากไฟล์มาใส่ไม่ได้ ละรันคำนวณต่อไม่ได้ด้วย ต่อให้กรอกข้อมูลเองก้ไม่คำนวณให้อะ
> แล้วช่องกรอกข้อมูลไม่ครบ ประมาณนี้

Claude ตรวจสอบก่อนเขียนงานนี้ และพบว่า **backend ไม่ใช่ต้นเหตุ** โดยยืนยันได้สามข้อ:

1. **`src/api/client.ts` ไม่มีเส้นทางเขียนข้อมูลเลย** มี wrapper `GET` อย่างเดียว 16 รายการ ไม่มี upload, calculate, analyze หรือ `POST` สำหรับกรอกข้อมูลด้วยตนเอง frontend จึงเรียก `/api/upload`, `/api/calculate` หรือ `/api/analyze` ไม่ได้ เพราะไม่มีฟังก์ชันเรียก
2. **`src/features/import/ImportPage.tsx` เป็นหน้าจำลอง** มี 280 บรรทัดและไม่มีการเรียกเครือข่าย สถานะ `isAnalyzing` / `analysisStep` เพียงแสดงลำดับความคืบหน้าแล้วหยุด การลากไฟล์ไม่เคยเชื่อมต่อกับระบบ จึงใช้ไม่ได้ไม่ว่า backend จะทำงานหรือไม่
3. **ทุกการเรียกจาก client อยู่หลัง `USE_MOCK`** ซึ่งกำหนดเป็น `import.meta.env.VITE_USE_MOCK !== "false"` จึงเปิดโหมดจำลองเป็นค่าเริ่มต้น แม้เส้นทางอ่านทั้ง 16 รายการก็ใช้ fixture ที่ฝังไว้จนกว่าจะตั้งตัวแปรเป็นข้อความ `"false"` ตรงตัว

ข้อความ “ช่องกรอกข้อมูลไม่ครบ” เป็นอาการเดียวกันจากฝั่งฟอร์ม ก่อนหน้านี้ `FinancialInput` บังคับ **7 ฟิลด์** ได้แก่ `currency`, `kind`, `period_start`, `period_end`, `assets`, `liabilities`, `equity` และมีฟิลด์ทางเลือกอีก **31 รายการ** ฟิลด์ทางเลือกเหล่านี้เป็นข้อมูลหลักของ dashboard และเดิม engine ส่ง `null` เมื่อขาดข้อมูล โดยไม่สมมติว่าเป็นศูนย์ ตัวอย่างเช่น หากส่ง `revenue`, `cost_of_goods_sold` และ `operating_expenses` แต่ไม่ส่ง `interest_expense` กับ `tax_expense` ค่า `net_profit` จะเป็น `null` อย่างถูกต้อง เพราะข้อมูลไม่พอคำนวณ ฟอร์มที่เก็บเพียงไม่กี่ช่องจึงแสดง dashboard ว่างได้ตามที่ผู้ใช้พบ

### ⚠️ แก้ปัญหานี้ไม่ได้หากไม่แก้ไฟล์ใต้ `src/` — และได้รับอนุญาตแล้ว

ส่วนที่ขาดอยู่ใน `src/` ซึ่งกฎเดิมห้ามแก้ ผู้ใช้ได้รับคำถามโดยตรงและ **อนุญาตข้อยกเว้นแบบจำกัดในแชตเมื่อ 2026-10-15** โดยตอบว่า:

> อนุมัติให้ Codex แก้ src/api/client.ts กับ src/features/import/ImportPage.tsx
> ได้เท่าที่เป็นการ wiring ห้ามแตะดีไซน์

เรื่องนี้สรุปแล้ว ไม่ต้องถามซ้ำ การปรับดีไซน์ยังไม่ได้รับอนุญาต อย่าขยายขอบเขตเอง

**แก้ได้เฉพาะห้าไฟล์ต่อไปนี้ และแก้เพื่อเชื่อมระบบเท่านั้น:**

- `src/api/client.ts` — เพิ่ม wrapper `POST`: upload แบบ multipart, calculate, analyze และข้อมูลกรอกเอง ทำตามรูปแบบฟังก์ชัน 16 รายการเดิม และคงการทำงานของ `USE_MOCK` เพื่อให้โหมดจำลองยังใช้ได้เมื่อไม่มี backend
- `src/features/import/ImportPage.tsx` — ผูกฟอร์มกับ state จริง เพิ่มช่องข้อมูลที่ขาด และเรียกฟังก์ชัน client ใหม่เมื่อส่งข้อมูล
- `src/features/overview/OverviewPage.tsx`, `src/features/simulator/SimulatorPage.tsx`, `src/features/swarm/SwarmPage.tsx` — ทำ wiring ตามที่ได้รับอนุญาต โดยคงหน้าตาและโครงสร้างเดิม

ห้ามเปลี่ยน CSS, Tailwind classes, สี, ระยะห่าง, layout, โครงสร้าง component, routing หรือข้อความที่แสดงอยู่เดิม เพิ่มได้เฉพาะ label ที่จำเป็นสำหรับฟิลด์ใหม่ ห้ามแตะไฟล์อื่นใต้ `src/`

fingerprint ของ bundle จะเปลี่ยน ซึ่งเป็นสิ่งที่คาดไว้ การ build ก่อนหน้าทั้งหมดมี `1955 modules` และไฟล์ `index-DEindwiw.css` / `index-DrkwTzbk.js` ซึ่งใช้ตรวจจับการแก้ UI โดยไม่ตั้งใจ การเชื่อม `client.ts` เข้ากับแอปทำให้ hash ของ JS เปลี่ยนได้ตามปกติ **รายงานจำนวน modules ใหม่และ hash ทั้งสองไฟล์ใน commit message** และยืนยันว่า hash ของ CSS ไม่เปลี่ยน หาก hash ของ CSS เปลี่ยน แสดงว่าแก้ styling และต้องย้อนกลับ

---

## 5. งานเพิ่มเติมที่ควรทำ เรียงตามลำดับ

1. **ทดสอบอัปโหลดไฟล์ที่ถูกต้องผ่าน route จริง** การส่ง template ไปกลับข้างต้นทำด้วยมือในวันนี้และยังไม่มีใน suite ให้เพิ่มการทดสอบนี้
2. **เติม `latitude` / `longitude` ใน `sme_profiles`** เฉพาะเมื่อทีมให้พิกัดจริงมาเท่านั้น ห้ามเดาจากชื่อจังหวัด เพราะตัวกรองระยะทางตั้งใจตัดร้านที่ไม่มีพิกัดออก และตำแหน่งที่เดาจะทำให้ผลแย่กว่าการตัดออก หากไม่มีข้อมูลให้เว้นไว้
3. **ตั้งรหัสผ่านให้ `admin@example.test`** บัญชี seed ไม่มีรหัสผ่าน จึงยังทดสอบ `POST /api/auth/revoke` ไม่ได้ ใช้ `python backend/scripts/set_password.py admin@example.test`
4. **ลองดึงข่าวจริงจากโฮสต์ที่ deploy แล้ว** หาก deploy สำเร็จ เพราะ egress ต่างกันและอาจช่วยยืนยันสาเหตุ TLS timeout ที่ยังเป็นข้อสันนิษฐาน

---

## 6. รูปแบบ request ที่ถ้าเดาจะเสียเวลาเป็นชั่วโมง

ข้อมูลเหล่านี้วัดจากระบบจริง ไม่ใช่ความจำ นักพัฒนา frontend จะพบทุกข้อ

- **ข้อมูลเดียวกันมี body สองรูปแบบ** `/api/calculate` และ `/api/analyze` ต้องรับ input แบบมี wrapper: `{"input": { ...fields... }}` ส่วน `/api/v1/finance/calculate` และ `/api/v1/inputs/manual` รับ object แบบแบน หากส่ง object แบนไปยังคู่แรก จะได้ `422 {"loc": ["body","input"], "msg": "Field required"}` การเปลี่ยนให้รับ object แบนด้วยถือเป็นการเปลี่ยนสัญญา API และควรระบุใน commit message
- **`units_sold` ต้องเป็น JSON integer ไม่ใช่ string** ค่า `"7000"` ได้ 422 `int_type` ส่วนฟิลด์จำนวนเงินรับ string ได้ HTML form ส่งทุกค่าเป็น string ดังนั้น client ต้องแปลงฟิลด์นี้
- **พฤติกรรมค่าไม่ส่งหรือ `null` เปลี่ยนแล้ว:** backend ปัจจุบันกำหนดฟิลด์ตัวเลขที่ขาดหรือเป็น `null` เป็นศูนย์ รวมถึง `inventory` ซึ่งรองรับชื่อ Inventory/Stock และ Category 6 ใน Excel ค่าที่ไม่ใช่ตัวเลขหรือรูปแบบตัวเลขผิดยังถูกตรวจสอบโดย schema
- **`period_start` / `period_end` ต้องเป็นวันที่ ISO** และ `kind` ต้องเป็น `actual`, `forecast` หรือ `simulated`
- **มีการตรวจงบดุล:** `assets = liabilities + equity` หากไม่ตรงจะได้ 422 `Balance sheet mismatch`

### จุดที่มักพลาดใน stack

- PostgreSQL ที่โฮสต์จัดการให้ส่ง URL รูปแบบ `postgresql://` ซึ่ง SQLAlchemy จับคู่กับ driver แบบ synchronous `db.py::normalise_database_url` จะกำหนด asyncpg และย้าย `sslmode` ไปเป็น connect argument ให้วาง URL ของโฮสต์โดยไม่แก้
- asyncpg ตรวจชนิดพารามิเตอร์เทียบกับชนิดคอลัมน์ **ก่อน** SQL `CAST` จะทำงาน ดังนั้นวันที่ UUID และจำนวนเงินต้องเป็น Python object จริงใน parameter dict ไม่ใช่ string
- PostgreSQL อนุมานชนิดของ branch ที่เป็น `NULL` เปล่าใน `CASE` ไม่ได้ และตีความ expression ทั้งก้อนเป็น text ให้ cast อย่างชัดเจน
- `ON CONFLICT DO NOTHING` แก้แถวที่ถูกสร้างไว้ก่อนจากเส้นทางอื่นไม่ได้ ใช้ `DO UPDATE` เมื่อ seed เดโมต้องทำให้ได้สถานะตรงกัน
- **ลำดับ route สำคัญ:** ต้องลงทะเบียน path แบบค่าคงที่ก่อน path ที่มี parameter ไม่เช่นนั้น `/swarm/{order_ref}` จะดัก `/swarm/proposal`
- `requirements.lock.txt` เป็นรายการ dependency แบบ pin แบน ๆ ถ้าขาด dependency ตอน runtime container จะพังแม้ venv ในเครื่องซ่อนปัญหาไว้ มี test ตรวจกรณีนี้
- heredoc ใน shell นี้พังเมื่อมี apostrophe ใช้เครื่องมือเขียนไฟล์แทนเมื่อมีข้อความดังกล่าว
- `load_shop_resources` ต้องรับ keyword-only `project_id` และไม่มีค่าเริ่มต้น การอ่านโดยไม่ระบุ scope ทำให้ได้ resource เดิมซ้ำตามจำนวน project และ `ShopCapacity` ปฏิเสธ id ซ้ำ นี่เคยเป็นบั๊กจริงที่พบขณะรัน ไม่ใช่แค่ข้อกังวลทางทฤษฎี

---

## 7. ติดขัดที่ทีม ไม่ใช่ที่โค้ด — อย่าหาทางเลี่ยง

- **การ deploy backend ไป Railway** `Dockerfile`, `railway.json` และ startup schema bootstrap เสร็จและยืนยันแล้วด้วยการ build image และรัน container เชื่อม PostgreSQL จริง เหลือเพียงสร้าง service ในบัญชีทีม ซึ่งต้องใช้ credential ของทีม นี่คือสิ่งเดียวที่ยังบล็อก live web demo
- **ปิด mock ของ frontend** ทำหลัง deploy โดยตั้งตัวแปร Vercel สองตัวคือ `VITE_API_BASE_URL` และ `VITE_USE_MOCK=false` แล้ว deploy ใหม่ ไม่มีตัวแปรตัวที่สาม `VITE_BACKEND_URL` เคยใช้กับ `src/services/api.ts` ซึ่งถูกลบใน `44db2f2`
- คง `RBAC_ENFORCED=false` และ `AUTH_DEV_HEADER=false` สำหรับผู้ทดสอบ frontend ไม่ส่ง auth headers และ `/funder/projects` เป็น route เดียวที่ผูกกับ `resolve_principal` การเปิด enforcement จะทำให้เฉพาะหน้านั้นได้ 401

---

## 8. วิธีทำงาน

- **ยืนยันด้วยการเรียกจริงและผลลัพธ์จริงก่อนบอกว่าทำงาน** เรียก endpoint แล้วอ่านข้อมูลกลับ อย่ารายงานว่าสำเร็จเพียงเพราะเขียนโค้ด Claude เพิ่งพบบั๊กจริงในสัปดาห์นี้ที่ test ผ่านแต่การเรียกจริงจับได้ และคุณก็พบ gate bug ใน Claude ด้วยวิธีเดียวกัน
- **หาก test ล้มเพราะเปลี่ยนพฤติกรรมโดยตั้งใจ ให้แก้ test และระบุใน commit** ห้ามลดความเข้มของ assertion เพื่อให้ผ่าน
- **ห้ามแต่งข้อมูลขึ้นเอง** หากข้อมูลไม่พอสร้างชุดข้อมูล ให้ส่งชุดว่างพร้อมชื่อใน `missing`; `status` ต้องสอดคล้องกับข้อมูลที่ขาดและห้ามอ้างว่า `ok`; ทุก response ต้องมี `source` กฎนี้ใช้ทั้งโปรเจกต์ และงาน envelope ล่าสุดมีไว้เพื่อรักษากฎนี้
- **บอกเมื่อสิ่งที่ได้รับมอบหมายไม่ถูกต้อง** และบอกสิ่งที่พบแม้ไม่มีใครถาม บั๊กจริงหลายรายการถูกจับได้ด้วยวิธีนี้
- อัปเดต `backend/docs/progress.md` และรายการ §4 ใน `AI_DEVELOPMENT_GUIDELINES.md` ให้เป็นปัจจุบัน โดยตรวจตัวเลขกับโค้ด ไม่ใช้ตัวเลขเก่าต่อ
- ปิดงานแต่ละช่วงด้วย `git add`, `git commit` และ `git push` ไป `main` เขียน commit message ให้เก็บเหตุผลไว้ ไม่ใช่บอกแค่ diff

---

## 9. สิ่งที่ฝากให้ Claude ในวันเสาร์

เพิ่มหัวข้อใน `backend/docs/CODEX_HANDOFF.md` ระบุสิ่งที่แก้ จำนวน test ที่วัดได้ จำนวน modules และ hash ของ asset ทั้งสองไฟล์ การตัดสินใจที่มีทางเลือกอื่นที่สมเหตุสมผล และสิ่งที่ตั้งใจไม่ทำ หากเลือกไม่เชื่อม `src/` ให้ระบุชัดเจนเพื่อให้ Claude เห็นเป็นเรื่องแรก
