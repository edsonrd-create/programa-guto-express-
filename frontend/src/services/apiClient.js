/**
 * Cliente HTTP do painel → API Express (backend).
 * @see getApiPublicBase
 */
export function getApiPublicBase() {
  const raw = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3210').trim();
  return raw.replace(/\/$/, '');
}

/** URL WebSocket do hub operacional (mesmo host/porta que a API). */
export function getWsOpsUrl(wsPath = '/ws/ops') {
  const u = new URL(getApiPublicBase());
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = wsPath.startsWith('/') ? wsPath : `/${wsPath}`;
  u.search = '';
  u.hash = '';
  return u.toString();
}

function joinPath(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
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
