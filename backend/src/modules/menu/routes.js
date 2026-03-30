import { Router } from 'express';

/** Cardápio — itens em SQLite (`menu_items`). */
export function createMenuRouter(db) {
  const r = Router();

  const listStmt = db.prepare(`
    SELECT id, name, unit_price AS unitPrice, active, sort_order AS sortOrder, notes, created_at AS createdAt
    FROM menu_items
    WHERE active = 1
    ORDER BY sort_order ASC, id ASC
  `);

  r.get('/items', (_req, res) => {
    try {
      const items = listStmt.all();
      res.json({
        ok: true,
        items,
        source: 'database',
        hint:
          items.length === 0
            ? 'Tabela vazia: insira linhas em menu_items ou use texto livre nos pedidos.'
            : undefined,
      });
    } catch (e) {
      console.error('[menu]', e);
      res.status(500).json({ ok: false, message: 'Erro ao listar cardápio' });
    }
  });

  return r;
}
