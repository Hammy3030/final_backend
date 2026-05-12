import rateLimit from 'express-rate-limit';

/**
 * จำกัดความถี่ login/register — ลด brute-force (คู่กับ rate limit ทั้งแอป)
 * สำเร็จ (2xx/3xx) ไม่นับตามค่าเริ่มต้นของ skipSuccessfulRequests
 *
 * ปรับได้ด้วย env:
 * - AUTH_RATE_LIMIT_WINDOW_MS (default 15 นาที)
 * - AUTH_RATE_LIMIT_MAX (production default 40, dev 200)
 */
const authWindowMs = parseInt(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000),
  10
);

const authMax = parseInt(
  process.env.AUTH_RATE_LIMIT_MAX ||
    (process.env.NODE_ENV === 'production' ? '40' : '200'),
  10
);

export const authSensitiveLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message:
      'มีการพยายามเข้าสู่ระบบบ่อยเกินไปจากที่อยู่นี้ กรุณารอสักครู่แล้วลองใหม่'
  }
});

/** GET verify-email — กันยิง token ถี่ๆ (แยกจาก login) */
const verifyWindowMs = parseInt(
  process.env.AUTH_VERIFY_RATE_LIMIT_WINDOW_MS || String(60 * 60 * 1000),
  10
);
const verifyMax = parseInt(process.env.AUTH_VERIFY_RATE_LIMIT_MAX || '60', 10);

export const authVerifyEmailLimiter = rateLimit({
  windowMs: verifyWindowMs,
  max: verifyMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'ร้องขอยืนยันอีเมลบ่อยเกินไป กรุณารอแล้วลองใหม่'
  }
});
