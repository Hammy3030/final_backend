import { logLine } from '../utils/logger.js';

function sendJson(req, res, status, body) {
  const payload = { ...body };
  if (req?.requestId) {
    payload.requestId = req.requestId;
  }
  return res.status(status).json(payload);
}

export const errorHandler = (err, req, res, _next) => {
  logLine('error', {
    requestId: req?.requestId,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    errName: err?.name,
    errMessage: err?.message,
    ...(process.env.NODE_ENV === 'development' && err?.stack && { stack: err.stack })
  });

  if (err.message === 'Not allowed by CORS') {
    return sendJson(req, res, 403, {
      success: false,
      message: 'ไม่อนุญาตตามนโยบาย CORS'
    });
  }

  if (err.message && err.message.includes('Client must be connected before running operations')) {
    return sendJson(req, res, 503, {
      success: false,
      message: 'ระบบกำลังเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้งในไม่กี่วินาที',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }

  if (
    err.message &&
    (err.message.includes('timeout') ||
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('ENOTFOUND') ||
      err.message.includes('connection') ||
      err.name === 'MongoNetworkError' ||
      err.name === 'MongoServerSelectionError')
  ) {
    return sendJson(req, res, 503, {
      success: false,
      message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }

  if (err.name === 'MongoServerError') {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return sendJson(req, res, 400, {
        success: false,
        message: `ข้อมูล${field}ซ้ำซ้อน กรุณาตรวจสอบอีกครั้ง`,
        field
      });
    }
  }

  if (err.name === 'CastError') {
    return sendJson(req, res, 404, {
      success: false,
      message: 'ไม่พบข้อมูลที่ต้องการ'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return sendJson(req, res, 401, {
      success: false,
      message: 'Token ไม่ถูกต้อง'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return sendJson(req, res, 401, {
      success: false,
      message: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่'
    });
  }

  if (err.isJoi) {
    return sendJson(req, res, 400, {
      success: false,
      message: 'ข้อมูลไม่ถูกต้อง',
      errors: err.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendJson(req, res, 400, {
      success: false,
      message: 'ไฟล์มีขนาดใหญ่เกินไป'
    });
  }

  return sendJson(req, res, err.status || 500, {
    success: false,
    message: err.message || 'เกิดข้อผิดพลาดในระบบ',
    errorType: err.name,
    ...(process.env.NODE_ENV === 'development' && err.stack && { stack: err.stack })
  });
};
