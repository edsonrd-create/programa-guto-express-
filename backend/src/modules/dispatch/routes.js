import { Router } from 'express';
import { getDispatchQueueMode } from '../settings/runtimeSettings.js';
import { findActiveQueueEntryForDriver, pickNextQueueEntry } from './queuePicker.js';

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} orderId
 * @param {{ dqId: number, driverId: number, name: string, reason: string }} picked
 */
function finalizeAssign(db, orderId, picked, historySuffix) {
  const created = db
    .prepare(
      "INSERT INTO deliveries (order_id, driver_id, status, assigned_at) VALUES (?, ?, 'aguardando_motoboy', CURRENT_TIMESTAMP)",
    )
    .run(orderId, picked.driverId);
  db.prepare("UPDATE orders SET status = 'aguardando_motoboy' WHERE id = ?").run(orderId);
  db.prepare("UPDATE drivers SET status = 'carregando' WHERE id = ?").run(picked.driverId);
  db.prepare('UPDATE driver_queue SET active = 0 WHERE id = ?').run(picked.dqId);
  const desc = `${historySuffix} ${picked.reason}`;
  db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(
    orderId,
    'aguardando_motoboy',
    desc.trim(),
  );
  return { lastInsertRowid: created.lastInsertRowid };
}

export function createDispatchRouter(db) {
  const router = Router();

  router.get('/dispatch', (_req, res) => {
    res.json(
      db
        .prepare(
          "SELECT * FROM orders WHERE status IN ('pronto','aguardando_motoboy','despachado','entregue') ORDER BY id ASC",
        )
        .all(),
    );
  });

  router.get('/dispatch/deliveries', (_req, res) => {
    const rows = db
      .prepare(
        'SELECT dl.*, d.name driver_name FROM deliveries dl LEFT JOIN drivers d ON d.id = dl.driver_id ORDER BY dl.id DESC',
      )
      .all();
    res.json(rows);
  });

  /** Automático conforme modo (FIFO ou GPS) ou override no body: { queueMode?: 'fifo'|'nearest' } */
  router.post('/dispatch/:orderId/assign-next-driver', (req, res) => {
    const orderId = Number(req.params.orderId);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Pedido nao encontrado' });
    if (order.status !== 'pronto') return res.status(400).json({ ok: false, message: 'Pedido precisa estar pronto' });

    const body = req.body || {};
    let mode = getDispatchQueueMode(db);
    const qm = body.queueMode ?? body.dispatch_queue_mode;
    if (qm === 'nearest' || qm === 'fifo') mode = qm;

    const picked = pickNextQueueEntry(db, order, mode);
    if (!picked) return res.status(400).json({ ok: false, message: 'Sem motoboy na fila' });

    const created = finalizeAssign(db, orderId, picked, 'Motoboy atribuido pela fila.');
    res.json({
      ok: true,
      delivery_id: created.lastInsertRowid,
      driver_name: picked.name,
      dispatch_queue_mode: mode,
      pick_reason: picked.reason,
    });
  });

  /** Manual: escolhe o motoboy (precisa estar na fila ativa). Body: { driverId: number } */
  router.post('/dispatch/:orderId/assign-driver', (req, res) => {
    const orderId = Number(req.params.orderId);
    const driverId = Number(req.body?.driverId);
    if (!Number.isFinite(driverId)) {
      return res.status(400).json({ ok: false, message: 'driverId obrigatorio' });
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Pedido nao encontrado' });
    if (order.status !== 'pronto') return res.status(400).json({ ok: false, message: 'Pedido precisa estar pronto' });

    const row = findActiveQueueEntryForDriver(db, driverId);
    if (!row) {
      return res.status(400).json({ ok: false, message: 'Motorista nao esta na fila ativa' });
    }

    const picked = {
      dqId: row.dq_id,
      driverId: row.driver_id,
      name: row.name,
      reason: 'Escolha manual no painel.',
    };
    const created = finalizeAssign(db, orderId, picked, 'Motoboy atribuido manualmente.');
    res.json({
      ok: true,
      delivery_id: created.lastInsertRowid,
      driver_name: picked.name,
    });
  });

  router.post('/dispatch/:orderId/send', (req, res) => {
    const orderId = Number(req.params.orderId);
    const delivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?').get(orderId);
    if (!delivery) return res.status(404).json({ ok: false, message: 'Entrega nao encontrada' });
    db.prepare("UPDATE deliveries SET status = 'em_entrega', sent_at = CURRENT_TIMESTAMP WHERE order_id = ?").run(
      orderId,
    );
    db.prepare("UPDATE orders SET status = 'despachado' WHERE id = ?").run(orderId);
    db.prepare("UPDATE drivers SET status = 'em_entrega' WHERE id = ?").run(delivery.driver_id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(
      orderId,
      'despachado',
      'Pedido saiu para entrega',
    );
    res.json({ ok: true });
  });

  router.post('/dispatch/:orderId/mark-delivered', (req, res) => {
    const orderId = Number(req.params.orderId);
    const delivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?').get(orderId);
    if (!delivery) return res.status(404).json({ ok: false, message: 'Entrega nao encontrada' });
    db.prepare("UPDATE deliveries SET status = 'entregue', delivered_at = CURRENT_TIMESTAMP WHERE order_id = ?").run(
      orderId,
    );
    db.prepare("UPDATE orders SET status = 'entregue' WHERE id = ?").run(orderId);
    db.prepare("UPDATE drivers SET status = 'retornando' WHERE id = ?").run(delivery.driver_id);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(
      orderId,
      'entregue',
      'Pedido entregue ao cliente',
    );
    res.json({ ok: true });
  });

  return router;
}
