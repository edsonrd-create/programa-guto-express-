import { timingSafeEqualString } from '../lib/timingSafe.js';
import { isAdminJwtOnlyMode, tryVerifyAdminJwt } from '../lib/adminJwt.js';

/**
 * Protege a API administrativa. Parâmetros públicos (sem chave):
 * - `GET /health`
 * - `GET /metrics` (ou com METRICS_TOKEN próprio)
 * - `POST /integrations/webhook/:channel` (parceiros externos; assinatura HMAC no handler)
 * - `GET /auth/status` (indica se ADMIN_API_KEY está ativa, sem revelar o segredo)
 *
 * Defina `ADMIN_API_KEY` no `.env` do backend. Em `NODE_ENV=production`, a chave é obrigatória.
 * Sem chave em desenvolvimento: acesso liberado (aviso no console ao subir o servidor).
 */
export function createAdminApiKeyMiddleware() {
  const expected = (process.env.ADMIN_API_KEY || '').trim();
  const production = process.env.NODE_ENV === 'production';
  const jwtOnlyMode = isAdminJwtOnlyMode();

  return async function adminApiKey(req, res, next) {
    if (req.method === 'OPTIONS') return next();

    const p = req.path || '';
    if (p === '/health' || p === '/metrics' || p === '/auth/status') return next();
    if (req.method === 'POST' && p === '/auth/login') return next();
    if (p.startsWith('/integrations/webhook/')) return next();

    if (!expected) {
      if (production) {
        return res.status(503).json({
          ok: false,
          code: 'ADMIN_API_KEY_REQUIRED',
          message: 'Servidor em producao sem ADMIN_API_KEY. Configure no ambiente.',
        });
      }
      return next();
    }

    const auth = String(req.headers.authorization || '');
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    const fromBearer = m ? m[1].trim() : '';
    const fromHeader = typeof req.headers['x-admin-key'] === 'string' ? req.headers['x-admin-key'].trim() : '';
    const provided = fromBearer || fromHeader;

    // JWT opcional (evita enviar ADMIN_API_KEY em todas as requests). Se falhar, cai no modo chave.
    if (fromBearer && fromBearer.split('.').length === 3) {
      const v = await tryVerifyAdminJwt(fromBearer);
      if (v.ok) return next();
      if (jwtOnlyMode) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="admin"');
        return res.status(401).json({
          ok: false,
          code: 'UNAUTHORIZED',
          message: 'JWT invalido/expirado. Faça login novamente em /auth/login.',
        });
      }
    }

    if (jwtOnlyMode) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="admin"');
      return res.status(401).json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Modo jwt_only ativo: envie Authorization: Bearer <ADMIN_JWT>.',
      });
    }

    if (!timingSafeEqualString(provided, expected)) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="admin"');
      return res.status(401).json({
        ok: false,
        code: 'UNAUTHORIZED',
        message:
          'API administrativa: envie Authorization: Bearer <ADMIN_JWT> (se habilitado) ou Authorization: Bearer <ADMIN_API_KEY> ou header X-Admin-Key (mesmo valor do servidor).',
      });
    }
    next();
  };
}
