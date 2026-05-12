# BearThai — Backend API

Express + MongoDB API สำหรับแอปเรียนภาษาไทย ระดับชั้นป.1

## ความต้องการของระบบ

- Node.js 18+ (แนะนำ LTS)
- MongoDB ที่เข้าถึงได้จากเครื่องรัน API

## ตั้งค่า

1. คัดลอก `bearthai-Backend-main/.env.example` เป็น `.env` และแก้ค่าให้ตรงสภาพแวดล้อม  
2. อย่า commit ไฟล์ `.env` จริง

ตัวแปรสำคัญ: `DATABASE_URL` หรือ `MONGODB_URI`, `JWT_SECRET` (production ≥ 32 ตัวอักษร), `FRONTEND_URL`, `ALLOWED_ORIGINS` ตาม [`docs/deploy.md`](../docs/deploy.md)

## รันในเครื่อง

```bash
cd bearthai-Backend-main
npm install
npm run dev
```

ค่าเริ่มต้น API ที่ `http://localhost:3000` — ตรวจสุขภาพด้วย `GET /health`

## ทดสอบ

```bash
npm test
```

## Smoke หลัง deploy / release

สคริปต์เรียก `GET /health` และ (ถ้าตั้งค่า) ลอง `POST /api/auth/login`:

```bash
npm run smoke
# หรือ
SMOKE_BASE_URL=https://api.example.com SMOKE_LOGIN_EMAIL=... SMOKE_LOGIN_PASSWORD=... npm run smoke
```

รายละเอียด: [`scripts/smoke-release.sh`](scripts/smoke-release.sh)

## E2E แบบมือ (smoke ฝั่งผู้ใช้)

รันทั้ง backend + frontend ตาม README ฝั่ง frontend แล้วลำดับขั้นต่ำ:

1. เปิดแอป → ลงทะเบียนหรือล็อกอิน (นักเรียน/ครูตามบัญชีทดสอบ)
2. ครู: เข้าห้องเรียน / บทเรียนที่มีอยู่ — โหลดรายการโดยไม่ error ที่ console
3. นักเรียน: เปิดบทเรียนหนึ่งบท — เสียง/ภาพโหลดได้ (ถ้าเปิดใช้)
4. ถ้ามีแบบทดสอบ/เกมในบท — เริ่มทำและส่ง — ไม่ค้างที่สถานะโหลด

ถ้าล้มเหลว: ดู `X-Request-Id` จาก response และ log JSON ฝั่งเซิร์ฟเวอร์ (ดู [`docs/monitoring.md`](../docs/monitoring.md))

## Deploy และสภาพแวดล้อม

- แนวทางแยก staging / production, GitHub Environments, workflow: [`docs/deploy.md`](../docs/deploy.md)
- สำรองและกู้ MongoDB: [`docs/runbooks/mongo-backup-restore.md`](../docs/runbooks/mongo-backup-restore.md)
- Rollback release: [`docs/runbooks/rollback-release.md`](../docs/runbooks/rollback-release.md)
- หมุนเวียน JWT / API keys: [`docs/runbooks/secret-rotation.md`](../docs/runbooks/secret-rotation.md)

## Security (สรุปสั้น)

- Rate limit ทั้งแอป + จำกัดเพิ่มที่ `POST /api/auth/register`, `POST /api/auth/login` และ `GET` verify-email (ปรับด้วย `AUTH_RATE_LIMIT_*`, `AUTH_VERIFY_RATE_LIMIT_*` ใน `.env.example`)
- Production: ตั้ง `ALLOWED_ORIGINS` / `STRICT_CORS` ตามนโยบาย — ไม่ฝัง URI หรือความลับใน repo

## เมื่อเกิดเหตุ (incident checklist สั้น)

1. **ยืนยันขอบเขต** — เกิดกับ staging หรือ production, ช่วงเวลา, ผู้ได้รับผลกระทบ  
2. **เก็บหลักฐาน** — `requestId`, HTTP status, ข้อความ error (ไม่เก็บรหัสผ่าน), เวอร์ชัน deploy  
3. **ตรวจพื้นฐาน** — `GET /health`, MongoDB connectivity, quota ของบริการภายนอก (AI/TTS)  
4. **บรรเทา** — scale / ปิดฟีเจอร์ที่พัง / rollback ตาม [`rollback-release.md`](../docs/runbooks/rollback-release.md)  
5. **สื่อสาร** — แจ้งทีมและผู้มีส่วนได้ส่วนเสียตามกระบวนการภายใน  
6. **หลังเหตุ** — บันทึกสาเหตุและ action items (monitoring, test, runbook)
