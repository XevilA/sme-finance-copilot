# คู่มือ Deploy backend ขึ้น Railway

ทุกขั้นในเอกสารนี้ทดสอบจริงแล้วด้วยการ build image และรัน container เทียบกับ
PostgreSQL จริง โดยส่ง `DATABASE_URL` รูปแบบเดียวกับที่ Railway ให้ ·
สิ่งที่ยังไม่ได้ทำคือการกดสร้าง service บนบัญชี Railway ซึ่งต้องใช้บัญชีของทีม

---

## สรุปก่อนเริ่ม

| สิ่งที่เตรียมไว้แล้ว | ไฟล์ |
| --- | --- |
| Image ของ backend | `backend/Dockerfile` |
| ค่า deploy (health check, restart policy) | `backend/railway.json` |
| กันไฟล์ที่ไม่ควรเข้า image | `backend/.dockerignore` |
| Apply schema/seed ตอน startup | `backend/app/bootstrap.py` |
| รองรับ `DATABASE_URL` ที่ Railway ให้ | `backend/app/db.py` → `normalise_database_url()` |
| กัน backend ขึ้น Vercel | `.vercelignore` |

**สิ่งที่คุณต้องทำเอง:** สร้าง project บน Railway ต่อ GitHub repo
เพิ่ม PostgreSQL แล้วตั้งค่า environment variable

---

## 2 เรื่องที่พบตอนทดสอบ และแก้ไปแล้ว

ถ้าไม่เจอก่อน การ deploy ครั้งแรกจะพังทั้งสองครั้ง

**1. `DATABASE_URL` ที่ Railway ให้ ใช้กับ async engine ไม่ได้**

Railway (และ Render, Fly, Heroku) ให้ค่ามาเป็น `postgresql://...`
ซึ่ง SQLAlchemy จะ map ไปที่ driver แบบ synchronous แล้ว async engine จะปฏิเสธ ·
`normalise_database_url()` เปลี่ยนให้เป็น `postgresql+asyncpg://` เอง
และย้าย `sslmode` จาก query string ไปเป็น connect argument `ssl` ของ asyncpg
(asyncpg ไม่รับ `sslmode` เป็น query parameter)

**คุณจึงวาง `DATABASE_URL` ที่ Railway ให้ได้ตรง ๆ ไม่ต้องแก้มือ**

**2. `requirements.lock.txt` ขาด `greenlet`**

container import SQLAlchemy asyncio ไม่ผ่านเลย:

```
ImportError: The SQLAlchemy asyncio module requires that the Python
'greenlet' library is installed.
```

ในเครื่องไม่พบปัญหาเพราะ venv มี greenlet ติดมาก่อนแล้ว · ตอนนี้ pin ไว้ใน lock
และมีเทสต์ `test_every_runtime_import_is_pinned` กันไม่ให้หายอีก

---

## ขั้นตอน

### 1. สร้าง project และต่อ repo

1. เข้า Railway → **New Project** → **Deploy from GitHub repo**
2. เลือก `XevilA/sme-finance-copilot`
3. ที่ service settings ตั้ง **Root Directory = `backend`**

   ⚠️ **ข้อนี้สำคัญ** · repo root เป็น Vite frontend ถ้าไม่ตั้ง Railway
   จะพยายาม build frontend เป็น backend · `backend/Dockerfile` ถูกออกแบบให้
   build context เป็นโฟลเดอร์ `backend` เท่านั้น

4. Railway จะเจอ `Dockerfile` และใช้มันเองตาม `railway.json`

### 2. เพิ่ม PostgreSQL

ใน project เดียวกัน: **New** → **Database** → **Add PostgreSQL**

Railway จะสร้างตัวแปร `DATABASE_URL` ให้อัตโนมัติ

### 3. ตั้ง environment variable ที่ service ของ backend

| ตัวแปร | ค่า | หมายเหตุ |
| --- | --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | อ้างอิงจาก service Postgres · Railway แทนค่าให้เอง |
| `DB_BOOTSTRAP` | `schema+seed` | **ครั้งแรกเท่านั้น** เพื่อโหลด schema + ข้อมูลเดโม |
| `DB_POOL` | `queue` | instance อยู่ยาว จึงใช้ pool จริงได้ |
| `CORS_ORIGINS` | `https://sme-finance-copilot.vercel.app` | ใส่โดเมน frontend ให้ครบ คั่นด้วย comma |
| `OPENAI_API_KEY` | *(key ของคุณ)* | optional · ถ้าไม่ใส่ `aiMode` จะเป็น `rules` |
| `OPENAI_MODEL` | *(ชื่อโมเดล)* | ต้องใส่คู่กับ key |

**`PORT` ไม่ต้องตั้ง** Railway กำหนดให้เอง และ Dockerfile bind `${PORT:-8000}` อยู่แล้ว

**หลัง deploy สำเร็จครั้งแรก ให้เปลี่ยน `DB_BOOTSTRAP` เป็น `schema`**
ไม่งั้นทุกครั้งที่ deploy จะรัน seed ซ้ำ (ซึ่ง idempotent ไม่เสียหาย แต่เปลืองเวลา startup)

### 4. ตรวจว่าขึ้นจริง

```bash
curl https://<your-service>.up.railway.app/health
```

ควรได้:

```json
{
  "status": "ok",
  "service": "sme-swarm-finance-engine",
  "version": "0.3.0",
  "persistence": true,
  "bootstrap": {"mode": "schema+seed", "applied": ["schema.sql", "seed.sql"]}
}
```

**ถ้า `persistence` เป็น `false`** → `DATABASE_URL` ไม่ถึง service
**ถ้า `bootstrap.error` มีค่า** → ต่อ DB ได้แต่ apply schema ไม่ผ่าน อ่าน error นั้น
**ถ้า `bootstrap.applied` ว่างและ skipped บอกว่า another instance holds the lock**
→ ปกติ มี instance อื่นทำไปแล้ว

จากนั้นตรวจ endpoint จริง (UUID เดโมคงที่):

```bash
curl "https://<your-service>.up.railway.app/api/v1/overview?sme_id=11111111-1111-4111-8111-111111111111"
curl "https://<your-service>.up.railway.app/api/v1/shops"
```

เปิด API docs ที่ `https://<your-service>.up.railway.app/docs`

### 5. ปลด frontend จากโหมด mock

หลัง backend ขึ้นแล้ว ไปที่ Vercel → project settings → Environment Variables:

| ตัวแปร | ค่า |
| --- | --- |
| `VITE_API_BASE_URL` | `https://<your-service>.up.railway.app/api/v1` |
| `VITE_USE_MOCK` | `false` |

แล้ว redeploy

⚠️ **ชื่อตัวแปรคือ `VITE_API_BASE_URL`** ตามที่ `src/api/client.ts` อ่าน
(ไฟล์ `src/services/api.ts` ใช้ `VITE_BACKEND_URL` แยกกัน ถ้าจะใช้ไฟล์นั้นด้วยให้ตั้งทั้งคู่)

⚠️ **ห้ามใส่ `OPENAI_API_KEY` ในตัวแปรที่ขึ้นต้นด้วย `VITE_`**
ทุกอย่างที่ขึ้นต้นด้วย `VITE_` ถูกฝังลง bundle ที่ใครก็เปิดอ่านได้

---

## ทดสอบในเครื่องก่อน deploy

ทำแบบนี้ได้ผลเหมือน Railway เพราะใช้ `DATABASE_URL` รูปแบบเดียวกัน:

```bash
docker compose -f backend/docker-compose.yml up -d
docker build -t sme-backend:test backend
docker run --rm -p 8010:8000 --network backend_default \
  -e DATABASE_URL="postgresql://postgres:postgres@sme_swarm_db:5432/sme_swarm" \
  -e DB_BOOTSTRAP="schema+seed" -e DB_POOL="queue" \
  sme-backend:test
curl http://127.0.0.1:8010/health
```

ผลที่ได้ตอนทดสอบ: bootstrap apply `schema.sql` และ `seed.sql` สำเร็จ
และ `/api/v1/overview`, `/api/v1/shops`, `/api/v1/funding/options`,
`/api/forecast` ตอบ 200 ทั้งหมด

---

## เรื่องที่ควรรู้

**ข้อมูลเดโมเป็นข้อมูลสังเคราะห์** `DB_BOOTSTRAP=schema+seed` จะใส่ SME 3 ร้าน
พร้อมงบการเงิน 2 ชุด (เกรด A และ D) ข่าว/ทรัพยากร/ฉากทัศน์ตัวอย่าง ·
ทุกแถวติดป้ายว่าเป็นข้อมูลตัวอย่าง **อย่าใช้กับข้อมูลลูกค้าจริง**

**ยังไม่มี authentication** RBAC ปิดเป็นค่าเริ่มต้น และตัวตนผู้เรียกมาจาก header
`X-User-Email` ซึ่งใครก็ตั้งได้ · **อย่าเปิด public ให้ข้อมูลการเงินจริงจนกว่าจะมี
credential ที่ตรวจได้** · `CORS_ORIGINS` ไม่ใช่การยืนยันตัวตน

**GDELT อาจยังดึงข่าวไม่ได้** จากเครื่องนี้ TLS handshake timeout
(ดู `LIVE_PROVIDER_VERIFICATION.md`) · บน Railway อาจผ่าน เพราะ egress ต่างกัน ·
ลองเช็คหลัง deploy: `curl "https://<service>/api/industry/trends?sector=food_processing"`
ถ้า `status` เป็น `ok` แปลว่าเน็ตของ Railway ใช้ได้

**ยังไม่มีการจำกัดอัตราคำขอข้าม instance** `railway.json` ตั้ง `numReplicas: 1`
ไว้ด้วยเหตุนี้ · ถ้าจะเพิ่ม replica ต้องทำตาราง `industry_news_fetch_state` ก่อน
ไม่งั้นหลาย instance จะยิง GDELT พร้อมกันแล้วโดน 429

---

## เปิด Authentication

ค่าเริ่มต้นคือ **ปิด** เพื่อให้ frontend ที่ใช้งานอยู่ไม่พัง · ลำดับการเปิด:

### 1. สร้าง secret สำหรับเซ็น token

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

ใส่เป็น `AUTH_SECRET` บน Railway · **ต้องยาวอย่างน้อย 32 ตัวอักษร**
ถ้าไม่ตั้ง ระบบจะออกและรับ token ไม่ได้เลย (ไม่มีค่า default เพราะ secret ที่เดาได้
เท่ากับไม่มีลายเซ็น)

### 2. ตั้งรหัสผ่านให้ผู้ใช้

รหัสผ่าน**ไม่ได้ถูก seed** จึงไม่มี credential ใดอยู่ใน repo · ตั้งด้วยสคริปต์:

```bash
python backend/scripts/set_password.py owner@baansuan.test
python backend/scripts/set_password.py fund@example.test --generate
```

`--generate` สร้างรหัสที่แข็งแรงและพิมพ์ให้ครั้งเดียว · รหัสผ่านไม่รับผ่าน
argument เพราะจะติดอยู่ใน shell history และ process list

ผู้ใช้ที่ `password_hash` ว่าง **ล็อกอินไม่ได้เลย** ไม่ใช่ล็อกอินได้ด้วยรหัสว่าง

### 3. ขอ token

```bash
curl -X POST https://<service>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fund@example.test","password":"<รหัสผ่าน>"}'
```

ได้ `accessToken` มาแล้วส่งเป็น `Authorization: Bearer <token>`

```bash
curl https://<service>/api/auth/me -H "Authorization: Bearer <token>"
```

### 4. เปิด enforcement

ตั้ง `RBAC_ENFORCED=true` บน Railway

⚠️ **หลังเปิดแล้ว endpoint ที่ตรวจสิทธิ์จะต้องมี token** · ถ้า frontend ยังไม่ส่ง
`Authorization` header จะได้ 401 · **ต่อฝั่ง frontend ให้เสร็จก่อนเปิด**

### ตรวจว่าตั้งค่าถูก

```bash
curl https://<service>/health
```

ดูที่ `auth`:

```json
{"enforced": true, "secretConfigured": true, "devHeaderAccepted": false}
```

- `secretConfigured: false` ขณะ `enforced: true` → ยังไม่ตั้ง `AUTH_SECRET`
  ระบบจะตอบ 503 ไม่ใช่ปล่อยผ่าน
- **`devHeaderAccepted: true` บนเครื่องที่เข้าถึงได้จากภายนอก = ช่องโหว่**
  แปลว่า `AUTH_DEV_HEADER=true` ซึ่งยอมรับ header `X-User-Email` เป็นตัวตน
  โดยไม่มีการยืนยัน ใครก็อ้างเป็น role ไหนก็ได้ · ใช้เฉพาะในเครื่องตัวเองกับ DB ทิ้งขว้าง

### สิ่งที่ auth นี้ทำและไม่ทำ

**ทำ:** token เซ็นด้วย HMAC-SHA256 ตรวจด้วย `compare_digest` · มีวันหมดอายุบังคับ ·
รหัสผ่าน hash ด้วย scrypt (memory-hard) ต่างเกลือทุกครั้ง · ทุกการ login ที่ล้มเหลว
ตอบข้อความเดียวกันหมด (ไม่บอกว่าอีเมลมีอยู่ไหม) · **role มาจากฐานข้อมูลตอนตรวจ
ไม่ใช่จาก token** จึงปิดบัญชีหรือเปลี่ยน role แล้วมีผลทันที และ token ที่อ้างว่าเป็น
`admin` ก็ยกระดับตัวเองไม่ได้

**ยังไม่ทำ:** ไม่มี refresh token · ไม่มี blacklist เพิกถอน token ก่อนหมดอายุ
(จึง clamp อายุไว้ไม่เกิน 7 วัน) · ไม่มี rate limit ที่หน้า login
(ควรเพิ่มก่อนเปิด public) · ไม่มีการจำกัดจำนวนครั้งที่ลองผิด
