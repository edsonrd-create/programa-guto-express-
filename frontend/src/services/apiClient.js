/**
 * Cliente HTTP do painel → API Express (backend).
 * @see getApiPublicBase
 *
 * Em dev, sem `VITE_API_URL`, usa URL vazia → pedidos relativos ao Vite e passam pelo `server.proxy`.
 * Em produção ou com `VITE_API_URL` definido, usa a base absoluta da API.
 */
export function getApiPublicBase() {
  const envRaw = import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV && (envRaw === undefined || String(envRaw).trim() === '')) {
    return '';
  }
  // Em staging com nginx, normalmente a UI e API ficam na mesma origem, com API exposta em /api.
  if (!import.meta.env.DEV && (envRaw === undefined || String(envRaw).trim() === '')) {
    return '/api';
  }
  const raw = String(envRaw || 'http://127.0.0.1:3210').trim();
  return raw.replace(/\/$/, '');
}

/** URL WebSocket do hub operacional (mesmo host/porta que a API). */
export function getWsOpsUrl(wsPath = '/ws/ops') {
  const pathOnly = wsPath.startsWith('/') ? wsPath : `/${wsPath}`;
  const wsToken = (import.meta.env.VITE_OPS_WS_TOKEN || '').trim();
  const staticKey = (import.meta.env.VITE_ADMIN_API_KEY || '').trim();
  const allowStaticAdminKey =
    import.meta.env.DEV || String(import.meta.env.VITE_ALLOW_STATIC_ADMIN_KEY || '').trim() === '1';
  const secret = wsToken || (allowStaticAdminKey ? staticKey : '');
  const q = secret ? `?token=${encodeURIComponent(secret)}` : '';

  const base = getApiPublicBase();
  if (base === '/api' && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPathOnly = pathOnly.startsWith('/ws/') ? pathOnly : `/ws${pathOnly}`;
    return `${proto}//${window.location.host}${wsPathOnly}${q}`;
  }

  if (!base && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${pathOnly}${q}`;
  }

  const u = new URL(base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = pathOnly;
  u.search = secret ? `token=${encodeURIComponent(secret)}` : '';
  u.hash = '';
  return u.toString();
}

function joinPath(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const ADMIN_JWT_STORAGE_KEY = 'guto_admin_jwt';
const ADMIN_JWT_EXP_STORAGE_KEY = 'guto_admin_jwt_exp';

function nowUnixSec() {
  return Math.floor(Date.now() / 1000);
}

function readJwtExpFromToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const payloadRaw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadRaw + '==='.slice((payloadRaw.length + 3) % 4);
    const payload = JSON.parse(atob(padded));
    if (!payload || typeof payload !== 'object') return null;
    const exp = Number(payload.exp);
    return Number.isFinite(exp) && exp > 0 ? Math.trunc(exp) : null;
  } catch {
    return null;
  }
}

export function getAdminJwt() {
  try {
    const token = (sessionStorage.getItem(ADMIN_JWT_STORAGE_KEY) || '').trim();
    if (!token) return '';
    const expRaw = Number(sessionStorage.getItem(ADMIN_JWT_EXP_STORAGE_KEY) || 0);
    const exp = Number.isFinite(expRaw) && expRaw > 0 ? Math.trunc(expRaw) : readJwtExpFromToken(token);
    if (exp != null && exp <= nowUnixSec() + 15) {
      setAdminJwt('');
      return '';
    }
    return token;
  } catch {
    return '';
  }
}

export function setAdminJwt(token, expiresAtUnixSec = null) {
  const t = String(token || '').trim();
  try {
    if (!t) {
      sessionStorage.removeItem(ADMIN_JWT_STORAGE_KEY);
      sessionStorage.removeItem(ADMIN_JWT_EXP_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(ADMIN_JWT_STORAGE_KEY, t);
    const exp = Number(expiresAtUnixSec);
    if (Number.isFinite(exp) && exp > 0) {
      sessionStorage.setItem(ADMIN_JWT_EXP_STORAGE_KEY, String(Math.trunc(exp)));
    } else {
      const inferred = readJwtExpFromToken(t);
      if (inferred != null) sessionStorage.setItem(ADMIN_JWT_EXP_STORAGE_KEY, String(inferred));
      else sessionStorage.removeItem(ADMIN_JWT_EXP_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export async function loginAdminWithKey(adminKey) {
  const body = { admin_key: String(adminKey || '').trim() };
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify(body),
  });
  if (data?.ok && typeof data?.token === 'string') {
    setAdminJwt(data.token, data.expiresAtUnixSec ?? null);
  }
  return data;
}

export async function refreshAdminJwt() {
  const data = await apiFetch('/auth/refresh', { method: 'POST' });
  if (data?.ok && typeof data?.token === 'string') {
    setAdminJwt(data.token, data.expiresAtUnixSec ?? null);
  }
  return data;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
function attachAuth(headers) {
  const jwt = getAdminJwt();
  if (jwt) {
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${jwt}`);
    return;
  }
  const allowStaticAdminKey =
    import.meta.env.DEV || String(import.meta.env.VITE_ALLOW_STATIC_ADMIN_KEY || '').trim() === '1';
  if (!allowStaticAdminKey) return;
  const k = (import.meta.env.VITE_ADMIN_API_KEY || '').trim();
  if (!k) return;
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${k}`);
  if (!headers.has('X-Admin-Key')) headers.set('X-Admin-Key', k);
}

export async function apiFetch(path, init = {}) {
  const url = joinPath(getApiPublicBase(), path);
  const headers = new Headers(init.headers);
  if (!init.skipAuth) attachAuth(headers);
  if (init.body != null && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data.message ? String(data.message) : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export function apiGet(path) {
  return apiFetch(path, { method: 'GET' });
}

export function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined });
}

export function apiPatch(path, body) {
  return apiFetch(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined });
}
