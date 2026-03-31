#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-www.pdvgutoexpress.com.br}"
API_BASE="${2:-https://${DOMAIN}/api}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v curl >/dev/null 2>&1; then
  echo "[prod-audit] erro: curl não encontrado." >&2
  exit 1
fi

echo "[prod-audit] domínio: ${DOMAIN}"
echo "[prod-audit] API base: ${API_BASE}"
echo

echo "== 1) backend service =="
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl status guto-backend --no-pager || true
else
  echo "[prod-audit] systemctl indisponível; pulando."
fi
echo

echo "== 2) nginx service/config =="
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
fi
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl status nginx --no-pager || true
fi
echo

echo "== 3) redirect/canonical =="
curl -I "http://pdvgutoexpress.com.br" || true
curl -I "https://pdvgutoexpress.com.br" || true
curl -I "https://${DOMAIN}" || true
echo

echo "== 4) health/auth status =="
curl -fsS "${API_BASE}/health"
echo
curl -fsS "${API_BASE}/auth/status"
echo
echo

echo "== 5) smoke hardening =="
(
  cd "${PROJECT_ROOT}"
  SMOKE_EXPECT_AUTH_MODE=jwt_only \
  SMOKE_EXPECT_JWT_ENABLED=1 \
  SMOKE_PANEL_URL="https://${DOMAIN}" \
  npm run smoke:deploy -- "${API_BASE}"
)
echo

echo "== 6) certbot renew dry-run =="
if command -v certbot >/dev/null 2>&1; then
  sudo certbot renew --dry-run
else
  echo "[prod-audit] certbot indisponível; pulando."
fi
echo

echo "[prod-audit] OK: auditoria final concluída."
