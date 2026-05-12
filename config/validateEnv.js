import './loadEnv.js';

const isProd = process.env.NODE_ENV === 'production';
const MIN_JWT_SECRET_LEN = 32;

/**
 * ตรวจค่าที่จำเป็นใน production ก่อนเปิดรับ request
 * development: ไม่ exit; ใช้ fallback ใน jwt/database แทน
 */
export function validateEnv() {
  if (!isProd) {
    logOptionalServiceHints(false);
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < MIN_JWT_SECRET_LEN) {
    console.error(
      `[env] FATAL: ใน production ต้องตั้ง JWT_SECRET อย่างน้อย ${MIN_JWT_SECRET_LEN} ตัวอักษร`
    );
    process.exit(1);
  }

  const mongo = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!mongo || !String(mongo).trim()) {
    console.error('[env] FATAL: ใน production ต้องตั้ง DATABASE_URL หรือ MONGODB_URI');
    process.exit(1);
  }

  logOptionalServiceHints(true);
}

function logOptionalServiceHints(prod) {
  if (!process.env.GEMINI_API_KEY) {
    const msg = '[env] GEMINI_API_KEY ไม่ได้ตั้ง — ฟีเจอร์ AI อาจใช้ไม่ได้';
    prod ? console.warn(msg) : console.info(msg);
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    const msg = '[env] ELEVENLABS_API_KEY ไม่ได้ตั้ง — TTS/ElevenLabs อาจใช้ไม่ได้';
    prod ? console.warn(msg) : console.info(msg);
  }
}
