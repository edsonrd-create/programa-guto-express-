import { Router } from 'express';

/**
 * Estado de autenticação (stub evolutivo).
 * Hoje o painel é interno; rotas sensíveis podem usar Bearer (ex.: /ai/chat).
 */
export function createAuthRouter() {
  const r = Router();
  r.get('/status', (_req, res) => {
    const keySet = Boolean((process.env.ADMIN_API_KEY || '').trim());
    res.json({
      ok: true,
      adminApiKeyConfigured: keySet,
      scheme: keySet ? 'bearer_admin' : 'none',
      hint: keySet
        ? 'Rotas administrativas exigem Authorization: Bearer ou X-Admin-Key (mesmo valor que ADMIN_API_KEY).'
        : 'Defina ADMIN_API_KEY no backend e VITE_ADMIN_API_KEY no frontend para testes reais.',
    });
  });
  return r;
}
