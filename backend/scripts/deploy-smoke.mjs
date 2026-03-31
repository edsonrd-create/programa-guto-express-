/**
 * Smoke pós-deploy contra uma API já publicada (sem chaves).
 * Valida GET /health, GET /auth/status; opcionalmente a página estática do painel.
 *
 * Uso:
 *   node scripts/deploy-smoke.mjs https://seudominio.com/api
 *   SMOKE_BASE_URL=https://api.exemplo.com node scripts/deploy-smoke.mjs
 *
 * Opcional:
 *   SMOKE_EXPECT_VERSION=0.2.1  — campo version em /health deve coincidir
 *   SMOKE_SKIP_SECURITY_HEADERS=1 — não exige X-Content-Type-Options / Referrer-Policy / X-Frame-Options
 *   SMOKE_PANEL_URL=https://seudominio.com — GET HTML; verifica 200 e #root (build Vite)
 *   SMOKE_EXPECT_AUTH_MODE=jwt_only — exige authMode em /auth/status
 *   SMOKE_EXPECT_JWT_ENABLED=1 — exige jwtEnabled=true em /auth/status
 */

function baseUrl() {
  const arg = (process.argv[2] || '').trim();
  if (arg && arg !== '--help' && arg !== '-h') return arg.replace(/\/$/, '');
  return (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');
}

function checkSecurityHeaders(res) {
  const skipSec = (process.env.SMOKE_SKIP_SECURITY_HEADERS || '').trim() === '1';
  if (skipSec) return;
  const nosniff = (res.headers.get('x-content-type-options') || '').toLowerCase();
  if (nosniff !== 'nosniff') {
    console.error('[deploy-smoke] esperado X-Content-Type-Options: nosniff, obtido', JSON.stringify(nosniff));
    process.exit(1);
  }
  const refpol = (res.headers.get('referrer-policy') || '').toLowerCase();
  if (!refpol.includes('strict-origin')) {
    console.error('[deploy-smoke] Referrer-Policy inesperado', res.headers.get('referrer-policy'));
    process.exit(1);
  }
  const xfo = (res.headers.get('x-frame-options') || '').toUpperCase();
  if (xfo !== 'DENY' && xfo !== 'SAMEORIGIN') {
    console.error('[deploy-smoke] X-Frame-Options inesperado', res.headers.get('x-frame-options'));
    process.exit(1);
  }
}

async function expectJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error('[deploy-smoke] não-JSON em', url, text.slice(0, 200));
    process.exit(1);
  }
  if (res.status < 200 || res.status >= 300) {
    console.error('[deploy-smoke] HTTP', res.status, url, json);
    process.exit(1);
  }
  return { res, json };
}

async function main() {
  if (process.argv[2] === '--help' || process.argv[2] === '-h') {
    console.log(`deploy-smoke — health + auth/status (+ painel opcional)

Argumento: URL base da API (ex.: https://dominio.com/api)
Ou env: SMOKE_BASE_URL

Opcional: SMOKE_EXPECT_VERSION, SMOKE_SKIP_SECURITY_HEADERS=1, SMOKE_PANEL_URL`);
    process.exit(0);
  }

  const base = baseUrl();
  console.log('[deploy-smoke] base', base);

  const { res: hRes, json: health } = await expectJson(`${base}/health`);
  checkSecurityHeaders(hRes);

  if (health.ok !== true) {
    console.error('[deploy-smoke] health.ok !== true', health);
    process.exit(1);
  }
  if (health.service !== 'guto-express-backend') {
    console.error('[deploy-smoke] health.service inesperado', health.service);
    process.exit(1);
  }
  if (typeof health.version !== 'string' || !health.version.trim()) {
    console.error('[deploy-smoke] health.version em falta', health);
    process.exit(1);
  }
  if (typeof health.node !== 'string' || !health.node.trim()) {
    console.error('[deploy-smoke] health.node em falta', health);
    process.exit(1);
  }

  const expectV = (process.env.SMOKE_EXPECT_VERSION || '').trim();
  if (expectV && health.version !== expectV) {
    console.error('[deploy-smoke] esperado version', JSON.stringify(expectV), 'obtido', JSON.stringify(health.version));
    process.exit(1);
  }

  const { res: aRes, json: auth } = await expectJson(`${base}/auth/status`);
  checkSecurityHeaders(aRes);

  if (auth.ok !== true) {
    console.error('[deploy-smoke] auth/status ok !== true', auth);
    process.exit(1);
  }
  if (typeof auth.backendVersion !== 'string' || auth.backendVersion !== health.version) {
    console.error('[deploy-smoke] auth.backendVersion deve coincidir com health.version', {
      auth: auth.backendVersion,
      health: health.version,
    });
    process.exit(1);
  }
  if (typeof auth.adminApiKeyConfigured !== 'boolean') {
    console.error('[deploy-smoke] auth.adminApiKeyConfigured em falta', auth);
    process.exit(1);
  }
  const expectAuthMode = (process.env.SMOKE_EXPECT_AUTH_MODE || '').trim();
  if (expectAuthMode && String(auth.authMode || '') !== expectAuthMode) {
    console.error('[deploy-smoke] authMode inesperado', {
      esperado: expectAuthMode,
      obtido: auth.authMode,
    });
    process.exit(1);
  }
  if ((process.env.SMOKE_EXPECT_JWT_ENABLED || '').trim() === '1' && auth.jwtEnabled !== true) {
    console.error('[deploy-smoke] jwtEnabled esperado true', auth);
    process.exit(1);
  }

  const panel = (process.env.SMOKE_PANEL_URL || '').trim().replace(/\/$/, '');
  if (panel) {
    const pres = await fetch(panel);
    const html = await pres.text();
    if (pres.status !== 200) {
      console.error('[deploy-smoke] painel HTTP', pres.status, panel);
      process.exit(1);
    }
    const okRoot =
      html.includes('id="root"') ||
      html.includes("id='root'") ||
      html.includes('id="root" ') ||
      /<div[^>]+id\s*=\s*["']root["']/.test(html);
    if (!okRoot) {
      console.error('[deploy-smoke] painel: não encontrado #root em', panel);
      process.exit(1);
    }
    console.log('[deploy-smoke] painel OK', panel);
  }

  console.log(
    '[deploy-smoke] OK — version',
    health.version,
    'node',
    health.node,
    'adminKey',
    auth.adminApiKeyConfigured,
    'authMode',
    auth.authMode ?? 'n/a',
    'jwtEnabled',
    auth.jwtEnabled ?? 'n/a',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
