import { SignJWT, jwtVerify } from 'jose';

const JWT_ISSUER = 'guto-express-backend';
const JWT_AUDIENCE = 'guto-express-admin';

function getSecretKey() {
  const raw = (process.env.ADMIN_JWT_SECRET || '').trim();
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function getAdminAuthMode() {
  const raw = (process.env.ADMIN_AUTH_MODE || '').trim().toLowerCase();
  if (raw === 'jwt_only' || raw === 'api_key_only') return raw;
  return 'mixed';
}

export function isAdminJwtOnlyMode() {
  return getAdminAuthMode() === 'jwt_only';
}

export function getAdminJwtTtlSeconds() {
  const raw = Number(process.env.ADMIN_JWT_TTL_SECONDS || 3600);
  if (!Number.isFinite(raw) || raw <= 0) return 3600;
  return clamp(Math.trunc(raw), 60, 60 * 60 * 24);
}

export function isAdminJwtEnabled() {
  return Boolean(getSecretKey());
}

export async function tryVerifyAdminJwt(token) {
  const key = getSecretKey();
  if (!key) return { ok: false, code: 'JWT_DISABLED' };
  try {
    const clockToleranceRaw = Number(process.env.ADMIN_JWT_CLOCK_TOLERANCE_SEC || 5);
    const clockTolerance = Number.isFinite(clockToleranceRaw)
      ? clamp(Math.trunc(clockToleranceRaw), 0, 120)
      : 5;
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTolerance,
    });
    if (payload?.typ !== 'admin') return { ok: false, code: 'JWT_WRONG_TYPE' };
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, code: 'JWT_INVALID', message: String(e?.message || e) };
  }
}

export async function issueAdminJwt({ subject = 'admin', ttlSeconds } = {}) {
  const key = getSecretKey();
  if (!key) {
    const err = new Error('ADMIN_JWT_SECRET nao configurado');
    err.code = 'JWT_DISABLED';
    throw err;
  }
  const now = Math.floor(Date.now() / 1000);
  const ttl = ttlSeconds == null ? getAdminJwtTtlSeconds() : clamp(Math.trunc(Number(ttlSeconds) || 3600), 60, 60 * 60 * 24);
  const exp = now + ttl;
  const token = await new SignJWT({ typ: 'admin' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(subject)
    .setExpirationTime(exp)
    .sign(key);
  return { token, exp, ttlSeconds: exp - now };
}

