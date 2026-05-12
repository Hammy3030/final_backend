#!/usr/bin/env bash
# Release smoke: ตรวจว่า API ตอบและ (ถ้ามี) login ได้
# ใช้งาน: ./scripts/smoke-release.sh
# หรือ: SMOKE_BASE_URL=https://api.example.com SMOKE_LOGIN_EMAIL=... SMOKE_LOGIN_PASSWORD=... ./scripts/smoke-release.sh

set -euo pipefail

BASE="${SMOKE_BASE_URL:-http://localhost:3000}"
echo "[smoke] GET $BASE/health"
code="$(curl -s -o /tmp/smoke-health.json -w "%{http_code}" "$BASE/health" || true)"
if [[ "$code" != "200" ]]; then
  echo "[smoke] FAIL health HTTP $code"
  exit 1
fi
echo "[smoke] health OK"

if [[ -n "${SMOKE_LOGIN_EMAIL:-}" && -n "${SMOKE_LOGIN_PASSWORD:-}" ]]; then
  echo "[smoke] POST $BASE/api/auth/login"
  login_code="$(curl -s -o /tmp/smoke-login.json -w "%{http_code}" \
    -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SMOKE_LOGIN_EMAIL}\",\"password\":\"${SMOKE_LOGIN_PASSWORD}\"}" || true)"
  if [[ "$login_code" != "200" ]]; then
    echo "[smoke] FAIL login HTTP $login_code"
    cat /tmp/smoke-login.json 2>/dev/null || true
    exit 1
  fi
  echo "[smoke] login OK"
fi

echo "[smoke] all checks passed"
