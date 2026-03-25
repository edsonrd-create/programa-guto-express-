import { Router } from 'express';

export function createKdsRouter(db) {
  const router = Router();

  router.get('/kds', (_req, res) => {
    const rows = db.prepare(`SELECT o.*, (SELECT COALESCE(SUM(quantity),0) FROM order_items oi WHERE oi.order_id = o.id) total_items FROM orders o WHERE o.status IN ('novo','em_preparo','pronto') ORDER BY id ASC`).all();
    res.json(rows);
  });

  router.post('/kds/:orderId/start', (req, res) => {
    const id = Number(req.params.orderId);
    db.prepare("UPDATE orders SET status = 'em_preparo' WHERE id = ?").run(id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(id, 'em_preparo', 'Pedido iniciado no KDS');
    db.prepare('INSERT INTO kds_events (order_id, event_type) VALUES (?, ?)').run(id, 'start');
    res.json({ ok: true });
  });

  router.post('/kds/:orderId/ready', (req, res) => {
    const id = Number(req.params.orderId);
    db.prepare("UPDATE orders SET status = 'pronto' WHERE id = ?").run(id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(id, 'pronto', 'Pedido finalizado no KDS');
    db.prepare('INSERT INTO kds_events (order_id, event_type) VALUES (?, ?)').run(id, 'ready');
    res.json({ ok: true });
  });

  return router;
}
