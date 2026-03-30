import { Router } from 'express';
import {
  MenuItemCreateBodySchema,
  MenuItemPatchBodySchema,
  validationErrorResponse,
} from '../../validation/httpSchemas.js';

/** Cardápio — catálogo (`GET /items`) + gestão CRUD (`/manage/items`). */
export function createMenuRouter(db) {
  const r = Router();

  const listCatalogStmt = db.prepare(`
    SELECT id, name, unit_price AS unitPrice, active, sort_order AS sortOrder, notes, created_at AS createdAt
    FROM menu_items
    WHERE active = 1
    ORDER BY sort_order ASC, id ASC
  `);

  const listManageStmt = db.prepare(`
    SELECT id, name, unit_price AS unitPrice, active, sort_order AS sortOrder, notes, created_at AS createdAt
    FROM menu_items
    ORDER BY sort_order ASC, id ASC
  `);

  const getByIdStmt = db.prepare(`
    SELECT id, name, unit_price AS unitPrice, active, sort_order AS sortOrder, notes, created_at AS createdAt
    FROM menu_items WHERE id = ?
  `);

  r.get('/items', (_req, res) => {
    try {
      const items = listCatalogStmt.all();
      res.json({
        ok: true,
        items,
        source: 'database',
        hint:
          items.length === 0
            ? 'Sem itens ativos: use Cardápio no painel ou texto livre no atendimento.'
            : undefined,
      });
    } catch (e) {
      console.error('[menu]', e);
      res.status(500).json({ ok: false, message: 'Erro ao listar cardápio' });
    }
  });

  r.get('/manage/items', (_req, res) => {
    try {
      const items = listManageStmt.all();
      res.json({ ok: true, items });
    } catch (e) {
      console.error('[menu]', e);
      res.status(500).json({ ok: false, message: 'Erro ao listar itens (gestão)' });
    }
  });

  r.post('/manage/items', (req, res) => {
    const parsed = MenuItemCreateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));
    const { name, unit_price, active, sort_order, notes } = parsed.data;
    try {
      const ins = db
        .prepare(
          `INSERT INTO menu_items (name, unit_price, active, sort_order, notes)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(name, unit_price, active ? 1 : 0, sort_order, notes);
      const item = getByIdStmt.get(ins.lastInsertRowid);
      res.status(201).json({ ok: true, item });
    } catch (e) {
      console.error('[menu]', e);
      res.status(500).json({ ok: false, message: 'Erro ao criar item' });
    }
  });

  r.patch('/manage/items/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id invalido' });
    }
    const parsed = MenuItemPatchBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));
    const data = parsed.data;
    const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Item nao encontrado' });

    const sets = [];
    const vals = [];
    if (data.name !== undefined) {
      sets.push('name = ?');
      vals.push(data.name);
    }
    if (data.unit_price !== undefined) {
      sets.push('unit_price = ?');
      vals.push(data.unit_price);
    }
    if (data.active !== undefined) {
      sets.push('active = ?');
      vals.push(data.active ? 1 : 0);
    }
    if (data.sort_order !== undefined) {
      sets.push('sort_order = ?');
      vals.push(data.sort_order);
    }
    if (data.notes !== undefined) {
      sets.push('notes = ?');
      vals.push(data.notes);
    }

    try {
      vals.push(id);
      db.prepare(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      const item = getByIdStmt.get(id);
      res.json({ ok: true, item });
    } catch (e) {
      console.error('[menu]', e);
      res.status(500).json({ ok: false, message: 'Erro ao atualizar item' });
    }
  });

  return r;
}
