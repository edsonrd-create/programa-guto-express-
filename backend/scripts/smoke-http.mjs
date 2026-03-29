/**
 * Smoke HTTP: GET /health e validações opcionais de CORS (headers).
 * Uso local (com servidor a correr): SMOKE_BASE_URL=http://127.0.0.1:3210 node scripts/smoke-http.mjs
 *
 * Variáveis:
 * - SMOKE_BASE_URL — base da API (default http://127.0.0.1:3210)
 * - SMOKE_ORIGIN — se definido, envia header Origin
 * - SMOKE_EXPECT_ACAO — se definido, exige Access-Control-Allow-Origin exatamente igual
 * - SMOKE_FORBID_ACAO — se definido, falha se o header ACAO for exatamente este valor (origem bloqueada)
 * - SMOKE_SKIP_SECURITY_HEADERS=1 — não valida cabeçalhos defensivos (X-Content-Type-Options, etc.)
 */

const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');

async function main() {
  const origin = (process.env.SMOKE_ORIGIN || '').trim();
  /** @type {Record<string, string>} */
  const headers = {};
  if (origin) headers.Origin = origin;

  const res = await fetch(`${base}/health`, { headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error('[smoke-http] resposta não é JSON:', text.slice(0, 200));
    process.exit(1);
  }
  if (!json.ok) {
    console.error('[smoke-http] health.ok !== true', json);
    process.exit(1);
  }

  const expectAco = (process.env.SMOKE_EXPECT_ACAO || '').trim();
  if (expectAco) {
    const acao = res.headers.get('access-control-allow-origin');
    if (acao !== expectAco) {
      console.error('[smoke-http] esperado ACAO', JSON.stringify(expectAco), 'obtido', JSON.stringify(acao));
      process.exit(1);
    }
  }

  const forbidAco = (process.env.SMOKE_FORBID_ACAO || '').trim();
  if (forbidAco) {
    const acao = res.headers.get('access-control-allow-origin');
    if (acao === forbidAco) {
      console.error('[smoke-http] origem não devia ser permitida:', forbidAco);
      process.exit(1);
    }
  }

  const skipSec = (process.env.SMOKE_SKIP_SECURITY_HEADERS || '').trim() === '1';
  if (!skipSec) {
    const nosniff = (res.headers.get('x-content-type-options') || '').toLowerCase();
    if (nosniff !== 'nosniff') {
      console.error('[smoke-http] esperado X-Content-Type-Options: nosniff, obtido', JSON.stringify(nosniff));
      process.exit(1);
    }
    const refpol = (res.headers.get('referrer-policy') || '').toLowerCase();
    if (!refpol.includes('strict-origin')) {
      console.error('[smoke-http] Referrer-Policy inesperado', res.headers.get('referrer-policy'));
      process.exit(1);
    }
    const xfo = (res.headers.get('x-frame-options') || '').toUpperCase();
    if (xfo !== 'DENY' && xfo !== 'SAMEORIGIN') {
      console.error('[smoke-http] X-Frame-Options inesperado', res.headers.get('x-frame-options'));
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
