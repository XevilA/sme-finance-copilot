# สัญญาของ Financial Engine

> แปลจากต้นฉบับภาษาอังกฤษ สูตร ชื่อฟังก์ชัน และเกณฑ์ตัวเลขทั้งหมดคงเดิม

import `parsers.excel_parser.parse_excel_file` และ
`engines.financial_engine.calculate_statement` โดยให้ `backend` อยู่ใน Python import path
เส้นทาง API ทั้งแบบกรอกมือและแบบ Excel ที่มีอยู่ ใช้สัญญาข้อมูลและการคำนวณชุดเดียวกันนี้
ไม่ต้องแก้ frontend, route หรือฐานข้อมูล

ฟังก์ชัน Decimal ที่เรียกใช้แยกได้: `calculate_net_profit`, `calculate_fcf`,
`calculate_dscr`, `calculate_pmt`, `calculate_roa`, `calculate_roe`,
`calculate_liquidity` และ `calculate_grade`

ROA และ ROE ใช้ค่าเฉลี่ยของยอดต้นงวดกับปลายงวด และคืนค่าเป็นเปอร์เซ็นต์ของงวดนั้น
**ไม่มีการแปลงเป็นอัตราต่อปี** · DSCR ใช้ CFADS ที่ส่งเข้ามาอย่างชัดเจน หารด้วยเงินต้น
บวกดอกเบี้ยที่ครบกำหนดในงวดบัญชีเดียวกัน

ตัวหารเป็นศูนย์จะคืน `None` และผลลัพธ์ระดับงบจะรายงานเป็น `undefined` ไม่ใช่ 0
**ข้อมูลที่ขาดไปต่างจากข้อมูลที่รู้ว่าเป็นศูนย์** และถูกแยกกันตลอด

PMT เป็นค่างวดที่เป็นบวก ใช้อัตราดอกเบี้ยต่อปีแบบ nominal หารด้วยจำนวนงวดต่อปี
ค่างวดคงที่ ไม่มีค่าธรรมเนียมและไม่มียอดคงเหลือปลายสัญญา จังหวะการชำระระบุชัดเจน
เป็นไปตามข้อตกลงเรื่องอัตราและจำนวนงวดของ
[เอกสาร PMT ของ Microsoft](https://support.microsoft.com/en-us/excel/functions/pmt-function)

## นโยบายการให้เกรด `demo-v1`

แปลงแต่ละองค์ประกอบให้อยู่ในช่วง 0-100:

- DSCR: `clamp(100 * DSCR / 1.5, 0, 100)`
- กระแสเงินสด: `clamp(100 * (operating_cash_flow / revenue) / 0.20, 0, 100)`
- ภาระหนี้: `clamp(100 * (1 - liabilities / assets), 0, 100)`
- เงินสำรอง: `clamp(100 * reserve_months / 3, 0, 100)` โดย
  `reserve_months = cash_balance / (operating_cash_outflow * 30 / inclusive_period_days)`

`G = 0.35 * DSCR_score + 0.30 * cash_flow_score + 0.20 * debt_burden_score + 0.15 * cash_reserve_score`

ปัดคะแนนเป็นทศนิยม 2 ตำแหน่ง แล้วให้เกรด A เมื่อ >= 80, B เมื่อ >= 65, C เมื่อ >= 50
นอกนั้นเป็น D · องค์ประกอบที่ขาดหรือคำนวณไม่ได้จะ **ไม่ให้เกรดเลย**

กรณีภาระหนี้เป็นศูนย์อย่างชัดเจนและ CFADS ไม่ติดลบ องค์ประกอบ DSCR จะได้ 100 คะแนน
ขณะที่ค่า DSCR ดิบยังคงเป็น `undefined`

⚠️ เกณฑ์การแปลงค่าและขอบเกรดเหล่านี้เป็น **นโยบายสำหรับเดโมของโปรเจกต์เท่านั้น
ไม่ใช่เกณฑ์อนุมัติสินเชื่อของผู้ให้กู้**
