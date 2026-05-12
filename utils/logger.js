/**
 * Log แบบบรรทัดเดียว (JSON) ให้ดึงไป aggregator หรือ grep ตาม requestId ได้
 */
export function logLine(level, payload) {
  const line = {
    ts: new Date().toISOString(),
    level,
    ...payload
  };
  if (level === 'error') {
    console.error(JSON.stringify(line));
  } else {
    console.log(JSON.stringify(line));
  }
}
