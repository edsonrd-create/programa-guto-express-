/**
 * Monta o JSON canónico do KDS (cozinha) a partir de orders + clients + order_items.
 */

function formatKdsCreatedAt(sqliteTs) {
  if (!sqliteTs) return '';
  const s = String(sqliteTs).trim();
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} - ${hh}:${min}`;
}

function safeJsonParse(raw) {
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * @param {object} order - linha `orders`
 * @param {{ name?: string, phone?: string, email?: string } | null} client
 * @param {object[]} itemRows - linhas `order_items`
 */
export function buildKdsOrderDto(order, client, itemRows) {
  const extras = safeJsonParse(order.kds_extras_json) || {};
  const addrFromExtras = extras.address && typeof extras.address === 'object' ? extras.address : {};

  const street = addrFromExtras.street != null ? String(addrFromExtras.street) : '';
  const number = addrFromExtras.number != null ? String(addrFromExtras.number) : '';
  const district =
    addrFromExtras.district != null
      ? String(addrFromExtras.district)
      : (order.delivery_neighborhood != null ? String(order.delivery_neighborhood) : '');
  const zipCode = addrFromExtras.zipCode != null ? String(addrFromExtras.zipCode) : '';

  let full =
    addrFromExtras.full != null && String(addrFromExtras.full).trim()
      ? String(addrFromExtras.full).trim()
      : '';
  if (!full) {
    full = [street, number, district, zipCode].filter((x) => x && String(x).trim()).join(', ');
  }
  if (!full && order.delivery_address) full = String(order.delivery_address).trim();

  const items = (itemRows || []).map((row) => {
    const meta = safeJsonParse(row.meta_json) || {};
    return {
      quantity: Number(row.quantity || 1),
      name: String(row.item_name_snapshot || 'Item'),
      description: meta.description != null ? String(meta.description) : row.notes ? String(row.notes) : null,
      price: Number(row.unit_price || 0),
      flavors: Array.isArray(meta.flavors) ? meta.flavors.map((x) => String(x)) : [],
      addons: Array.isArray(meta.addons)
        ? meta.addons.map((a) => ({
            name: String(a?.name ?? ''),
            price: Number(a?.price ?? 0),
          }))
        : [],
      linkedItems: Array.isArray(meta.linkedItems)
        ? meta.linkedItems.map((l) => ({
            name: String(l?.name ?? ''),
            price: Number(l?.price ?? 0),
          }))
        : [],
    };
  });

  const cust = extras.customer && typeof extras.customer === 'object' ? extras.customer : {};
  const email =
    client?.email ||
    (cust.email != null && String(cust.email).trim() ? String(cust.email).trim() : null) ||
    '-';

  return {
    id: order.id,
    status: order.status,
    createdAt: formatKdsCreatedAt(order.created_at),
    customer: {
      name: client?.name != null ? String(client.name) : 'Cliente',
      email,
      phone: client?.phone != null ? String(client.phone) : '-',
    },
    channel: extras.channel != null && String(extras.channel).trim() ? String(extras.channel) : 'Painel',
    deliveryType:
      extras.deliveryType != null && String(extras.deliveryType).trim()
        ? String(extras.deliveryType)
        : order.delivery_address || order.delivery_lat != null
          ? 'Delivery'
          : 'Retirada',
    paymentMethod:
      extras.paymentMethod != null && String(extras.paymentMethod).trim()
        ? String(extras.paymentMethod)
        : '-',
    deliveryFee: Number(order.delivery_fee || 0),
    deliveryRange:
      extras.deliveryRange != null && String(extras.deliveryRange).trim()
        ? String(extras.deliveryRange)
        : '-',
    address: { street, number, district, zipCode, full },
    subtotal: Number(order.subtotal ?? 0),
    total: Number(order.total_amount ?? 0),
    items,
  };
}
