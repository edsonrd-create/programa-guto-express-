import cors from 'cors';

/** Lista de origens a partir de `CORS_ORIGINS` / `CORS_ORIGIN` (vírgulas). */
export function getCorsAllowedOrigins() {
  const raw = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '').trim();
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * CORS: em desenvolvimento, permissivo. Em `NODE_ENV=production`, lista explícita
 * em `CORS_ORIGINS` ou `CORS_ORIGIN` (várias origens separadas por vírgula).
 * Pedidos sem header `Origin` (curl, servidor, alguns proxies) continuam aceites.
 */
export function createCorsMiddleware() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    return cors();
  }

  const list = getCorsAllowedOrigins();
  const allowed = new Set(list);

  if (list.length === 0) {
    console.warn(
      '[cors] NODE_ENV=production sem CORS_ORIGINS — browsers noutra origem ficam bloqueados. ' +
        'Defina CORS_ORIGINS=https://seu-painel (várias: separadas por vírgula).',
    );
  }

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
    maxAge: 86400,
  });
}
