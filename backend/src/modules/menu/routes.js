import { Router } from 'express';

/** Cardápio (stub) — integração futura com ERP / itens dinâmicos. */
export function createMenuRouter() {
  const r = Router();
  r.get('/items', (_req, res) => {
    res.json({
      items: [],
      hint: 'Sem itens persistidos ainda; pedidos usam texto livre no painel.'
    });
  });
  return r;
}
