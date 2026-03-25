import { Router } from 'express';

export function createDispatchRouter(db) {
  const router = Router();

  router.get('/dispatch', (_req, res) => {
    res.json(db.prepare("SELECT * FROM orders WHERE status IN ('pronto','aguardando_motoboy','despachado','entregue') ORDER BY id ASC").all());
  });

  router.get('/dispatch/deliveries', (_req, res) => {
    const rows = db.prepare('SELECT dl.*, d.name driver_name FROM deliveries dl LEFT JOIN drivers d ON d.id = dl.driver_id ORDER BY dl.id DESC').all();
    res.json(rows);
  });

  router.post('/dispatch/:orderId/assign-next-driver', (req, res) => {
    const orderId = Number(req.params.orderId);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Pedido nao encontrado' });
    if (order.status !== 'pronto') return res.status(400).json({ ok: false, message: 'Pedido precisa estar pronto' });
    const next = db.prepare('SELECT dq.id, dq.driver_id, d.name FROM driver_queue dq JOIN drivers d ON d.id = dq.driver_id WHERE dq.active = 1 ORDER BY dq.entered_at ASC LIMIT 1').get();
    if (!next) return res.status(400).json({ ok: false, message: 'Sem motoboy na fila' });
    const created = db.prepare("INSERT INTO deliveries (order_id, driver_id, status, assigned_at) VALUES (?, ?, 'aguardando_motoboy', CURRENT_TIMESTAMP)").run(orderId, next.driver_id);
    db.prepare("UPDATE orders SET status = 'aguardando_motoboy' WHERE id = ?").run(orderId);
    db.prepare("UPDATE drivers SET status = 'carregando' WHERE id = ?").run(next.driver_id);
    db.prepare('UPDATE driver_queue SET active = 0 WHERE id = ?').run(next.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(orderId, 'aguardando_motoboy', 'Motoboy atribuido automaticamente pela fila FIFO');
    res.json({ ok: true, delivery_id: created.lastInsertRowid, driver_name: next.name });
  });

  router.post('/dispatch/:orderId/send', (req, res) => {
    const orderId = Number(req.params.orderId);
    const delivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?').get(orderId);
    if (!delivery) return res.status(404).json({ ok: false, message: 'Entrega nao encontrada' });
    db.prepare("UPDATE deliveries SET status = 'em_entrega', sent_at = CURRENT_TIMESTAMP WHERE order_id = ?").run(orderId);
    db.prepare("UPDATE orders SET status = 'despachado' WHERE id = ?").run(orderId);
    db.prepare("UPDATE drivers SET status = 'em_entrega' WHERE id = ?").run(delivery.driver_id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(orderId, 'despachado', 'Pedido saiu para entrega');
    res.json({ ok: true });
  });

  router.post('/dispatch/:orderId/mark-delivered', (req, res) => {
    const orderId = Number(req.params.orderId);
    const delivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?').get(orderId);
    if (!delivery) return res.status(404).json({ ok: false, message: 'Entrega nao encontrada' });
    db.prepare("UPDATE deliveries SET status = 'entregue', delivered_at = CURRENT_TIMESTAMP WHERE order_id = ?").run(orderId);
    db.prepare("UPDATE orders SET status = 'entregue' WHERE id = ?").run(orderId);
    db.prepare("UPDATE drivers SET status = 'retornando' WHERE id = ?").run(delivery.driver_id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(orderId, 'entregue', 'Pedido entregue ao cliente');
    res.json({ ok: true });
  });

  return router;
}
