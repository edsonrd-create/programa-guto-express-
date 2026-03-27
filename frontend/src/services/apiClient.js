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
  const secret = (import.meta.env.VITE_OPS_WS_TOKEN || '').trim();
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

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init = {}) {
  const url = joinPath(getApiPublicBase(), path);
  const headers = new Headers(init.headers);
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
