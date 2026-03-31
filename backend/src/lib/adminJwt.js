import { SignJWT, jwtVerify } from 'jose';

function getSecretKey() {
  const raw = (process.env.ADMIN_JWT_SECRET || '').trim();
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

export function isAdminJwtEnabled() {
  return Boolean(getSecretKey());
}

export async function tryVerifyAdminJwt(token) {
  const key = getSecretKey();
  if (!key) return { ok: false, code: 'JWT_DISABLED' };
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: 'guto-express-backend',
      audience: 'guto-express-admin',
    });
    if (payload?.typ !== 'admin') return { ok: false, code: 'JWT_WRONG_TYPE' };
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, code: 'JWT_INVALID', message: String(e?.message || e) };
  }
}

export async function issueAdminJwt({ subject = 'admin', ttlSeconds = 60 * 60 } = {}) {
  const key = getSecretKey();
  if (!key) {
    const err = new Error('ADMIN_JWT_SECRET nao configurado');
    err.code = 'JWT_DISABLED';
    throw err;
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.max(30, Number(ttlSeconds) || 3600);
  const token = await new SignJWT({ typ: 'admin' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setIssuer('guto-express-backend')
    .setAudience('guto-express-admin')
    .setSubject(subject)
    .setExpirationTime(exp)
    .sign(key);
  return { token, exp, ttlSeconds: exp - now };
}

