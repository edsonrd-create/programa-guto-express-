import { Router } from 'express';
import { OrderCreateBodySchema, validationErrorResponse } from '../../validation/httpSchemas.js';
import { getClosedMessage, shouldBlockOrdersNow } from '../settings/hoursEnforcer.js';
import { findActiveDeliveryZone } from '../settings/deliveryZonesCore.js';

const STATUSES_THAT_REQUIRE_MIN_ORDER = new Set(['em_preparo', 'pronto']);

function minOrderHintForOrder(db, order) {
  if (!order?.delivery_neighborhood) return null;
  const zone = findActiveDeliveryZone(db, order.delivery_neighborhood);
  if (!zone) return null;
  const sub = Number(order.subtotal ?? 0);
  const min = Number(zone.min_order_amount || 0);
  return {
    zone_name: zone.name,
    min_order_amount: min,
    subtotal: sub,
    satisfied: sub >= min,
    gap: Math.max(0, Math.round((min - sub) * 100) / 100),
  };
}

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
    const block = shouldBlockOrdersNow(db, new Date());
    if (block.block) {
      return res.status(409).json({
        ok: false,
        code: 'STORE_CLOSED',
        message: getClosedMessage(db),
        statusNow: block.statusNow,
      });
    }
    const parsed = OrderCreateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));
    const { client_id, total, delivery_fee, delivery_neighborhood, skip_zone_pricing } = parsed.data;

    let fee = delivery_fee;
    let estMin = null;
    let zoneId = null;
    let zoneMeta = null;

    if (!skip_zone_pricing && delivery_neighborhood) {
      const zone = findActiveDeliveryZone(db, delivery_neighborhood);
      if (zone) {
        if (total > 0 && total < Number(zone.min_order_amount || 0)) {
          return res.status(409).json({
            ok: false,
            code: 'NEIGHBORHOOD_MIN_ORDER',
            message: `Pedido abaixo do mínimo para o bairro (${zone.name}): exige R$ ${Number(zone.min_order_amount).toFixed(2)}`,
            min_order_amount: Number(zone.min_order_amount),
            zone: { id: zone.id, name: zone.name },
          });
        }
        fee = Number(zone.delivery_fee || 0);
        estMin = Number(zone.avg_minutes || 0);
        zoneId = zone.id;
        zoneMeta = { id: zone.id, name: zone.name, avg_minutes: estMin };
      }
    }

    const result = db
      .prepare(
        `INSERT INTO orders (client_id, total_amount, subtotal, delivery_fee, delivery_neighborhood, estimated_delivery_minutes, delivery_zone_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(client_id, total, total, fee, delivery_neighborhood, estMin, zoneId);
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(
      result.lastInsertRowid,
      'novo',
      zoneMeta ? `Pedido criado (zona ${zoneMeta.name}; taxa automática)` : 'Pedido criado',
    );
    res.status(201).json({
      id: result.lastInsertRowid,
      delivery_fee: fee,
      delivery_neighborhood,
      estimated_delivery_minutes: estMin,
      delivery_zone_id: zoneId,
      delivery_zone: zoneMeta,
    });
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
    const min_order_hint = minOrderHintForOrder(db, order);
    res.json({ ...order, items, history, min_order_hint });
  });

  router.post('/orders/:id/items', (req, res) => {
    const orderId = Number(req.params.id);
    const { item_name, quantity = 1, unit_price = 0, notes = null } = req.body;
    const totalPrice = Number(quantity) * Number(unit_price);
    const result = db.prepare('INSERT INTO order_items (order_id, item_name_snapshot, quantity, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(orderId, item_name, quantity, unit_price, totalPrice, notes);
    const sums = db.prepare('SELECT COALESCE(SUM(total_price),0) subtotal FROM order_items WHERE order_id = ?').get(orderId);
    const current = db.prepare('SELECT delivery_fee FROM orders WHERE id = ?').get(orderId);
    db.prepare('UPDATE orders SET subtotal = ?, total_amount = ? WHERE id = ?').run(
      sums.subtotal,
      sums.subtotal + (current?.delivery_fee || 0),
      orderId,
    );
    const orderRow = db
      .prepare(
        `SELECT id, subtotal, delivery_fee, total_amount, delivery_neighborhood, estimated_delivery_minutes, delivery_zone_id
         FROM orders WHERE id = ?`,
      )
      .get(orderId);
    const min_order_hint = minOrderHintForOrder(db, orderRow);
    res.status(201).json({ id: result.lastInsertRowid, order: orderRow, min_order_hint });
  });

  router.post('/orders/:id/status', (req, res) => {
    const id = Number(req.params.id);
    const { status, description = null } = req.body;
    if (STATUSES_THAT_REQUIRE_MIN_ORDER.has(String(status || ''))) {
      const ord = db.prepare(`SELECT subtotal, delivery_neighborhood FROM orders WHERE id = ?`).get(id);
      if (ord) {
        const hint = minOrderHintForOrder(db, ord);
        if (hint && !hint.satisfied) {
          return res.status(409).json({
            ok: false,
            code: 'NEIGHBORHOOD_MIN_ORDER',
            message: `Subtotal abaixo do mínimo do bairro ${hint.zone_name} (R$ ${hint.min_order_amount.toFixed(2)}). Faltam R$ ${hint.gap.toFixed(2)} em itens.`,
            min_order_hint: hint,
          });
        }
      }
    }
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

    const order = db
      .prepare(
        `SELECT id, status, delivery_fee, estimated_delivery_minutes, delivery_zone_id FROM orders WHERE id = ?`,
      )
      .get(id);
    if (!order) return res.status(404).json({ ok: false, message: 'Pedido nao encontrado' });

    const lat = delivery_lat === '' || delivery_lat === undefined ? null : Number(delivery_lat);
    const lng = delivery_lng === '' || delivery_lng === undefined ? null : Number(delivery_lng);
    if (lat != null && Number.isNaN(lat)) return res.status(400).json({ ok: false, message: 'delivery_lat invalido' });
    if (lng != null && Number.isNaN(lng)) return res.status(400).json({ ok: false, message: 'delivery_lng invalido' });

    const neigh = delivery_neighborhood === '' ? null : delivery_neighborhood;
    const addr = delivery_address === '' ? null : delivery_address;

    db.prepare(
      'UPDATE orders SET delivery_lat = ?, delivery_lng = ?, delivery_neighborhood = ?, delivery_address = ? WHERE id = ?',
    ).run(lat, lng, neigh, addr, id);

    const sums = db.prepare('SELECT COALESCE(SUM(total_price),0) AS subtotal FROM order_items WHERE order_id = ?').get(id);
    const subtotal = Number(sums?.subtotal ?? 0);
    let deliveryFee = Number(order.delivery_fee ?? 0);
    let estMin = order.estimated_delivery_minutes != null ? Number(order.estimated_delivery_minutes) : null;
    let zid = order.delivery_zone_id != null ? Number(order.delivery_zone_id) : null;
    if (neigh) {
      const zone = findActiveDeliveryZone(db, neigh);
      if (zone) {
        deliveryFee = Number(zone.delivery_fee || 0);
        estMin = Number(zone.avg_minutes || 0);
        zid = zone.id;
      } else {
        zid = null;
        estMin = null;
      }
    } else {
      zid = null;
      estMin = null;
      deliveryFee = Number(order.delivery_fee ?? 0);
    }
    db.prepare(
      `UPDATE orders SET delivery_fee = ?, total_amount = ?, estimated_delivery_minutes = ?, delivery_zone_id = ? WHERE id = ?`,
    ).run(deliveryFee, subtotal + deliveryFee, estMin, zid, id);

    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(
      id,
      order.status,
      neigh ? 'Destino atualizado; taxa/prazo por bairro recalculados' : 'Destino atualizado pelo painel',
    );

    const updated = db.prepare(
      `SELECT o.*,
              c.name client_name,
              c.phone client_phone
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
        WHERE o.id = ?`
    ).get(id);

    res.json({ ...updated, min_order_hint: minOrderHintForOrder(db, updated) });
  });

  router.get('/orders/:id/history', (req, res) => {
    const id = Number(req.params.id);
    res.json(db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC').all(id));
  });

  return router;
}
