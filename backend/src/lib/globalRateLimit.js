import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Limite global por IP (opcional). Ative com `GLOBAL_RATE_LIMIT_MAX` > 0.
 * Exclui: `OPTIONS`, `GET /health`, `GET /metrics`, `POST /integrations/webhook/*`.
 * Útil atrás de proxy com `TRUST_PROXY` para `req.ip` correto.
 */
export function createGlobalRateLimiter() {
  const raw = (process.env.GLOBAL_RATE_LIMIT_MAX || '').trim();
  const max = raw === '' ? 0 : Number(raw);
  if (!Number.isFinite(max) || max <= 0) {
    return function globalRateLimitNoop(_req, _res, next) {
      next();
    };
  }

  const windowMs = Math.max(1000, Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || 60_000) || 60_000);

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: 'RATE_LIMIT',
      message: 'Muitas requisicoes; aguarde e tente novamente.',
    },
    keyGenerator: (req) => ipKeyGenerator(req),
    skip: (req) => {
      if (req.method === 'OPTIONS') return true;
      const p = req.path || '';
      if (p === '/health' || p === '/metrics') return true;
      if (p.startsWith('/integrations/webhook/')) return true;
      return false;
    },
  });
}
