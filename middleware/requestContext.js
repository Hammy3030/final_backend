import { randomUUID } from 'node:crypto';

/**
 * กำหนด req.requestId, ส่งกลับใน header X-Request-Id (client อ้างอิง support ได้)
 */
export function requestContextMiddleware(req, res, next) {
  const fromHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = typeof fromHeader === 'string' && fromHeader.trim().length > 0
    ? fromHeader.trim().slice(0, 128)
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
