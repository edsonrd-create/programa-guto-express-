import { findActiveDeliveryZone } from '../settings/deliveryZonesCore.js';

export function processIntegrationOrder(db, normalized) {
  const name = normalized.customer.name;
  const phone = normalized.customer.phone;
  let client = phone ? db.prepare('SELECT * FROM clients WHERE phone = ?').get(phone) : null;
  if (!client) {
    const result = db.prepare('INSERT INTO clients (name, phone) VALUES (?, ?)').run(name, phone || `auto-${Date.now()}`);
    client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  }

  const d = normalized.delivery;
  let lat = null;
  let lng = null;
  let neigh = null;
  let addr = null;
  let pendingGeocodeAddress = null;

  if (d && typeof d === 'object') {
    addr = d.address && String(d.address).trim() ? String(d.address).trim() : null;
    neigh = d.neighborhood && String(d.neighborhood).trim() ? String(d.neighborhood).trim() : null;
    if (d.lat != null && d.lng != null && !Number.isNaN(Number(d.lat)) && !Number.isNaN(Number(d.lng))) {
      lat = Number(d.lat);
      lng = Number(d.lng);
    }
    if ((lat == null || lng == null) && addr && addr.length >= 5) {
      pendingGeocodeAddress = addr;
    }
  }

  const order = db
    .prepare(
      `INSERT INTO orders (client_id, total_amount, subtotal, status, delivery_lat, delivery_lng, delivery_neighborhood, delivery_address)
       VALUES (?, ?, ?, 'novo', ?, ?, ?, ?)`,
    )
    .run(client.id, normalized.total, normalized.total, lat, lng, neigh, addr);
  const orderId = order.lastInsertRowid;

  for (const item of normalized.items) {
    const total = Number(item.quantity) * Number(item.price);
    db.prepare('INSERT INTO order_items (order_id, item_name_snapshot, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)')
      .run(orderId, item.name, item.quantity, item.price, total);
  }

  const sums = db.prepare('SELECT COALESCE(SUM(total_price),0) AS subtotal FROM order_items WHERE order_id = ?').get(orderId);
  const subtotal = Number(sums?.subtotal ?? 0);
  let deliveryFee = 0;
  let estMin = null;
  let zid = null;
  let zoneMatch = null;
  if (neigh) {
    zoneMatch = findActiveDeliveryZone(db, neigh);
    if (zoneMatch) {
      deliveryFee = Number(zoneMatch.delivery_fee || 0);
      estMin = Number(zoneMatch.avg_minutes || 0);
      zid = zoneMatch.id;
    }
  }
  db.prepare(
    `UPDATE orders SET subtotal = ?, delivery_fee = ?, total_amount = ?, estimated_delivery_minutes = ?, delivery_zone_id = ? WHERE id = ?`,
  ).run(subtotal, deliveryFee, subtotal + deliveryFee, estMin, zid, orderId);

  let hist = zid ? 'Pedido criado via integracao (taxa/prazo por bairro)' : 'Pedido criado via integracao';
  if (zoneMatch && subtotal < Number(zoneMatch.min_order_amount || 0)) {
    hist += ` · Aviso: subtotal abaixo do minimo do bairro ${zoneMatch.name}`;
  }
  db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(orderId, 'novo', hist);
  return { orderId, clientId: client.id, pendingGeocodeAddress };
}
