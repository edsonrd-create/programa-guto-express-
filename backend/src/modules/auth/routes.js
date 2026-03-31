import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getCorsAllowedOrigins } from '../../lib/corsConfig.js';
import { getBackendVersion } from '../../versionInfo.js';
import { z } from 'zod';
import { timingSafeEqualString } from '../../lib/timingSafe.js';
import {
  getAdminAuthMode,
  getAdminJwtTtlSeconds,
  issueAdminJwt,
  isAdminJwtEnabled,
  tryVerifyAdminJwt,
} from '../../lib/adminJwt.js';

/**
 * Estado de autenticação (stub evolutivo).
 * Futuro: sessão/JWT; hoje o painel usa a mesma chave que a API (Bearer / X-Admin-Key).
 */
export function createAuthRouter() {
  const r = Router();

  const LoginBodySchema = z
    .object({
      admin_key: z.string().trim().min(1),
    })
    .strict();

  const loginLimiter = rateLimit({
    windowMs: Math.max(10_000, Number(process.env.ADMIN_LOGIN_RATE_WINDOW_MS || 60_000) || 60_000),
    max: Math.max(1, Number(process.env.ADMIN_LOGIN_RATE_MAX || 5) || 5),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req),
    message: {
      ok: false,
      code: 'RATE_LIMIT',
      message: 'Muitas tentativas de login; aguarde e tente novamente.',
    },
  });

  function readBearerToken(req) {
    const auth = String(req.headers.authorization || '');
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    return m ? m[1].trim() : '';
  }

  r.post('/login', loginLimiter, async (req, res) => {
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
      ttlSeconds: getAdminJwtTtlSeconds(),
    });
    return res.json({
      ok: true,
      token: issued.token,
      expiresInSec: issued.ttlSeconds,
      expiresAtUnixSec: issued.exp,
      scheme: 'bearer_jwt',
    });
  });

  r.post('/refresh', async (req, res) => {
    if (!isAdminJwtEnabled()) {
      return res.status(501).json({
        ok: false,
        code: 'JWT_DISABLED',
        message: 'ADMIN_JWT_SECRET nao configurado.',
      });
    }
    const token = readBearerToken(req);
    if (!token) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="admin"');
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Token ausente.' });
    }
    const check = await tryVerifyAdminJwt(token);
    if (!check.ok) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="admin"');
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Token invalido.' });
    }

    const issued = await issueAdminJwt({
      subject: String(check.payload?.sub || 'admin'),
      ttlSeconds: getAdminJwtTtlSeconds(),
    });
    return res.json({
      ok: true,
      token: issued.token,
      expiresInSec: issued.ttlSeconds,
      expiresAtUnixSec: issued.exp,
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
      authMode: getAdminAuthMode(),
      jwtTtlSec: getAdminJwtTtlSeconds(),
      scheme: keySet ? (isAdminJwtEnabled() ? 'bearer_jwt_or_admin' : 'bearer_admin') : 'none',
      corsWhitelistSize: getCorsAllowedOrigins().length,
      globalRateLimitMax:
        globalMax != null && Number.isFinite(globalMax) && globalMax > 0 ? globalMax : null,
      hint: keySet
        ? 'Rotas administrativas exigem Authorization (JWT ou ADMIN_API_KEY, conforme ADMIN_AUTH_MODE).'
        : 'Defina ADMIN_API_KEY no backend para habilitar login administrativo.',
      roadmap:
        'Autenticação evolutiva: hoje chave partilhada; futuro opcional sessão/JWT por utilizador operacional.',
    });
  });
  return r;
}
