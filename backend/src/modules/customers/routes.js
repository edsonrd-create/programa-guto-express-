import { Router } from 'express';
import { ClientCreateBodySchema, validationErrorResponse } from '../../validation/httpSchemas.js';

/** Clientes da pizzaria (CRM mínimo). Rotas montadas em `/clients`. */
export function createCustomersRouter(db) {
  const r = Router();

  r.post('/', (req, res) => {
    const parsed = ClientCreateBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));
    const { name, phone } = parsed.data;
    const result = db.prepare('INSERT INTO clients (name, phone) VALUES (?, ?)').run(name, phone);
    res.status(201).json({ id: result.lastInsertRowid, name, phone });
  });

  r.get('/', (_req, res) => {
    res.json(db.prepare('SELECT * FROM clients ORDER BY id DESC').all());
  });

  return r;
}
