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
  db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(orderId, 'novo', 'Pedido criado via integracao');
  return { orderId, clientId: client.id, pendingGeocodeAddress };
}
