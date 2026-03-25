import { Router } from 'express';

/** Clientes da pizzaria (CRM mínimo). Rotas montadas em `/clients`. */
export function createCustomersRouter(db) {
  const r = Router();

  r.post('/', (req, res) => {
    const { name, phone } = req.body || {};
    if (!name || !phone) return res.status(400).json({ ok: false, message: 'name e phone sao obrigatorios' });
    const result = db.prepare('INSERT INTO clients (name, phone) VALUES (?, ?)').run(name, phone);
    res.status(201).json({ id: result.lastInsertRowid, name, phone });
  });

  r.get('/', (_req, res) => {
    res.json(db.prepare('SELECT * FROM clients ORDER BY id DESC').all());
  });

  return r;
}
