import { Router } from 'express';
import { getCorsAllowedOrigins } from '../../lib/corsConfig.js';
import { getBackendVersion } from '../../versionInfo.js';

/**
 * Estado de autenticação (stub evolutivo).
 * Futuro: sessão/JWT; hoje o painel usa a mesma chave que a API (Bearer / X-Admin-Key).
 */
export function createAuthRouter() {
  const r = Router();
  r.get('/status', (_req, res) => {
    const keySet = Boolean((process.env.ADMIN_API_KEY || '').trim());
    const rawGlobalMax = (process.env.GLOBAL_RATE_LIMIT_MAX || '').trim();
    const globalMax = rawGlobalMax === '' ? null : Number(rawGlobalMax);
    res.json({
      ok: true,
      backendVersion: getBackendVersion(),
      nodeEnv: process.env.NODE_ENV || 'development',
      adminApiKeyConfigured: keySet,
      scheme: keySet ? 'bearer_admin' : 'none',
      corsWhitelistSize: getCorsAllowedOrigins().length,
      globalRateLimitMax:
        globalMax != null && Number.isFinite(globalMax) && globalMax > 0 ? globalMax : null,
      hint: keySet
        ? 'Rotas administrativas exigem Authorization: Bearer ou X-Admin-Key (mesmo valor que ADMIN_API_KEY).'
        : 'Defina ADMIN_API_KEY no backend e VITE_ADMIN_API_KEY no frontend para testes reais.',
      roadmap:
        'Autenticação evolutiva: hoje chave partilhada; futuro opcional sessão/JWT por utilizador operacional.',
    });
  });
  return r;
}
