# CODEX ASSIGNMENT — Backend / AI integration, 2026-10-16

## 1. คำสั่งล่าสุดและขอบเขตที่ใช้จริง

ผู้ใช้แจ้งว่าทีมอนุญาตให้ทำ frontend เพื่อให้เชื่อม backend/AI และทำงานร่วมกันได้แล้ว
โดยคง UI เดิม. **ยกเลิกข้อจำกัดสอง/ห้าไฟล์เดิม** สำหรับงาน integration ที่จำเป็น.
ห้ามใช้ข้อห้ามเก่าเป็นเหตุหยุดงาน wiring หรือขอสิทธิ์รายไฟล์ซ้ำ

งานหลักของ CODEX คือ math/AI, database, API routes, adapters, contracts และ integration
tests พร้อม wiring ของ frontend ที่จำเป็น. ทีม frontend จะเข้ามาทำ presentation/UX/UI
ต่อเมื่อส่วนนี้พร้อม. วันนี้ lane split เดิมไม่บล็อกงานข้าม backend/database/adapter

แก้ client/types/store/hooks/props/handlers/validation/data bindings และสถานะจาก API ได้.
คง CSS, Tailwind, สี, spacing, layout, motion design, component hierarchy และ routing.
ไม่สร้างหน้า/flow ใหม่หรือ redesign. ถ้าต้องออกแบบการใช้งานใหม่ ให้บันทึกงานส่งต่อ
ทีม frontend; ข้อจำกัดนี้ไม่ห้ามแก้ logic การเชื่อมต่อใน component เดิม

ประวัติ brief เดิมที่วินิจฉัย Import ตอนยังไม่มี POST อยู่ใน Git ที่ `eb26245`/`dde929e`.
Import wiring อยู่ใน `269e3d2`; Overview/order Simulator/SWARM wiring อยู่ใน `4d39680`.
ข้อความ “frontend ไม่มี write path” และ “แก้ได้แค่สอง/ห้าไฟล์” ไม่ใช่สถานะปัจจุบันแล้ว

## 2. อ่านตามลำดับก่อนทำงาน

1. [AI_DEVELOPMENT_GUIDELINES.md](AI_DEVELOPMENT_GUIDELINES.md) — กติกาและ §4 work list.
2. [FRONTEND_INTEGRATION_HANDOFF.md](FRONTEND_INTEGRATION_HANDOFF.md) — current state,
   API vs demo actions, priorities, owners และเกณฑ์รับงานก่อนส่งทีม frontend.
3. [progress.md](progress.md) แล้ว [CODEX_HANDOFF.md](CODEX_HANDOFF.md) — ใหม่อยู่บน,
   ตัวเลขในรอบเก่าเป็นประวัติ ไม่ใช่ผลตรวจใหม่.
4. [ANALYSIS_CONTRACT.md](ANALYSIS_CONTRACT.md) — math, evidence, forecast/expense history.
5. [API_CONTRACT_MATRIX.md](../../docs/API_CONTRACT_MATRIX.md) — endpoints/request shapes จริง.
6. [DEPLOY.md](DEPLOY.md) และ [TESTER_READINESS_CURRENT.md](TESTER_READINESS_CURRENT.md).
7. [LIVE_PROVIDER_VERIFICATION.md](LIVE_PROVIDER_VERIFICATION.md) — หลักฐานสดและข้อจำกัด.

Code เป็น source of truth. ตรวจ route/model/client/handler และ HTTP/DB ก่อนอ้างว่าเสร็จ.
แยก endpoint ตอบได้, มีข้อมูลครบ, ปุ่มต่อจริง และผล deploy แล้วออกจากกัน

## 3. สถานะที่ตรวจจาก runtime source `48d9385` + validation regression repair ในรอบนี้

ตรวจซ้ำ 2026-10-16: pytest **510 passed / 3 skipped** กับ PostgreSQL (26.93s),
**410 passed / 103 skipped** ไม่มี DB (16.12s). **36** main `/api/*` routes + v1 aliases,
**4** v1-only inputs/finance routes, `/health`, **27 tables**, **16 read contracts** ผ่าน HTTP.
Build **1955 modules**, CSS **index-DEindwiw.css**, JS **index-CBenrrOQ.js**.
warning เดิม: Starlette/httpx และ bundle >500kB. รอบนี้แก้ validation regression โดยคง src/UI

| โมดูล | สถานะจริง |
| --- | --- |
| 1 Validation/Excel | manual/upload/template ต่อแล้ว; XLSX Financials template ≤5 MiB, ไม่มี auto column mapping |
| 2 Math/grade | Decimal metrics + grade + evidence; Overview unknown เป็น null ไม่เดาศูนย์ |
| 3 Analyst/forecast | rules, forecast, expense comparison ใช้ผ่าน API; optional LLM จัดลำดับ finding IDs; UI Import ใช้ rules |
| 4 Funding | matcher/API/options มีแล้ว; apply button ยังเป็น toast ไม่ใช่ส่งคำขอจริง |
| 5 SWARM | engine + resource eligibility + Radar/swap preview จริง; constraints ใน project ยังไม่ครบ |
| 6 Simulator | statement และ order A/B; 4 controls + save จริง; saved-plan read และ Chaos integration ยังไม่ครบ |
| 7 Industry | provider route/cache/gate มี; ข่าวสดยังไม่ยืนยันสำเร็จ และยังไม่มี news UI integration |
| 8 DB/API/auth | persistence/auth/throttle/revoke มี; frontend ยังไม่ส่ง auth, tester enforcement ปิด |

อย่าอ้างว่า “ทั้งแปดฟีเจอร์ครบทุกปุ่มบนเว็บ”. อ่าน backlog จริงใน handoff; demo handlers
เช่น apply/sign/info request/export ยังไม่มี corresponding write operations

### Regression ที่แก้ระหว่างอัปเดตสถานะ

ก่อน push พบ main เพิ่ม `e5098cc` และ `48d9385` จึงรวมทั้งสอง commit ไว้.
การเติม omitted/null เป็น 0 ทำให้ตัวอย่างเดิมมี total_expenses=0 แต่มีรายการค่าใช้จ่าย
จึงถูกปฏิเสธ; 8 เทสต์แรกของ AI ล้มก่อนถึง provider. อีกจุดแปลง NaN/Infinity เป็น 0.
แก้โดยคืน validation เดิม: required ยังต้องส่ง, optional ไม่ทราบเป็น None,
nonfinite ถูกปฏิเสธ. คง inventory และ Excel aliases ของทีมไว้ แต่ inventory เป็น nullable.
FinancialInput มี **39 top-level fields (7 required / 32 optional)**; Import ปัจจุบันรับ
38 fields จึงยังไม่มีช่อง inventory และยังไม่มี stock/DIO math. ไม่เปลี่ยน src/UI.

เพิ่ม regression tests **16 เคส**: unknown เทียบ known zero, nonfinite, required amounts,
ตัวอย่าง grade B/75 และ inventory aliases. ไม่แก้หรือลด assertion ของ test เดิม.
ผลสุดท้าย DB **510 passed / 3 skipped (26.93s)**, ไม่มี DB **410 / 103 (16.12s)**;
targeted validation/Excel/AI **49 passed**. รีสตาร์ต backend แล้ว HTTP analyze ได้ B/75,
inventory manual=200, NaN=422 และ required assets หาย=422; HTTP tester flow และ
client/style guard scripts ผ่านอีกครั้ง. ไม่เรียก live provider หรือ deploy ใหม่.

## 4. ลำดับงานที่ได้รับอนุญาต

1. ทำ SME/project/input context ให้ตรงกันข้าม API และหน้า; ไม่ย้อนไป default demo เงียบ ๆ.
2. ทำ runtime contract/types/null/source/missing และ loading/error/empty states ให้ตรงกัน.
   Cost adapter ยังมี zero placeholders ของ unavailable metrics; แก้ adapter/types/consumer คู่กัน.
3. เก็บ order constraints/collection schedule ที่ยังขาด และเชื่อม eligibility ตามข้อมูลจริง.
4. ต่อ action ที่มี API แล้ว; action ที่ไม่มี backend ให้บอก unavailable ไม่แจ้งสำเร็จปลอม.
5. ทำ saved simulation read/replay, scenario effects, AI context/evidence/fallback ให้ครบตาม scope.
6. ส่ง contract/fixtures/acceptance tests ให้ frontend team; presentation/design เป็นงานรับช่วง.

รายละเอียดเกณฑ์รับงานและ owner อยู่ใน §งานลำดับถัดไปของ FRONTEND_INTEGRATION_HANDOFF.md.
นี่เป็น work list ที่ยังต้องทำ ไม่ใช่รายการที่รอบเอกสารนี้ implement เสร็จแล้ว

## 5. Contracts ที่ห้ามเดา

- `POST /api/v1/inputs/manual`, `/api/v1/finance/calculate`: FinancialInput แบบ flat.
- `POST /api[/v1]/calculate`, `/analyze`: `{input: {...}}`; calculate เพิ่ม persist ได้.
- `POST /api[/v1]/upload?persist=false`: multipart `file`; return input, metrics,
  businessMetrics, grading, upload metadata; ไม่มี file bytes ถูกเก็บ.
- `POST /api[/v1]/analyze`: shop_name/use_llm/sme_id/schedule_complete_through optional;
  return data + views ของ input เดียวกันพร้อม source/inputHash.
- `POST /api[/v1]/match-funding`: sme_id/amount/project_id/persist เป็น query parameters
  ไม่ใช่ JSON body และ matcher ไม่ใช่ loan application.
- `POST /api[/v1]/simulate/order`: `{baseline: SwarmRequest, scenario: {unit_price,
  cost_per_unit, deposit_ratio, payment_terms_days}, persist:false, context_missing:[]}`.
  cost_per_unit=null คงต้นทุนแต่ละร้าน; override ใช้กับทุก candidate และจัดสรรใหม่.
- `units_sold`, จำนวนงวด และวันเครดิตเป็น strict JSON integers. เงิน/rates ใช้ decimal strings.
- Optional ไม่รู้ให้ละไว้; null/[] + missing ตามความหมาย ไม่แปลงเป็น 0 เพื่อให้หน้าเต็ม.
- GET `/forecast` ต้องระบุ SME/coverage จริง; default project_obligations=true อาจเขียน
  projected events. SWARM preview ใช้ persist=false เพื่อไม่แทนที่ allocations/resources.

## 6. สิ่งที่ต้องได้ข้อมูลจากทีม

- Project ปัจจุบัน 1,000/วัน 30 วัน. สองร้านอาหารติดรถ required ที่ยัง offered/unavailable;
  preview ได้ 450 จาก Sahai (packaging) และขาด 550. ยังไม่มี required_business_types/
  buyer coordinates/radius/collection schedule เก็บใน project จึงรับรอง suitability ไม่ได้.
  Backend/schema ส่วนนี้ทำต่อได้แล้ว; ข้อมูลจริงต้องมาจากเจ้าของ ไม่เดาจากจังหวัดหรือชื่อออเดอร์.
- Railway account/service URL และ Vercel env/redeploy ต้องทีมโฮสต์ดำเนินการ.
  ไม่มีหลักฐาน deploy ใหม่; deployment frontend ไม่ได้เปิด FastAPI ให้เอง.
- Live news ต้องตรวจจาก host ที่ deploy ผ่าน gate; ไม่ force/retry เพื่อแต่งผลผ่าน.
- Login/auth integration ต้องมี actor จริงก่อนเปิด enforcement. `AUTH_SECRET` ยังไม่ตั้ง,
  admin มี password hash ใน local DB แล้ว แต่ยังไม่ยืนยัน login/revoke ด้วยบัญชีนี้ผ่าน HTTP.
- การสร้าง transaction ใหม่สำหรับสมัครทุน/ลงนาม/ขอเอกสารต้องมี business contract/actor
  ที่ทีมตกลง; สิทธิ์แก้ wiring ไม่ใช่สิทธิ์ยืนยันธุรกรรมแทนคน

## 7. รันบน Windows cmd.exe

```bat
docker compose -f backend/docker-compose.yml up -d
backend\run.cmd
```

อีก terminal ที่ repo root:

```bat
set "VITE_USE_MOCK=false"
set "VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1"
pnpm exec vite --host localhost --port 5173 --strictPort
```

Config backend อยู่ `backend\.env`; ไม่ใช้ `VAR=x command`, ไม่ใส่ secrets ใน VITE_*.
5173 ใช้กับ CORS ของ local config ที่ตรวจแล้ว; อย่าสมมติว่า default 3000 ใช้ได้เสมอ.
ดูคำสั่ง test ใน TESTER_READINESS_CURRENT.md

## 8. กติกาจบงานและส่งต่อ

- คำนวณ/grade/funding/scenario ที่ backend; LLM ห้ามเปลี่ยนตัวเลขหรือหลักฐาน.
- ใช้ evidence, inputHash และ context SME/coverage ให้ตรงกัน; ไม่ตีความ missing เป็นศูนย์.
- ทดสอบ real HTTP + อ่าน DB กลับสำหรับ write ก่อนแจ้ง success. Tests ใช้ข้อมูลสังเคราะห์ชัดเจน.
- ถ้าเปลี่ยน behavior โดยเจตนา ให้แก้ test ตาม contract และระบุใน commit; ไม่ลด assertion.
- รักษา UI เดิม; รายงาน modules และ asset hashes ทุก wiring block. JS/modules เปลี่ยนได้
  ตาม implementation; CSS hash เปลี่ยนต้องตรวจการแตะดีไซน์.
- อัปเดต progress.md, guidelines §4 และ CODEX_HANDOFF.md ด้วยผลวัดและงานค้าง.
- จบแต่ละ block ด้วย git add, commit, push main; ก่อนหยุดบันทึกสิ่งที่ทำ/ยังไม่ทำ/ข้อจำกัด.
  ไม่แสดงหรือ commit backend/.env, credentials, uploads หรือข้อมูลธุรกิจจริง

## 9. รูปแบบ handover ก่อนหยุด

เพิ่มรอบใหม่ไว้บนสุดของ CODEX_HANDOFF.md: ฐาน commit และขอบเขตที่ได้รับอนุญาต,
สิ่งที่แก้และสิ่งที่ยังไม่แก้, ผล real HTTP/DB พร้อมตัวเลข, tests/skips/warnings,
module count/CSS/JS hashes, provider/deploy ที่ตรวจจริงหรือยังไม่ได้ตรวจ และงานถัดไป.
บันทึก regression/behavior change และเหตุผลตรงไปตรงมา; ตัวเลขในรอบเก่าคงเป็นประวัติ.
อัปเดต progress.md และ guidelines §4 ให้สอดคล้องก่อน commit/push main
