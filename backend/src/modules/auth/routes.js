import { Router } from 'express';

/**
 * Estado de autenticação (stub evolutivo).
 * Hoje o painel é interno; rotas sensíveis podem usar Bearer (ex.: /ai/chat).
 */
export function createAuthRouter() {
  const r = Router();
  r.get('/status', (_req, res) => {
    res.json({
      ok: true,
      authenticated: false,
      scheme: 'none',
      hint: 'Use ADMIN_API_KEY no backend para proteger /ai/chat; login de painel virá aqui.'
    });
  });
  return r;
}
