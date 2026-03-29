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

function extractStructuredAddress(payload) {
  const a =
    (payload.address && typeof payload.address === 'object' && !Array.isArray(payload.address)
      ? payload.address
      : null) ||
    (payload.delivery?.address && typeof payload.delivery.address === 'object' ? payload.delivery.address : null);
  if (!a) return null;
  const street = a.street ?? a.rua ?? a.line1 ?? '';
  const number = a.number != null ? String(a.number) : a.numero != null ? String(a.numero) : '';
  const district =
    a.district ?? a.neighborhood ?? a.bairro ?? payload.delivery_neighborhood ?? '';
  const zipRaw = a.zipCode ?? a.zip ?? a.cep ?? a.postal_code ?? '';
  const zipCode = String(zipRaw).replace(/\D/g, '') || String(zipRaw || '');
  const full =
    (typeof a.full === 'string' && a.full.trim()) ||
    [street, number, district, zipCode].filter((x) => x != null && String(x).trim() !== '').join(', ') ||
    null;
  return { street: String(street || ''), number, district: String(district || ''), zipCode, full };
}

export function normalizeIntegrationPayload(channel, payload) {
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const addons = Array.isArray(item.addons)
          ? item.addons.map((x) => ({
              name: String(x?.name ?? x?.title ?? ''),
              price: Number(x?.price ?? 0),
            }))
          : [];
        const linkedItems = Array.isArray(item.linkedItems)
          ? item.linkedItems.map((x) => ({
              name: String(x?.name ?? x?.title ?? ''),
              price: Number(x?.price ?? 0),
            }))
          : [];
        const flavors = Array.isArray(item.flavors) ? item.flavors.map((f) => String(f)) : [];
        return {
          name: item.name || item.title || 'Item',
          quantity: Number(item.quantity || 1),
          price: Number(item.price || item.unit_price || 0),
          description: item.description != null ? String(item.description) : null,
          flavors,
          addons,
          linkedItems,
        };
      })
    : [];

  const structuredAddress = extractStructuredAddress(payload);

  return {
    sourceChannel: channel,
    externalOrderId: String(payload.externalOrderId || payload.id || `auto-${Date.now()}`),
    customer: {
      name: payload.customer?.name || payload.customer_name || payload.name || 'Cliente',
      phone: payload.customer?.phone || payload.phone || null,
      email: payload.customer?.email || payload.customer_email || null,
    },
    channel: payload.channel || payload.source || channel || null,
    deliveryType: payload.deliveryType || payload.delivery_type || null,
    paymentMethod: payload.paymentMethod || payload.payment_method || null,
    deliveryRange: payload.deliveryRange || payload.delivery_range || null,
    items,
    total: Number(payload.total || payload.amount_total || 0),
    delivery: extractDelivery(payload),
    structuredAddress,
    raw: payload,
  };
}
