import { Router } from 'express';

/** Motoristas e fila operacional. Montado em `/drivers`. */
export function createDriversRouter(db) {
  const r = Router();

  r.get('/queue', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT dq.id, dq.entered_at, d.id driver_id, d.name, d.status,
                d.last_lat, d.last_lng, d.location_updated_at
           FROM driver_queue dq
           JOIN drivers d ON d.id = dq.driver_id
          WHERE dq.active = 1
          ORDER BY dq.entered_at ASC`,
      )
      .all();
    res.json(rows);
  });

  r.post('/', (req, res) => {
    const { name, phone = null } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, message: 'name e obrigatorio' });
    const result = db.prepare("INSERT INTO drivers (name, phone, status) VALUES (?, ?, 'disponivel')").run(name, phone);
    res.status(201).json({ id: result.lastInsertRowid, name, phone, status: 'disponivel' });
  });

  r.get('/', (_req, res) => {
    res.json(db.prepare('SELECT * FROM drivers ORDER BY id DESC').all());
  });

  r.post('/:id/check-in', (req, res) => {
    const id = Number(req.params.id);
    const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    if (!driver) return res.status(404).json({ ok: false, message: 'Motorista nao encontrado' });

    const existing = db.prepare('SELECT id FROM driver_queue WHERE driver_id = ? AND active = 1').get(id);
    if (existing) return res.status(409).json({ ok: false, message: 'Motorista ja esta na fila ativa' });

    db.transaction(() => {
      db.prepare("UPDATE drivers SET status = 'fila' WHERE id = ?").run(id);
      db.prepare('INSERT INTO driver_queue (driver_id, active) VALUES (?, 1)').run(id);
    })();

    res.json({ ok: true, driver_id: id });
  });

  /** App do motoboy / painel: atualiza posição para modo de fila por proximidade (GPS). */
  r.post('/:id/location', (req, res) => {
    const id = Number(req.params.id);
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ ok: false, message: 'lat e lng validos obrigatorios' });
    }
    const driver = db.prepare('SELECT id FROM drivers WHERE id = ?').get(id);
    if (!driver) return res.status(404).json({ ok: false, message: 'Motorista nao encontrado' });
    db.prepare(
      'UPDATE drivers SET last_lat = ?, last_lng = ?, location_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(lat, lng, id);
    res.json({ ok: true, driver_id: id, lat, lng });
  });

  return r;
}
