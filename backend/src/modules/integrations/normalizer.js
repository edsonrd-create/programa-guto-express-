function extractDelivery(payload) {
  const p = payload.delivery && typeof payload.delivery === 'object' ? payload.delivery : {};
  let address =
    p.address ??
    payload.delivery_address ??
    payload.deliveryAddress ??
    payload.shipping_address ??
    payload.address;
  if (address && typeof address === 'object') {
    const joined = [address.street, address.number, address.neighborhood, address.city, address.state]
      .filter(Boolean)
      .join(', ');
    address = (address.formatted ?? joined) || address.line1 || null;
  }
  if (!address && (payload.delivery_street || payload.delivery_city)) {
    address = [payload.delivery_street, payload.delivery_number, payload.delivery_neighborhood, payload.delivery_city, payload.delivery_state]
      .filter((x) => x != null && String(x).trim() !== '')
      .join(', ');
  }
  const lat = p.lat ?? payload.delivery_lat ?? payload.latitude;
  const lng = p.lng ?? payload.delivery_lng ?? payload.longitude;
  const neighborhood = p.neighborhood ?? payload.delivery_neighborhood ?? null;
  const trimmed = address != null ? String(address).trim() : '';
  if (!trimmed && (lat == null || lat === '') && (lng == null || lng === '')) return null;

  const la = lat != null && lat !== '' ? Number(lat) : null;
  const ln = lng != null && lng !== '' ? Number(lng) : null;

  return {
    address: trimmed || null,
    lat: la != null && !Number.isNaN(la) ? la : null,
    lng: ln != null && !Number.isNaN(ln) ? ln : null,
    neighborhood: neighborhood != null && String(neighborhood).trim() ? String(neighborhood).trim() : null,
  };
}

export function normalizeIntegrationPayload(channel, payload) {
  return {
    sourceChannel: channel,
    externalOrderId: String(payload.externalOrderId || payload.id || `auto-${Date.now()}`),
    customer: {
      name: payload.customer?.name || payload.customer_name || payload.name || 'Cliente',
      phone: payload.customer?.phone || payload.phone || null,
    },
    items: Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          name: item.name || item.title || 'Item',
          quantity: Number(item.quantity || 1),
          price: Number(item.price || item.unit_price || 0),
        }))
      : [],
    total: Number(payload.total || payload.amount_total || 0),
    delivery: extractDelivery(payload),
    raw: payload,
  };
}
