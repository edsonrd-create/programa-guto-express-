import { Router } from 'express';

export function createOrdersRouter(db) {
  const router = Router();

  router.get('/orders', (_req, res) => {
    const rows = db.prepare(
      `SELECT o.*,
              c.name client_name,
              c.phone client_phone
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
        ORDER BY o.id DESC`
    ).all();
    res.json(rows);
  });

  router.post('/orders', (req, res) => {
    const { client_id = null, total = 0, delivery_fee = 0 } = req.body;
    const result = db.prepare('INSERT INTO orders (client_id, total_amount, subtotal, delivery_fee) VALUES (?, ?, ?, ?)')
      .run(client_id, total, total, delivery_fee);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)')
      .run(result.lastInsertRowid, 'novo', 'Pedido criado');
    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.get('/orders/:id', (req, res) => {
    const id = Number(req.params.id);
    const order = db.prepare(
      `SELECT o.*,
              c.name client_name,
              c.phone client_phone
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
        WHERE o.id = ?`
    ).get(id);
    if (!order) return res.status(404).json({ ok: false, message: 'Pedido nao encontrado' });
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(id);
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC').all(id);
    res.json({ ...order, items, history });
  });

  router.post('/orders/:id/items', (req, res) => {
    const orderId = Number(req.params.id);
    const { item_name, quantity = 1, unit_price = 0, notes = null } = req.body;
    const totalPrice = Number(quantity) * Number(unit_price);
    const result = db.prepare('INSERT INTO order_items (order_id, item_name_snapshot, quantity, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(orderId, item_name, quantity, unit_price, totalPrice, notes);
    const sums = db.prepare('SELECT COALESCE(SUM(total_price),0) subtotal FROM order_items WHERE order_id = ?').get(orderId);
    const current = db.prepare('SELECT delivery_fee FROM orders WHERE id = ?').get(orderId);
    db.prepare('UPDATE orders SET subtotal = ?, total_amount = ? WHERE id = ?').run(sums.subtotal, sums.subtotal + (current?.delivery_fee || 0), orderId);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.post('/orders/:id/status', (req, res) => {
    const id = Number(req.params.id);
    const { status, description = null } = req.body;
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(id, status, description);
    const order = db.prepare(
      `SELECT o.*,
              c.name client_name,
              c.phone client_phone
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
        WHERE o.id = ?`
    ).get(id);
    res.json(order);
  });

  router.patch('/orders/:id/delivery', (req, res) => {
    const id = Number(req.params.id);
    const {
      delivery_lat,
      delivery_lng,
      delivery_neighborhood = null,
      delivery_address = null
    } = req.body || {};

    const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ ok: false, message: 'Pedido nao encontrado' });

    const lat = delivery_lat === '' || delivery_lat === undefined ? null : Number(delivery_lat);
    const lng = delivery_lng === '' || delivery_lng === undefined ? null : Number(delivery_lng);
    if (lat != null && Number.isNaN(lat)) return res.status(400).json({ ok: false, message: 'delivery_lat invalido' });
    if (lng != null && Number.isNaN(lng)) return res.status(400).json({ ok: false, message: 'delivery_lng invalido' });

    const neigh = delivery_neighborhood === '' ? null : delivery_neighborhood;
    const addr = delivery_address === '' ? null : delivery_address;

    db.prepare(
      'UPDATE orders SET delivery_lat = ?, delivery_lng = ?, delivery_neighborhood = ?, delivery_address = ? WHERE id = ?'
    ).run(lat, lng, neigh, addr, id);

    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(
      id,
      order.status,
      'Destino atualizado pelo painel'
    );

    const updated = db.prepare(
      `SELECT o.*,
              c.name client_name,
              c.phone client_phone
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
        WHERE o.id = ?`
    ).get(id);

    res.json(updated);
  });

  router.get('/orders/:id/history', (req, res) => {
    const id = Number(req.params.id);
    res.json(db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC').all(id));
  });

  return router;
}
