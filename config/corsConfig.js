import './loadEnv.js';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

function parseOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * CORS — development: ยืดหยุ่น
 * production: ถ้ามี ALLOWED_ORIGINS หรือ FRONTEND_URL จะ whitelist; ไม่มีจะเตือนแล้วอนุญาตทุก origin (เทียบเท่าเดิม ไม่พัง deploy เก่า)
 * ถ้าต้องการบังคับ whitelist: ตั้ง STRICT_CORS=true และตั้ง ALLOWED_ORIGINS
 */
export function buildCorsOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const strict = process.env.STRICT_CORS === 'true' || process.env.STRICT_CORS === '1';

  if (!isProd) {
    return {
      origin: true,
      credentials: true,
      methods: METHODS,
      allowedHeaders: ALLOWED_HEADERS
    };
  }

  const origins = parseOrigins();

  if (origins.length === 0) {
    if (strict) {
      console.error(
        '[cors] STRICT_CORS: ต้องตั้ง ALLOWED_ORIGINS หรือ FRONTEND_URL (คั่นด้วย comma)'
      );
      process.exit(1);
    }
    console.warn(
      '[cors] Production: ยังไม่ได้ตั้ง ALLOWED_ORIGINS — อนุญาตทุก origin (ควรตั้งค่าเพื่อความปลอดภัย)'
    );
    return {
      origin: true,
      credentials: true,
      methods: METHODS,
      allowedHeaders: ALLOWED_HEADERS
    };
  }

  const allowVercelPreviews = process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true'
    || process.env.CORS_ALLOW_VERCEL_PREVIEWS === '1';

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (origins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (allowVercelPreviews) {
        try {
          const host = new URL(origin).hostname;
          if (host.endsWith('.vercel.app')) {
            callback(null, true);
            return;
          }
        } catch {
          // ignore
        }
      }
      console.warn(`[cors] ปฏิเสธ origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: METHODS,
    allowedHeaders: ALLOWED_HEADERS
  };
}
