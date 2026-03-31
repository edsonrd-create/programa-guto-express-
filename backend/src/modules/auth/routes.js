import { Router } from 'express';
import { getCorsAllowedOrigins } from '../../lib/corsConfig.js';
import { getBackendVersion } from '../../versionInfo.js';
import { z } from 'zod';
import { timingSafeEqualString } from '../../lib/timingSafe.js';
import { issueAdminJwt, isAdminJwtEnabled } from '../../lib/adminJwt.js';

/**
 * Estado de autenticação (stub evolutivo).
 * Futuro: sessão/JWT; hoje o painel usa a mesma chave que a API (Bearer / X-Admin-Key).
 */
export function createAuthRouter() {
  const r = Router();

  const LoginBodySchema = z
    .object({
      admin_key: z.string().trim().min(1),
      ttl_seconds: z.number().int().min(30).max(60 * 60 * 24).optional(),
    })
    .strict();

  r.post('/login', async (req, res) => {
    const expected = (process.env.ADMIN_API_KEY || '').trim();
    if (!expected) {
      return res.status(503).json({
        ok: false,
        code: 'ADMIN_API_KEY_REQUIRED',
        message: 'ADMIN_API_KEY nao configurado no servidor.',
      });
    }
    if (!isAdminJwtEnabled()) {
      return res.status(501).json({
        ok: false,
        code: 'JWT_DISABLED',
        message: 'ADMIN_JWT_SECRET nao configurado. Defina para habilitar login JWT.',
      });
    }

    const parsed = LoginBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, code: 'BAD_REQUEST', issues: parsed.error.issues });
    }

    const provided = String(parsed.data.admin_key || '').trim();
    if (!timingSafeEqualString(provided, expected)) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="admin"');
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Chave invalida.' });
    }

    const issued = await issueAdminJwt({
      subject: 'admin',
      ttlSeconds: parsed.data.ttl_seconds ?? 60 * 60,
    });
    return res.json({
      ok: true,
      token: issued.token,
      expiresInSec: issued.ttlSeconds,
      scheme: 'bearer_jwt',
    });
  });

  r.get('/status', (_req, res) => {
    const keySet = Boolean((process.env.ADMIN_API_KEY || '').trim());
    const rawGlobalMax = (process.env.GLOBAL_RATE_LIMIT_MAX || '').trim();
    const globalMax = rawGlobalMax === '' ? null : Number(rawGlobalMax);
    res.json({
      ok: true,
      backendVersion: getBackendVersion(),
      nodeEnv: process.env.NODE_ENV || 'development',
      adminApiKeyConfigured: keySet,
      jwtEnabled: isAdminJwtEnabled(),
      scheme: keySet ? (isAdminJwtEnabled() ? 'bearer_jwt_or_admin' : 'bearer_admin') : 'none',
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
