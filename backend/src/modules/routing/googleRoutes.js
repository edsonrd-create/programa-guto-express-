/**
 * Google Routes API v2 (Compute Routes) — distância/tempo reais e polyline para o mapa.
 * Requer chave com "Routes API" ativa no Google Cloud.
 */

import { getGoogleMapsServerKey } from '../../config/googleMapsServer.js';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** Limite de waypoints intermediários na Routes API v2 (computeRoutes). */
export const GOOGLE_ROUTES_MAX_INTERMEDIATES = 25;

function pickNeighborhoodFromComponents(components) {
  if (!Array.isArray(components)) return null;
  const order = ['sublocality_level_1', 'neighborhood', 'sublocality', 'administrative_area_level_4'];
  for (const t of order) {
    const c = components.find((x) => (x.types || []).includes(t));
    if (c?.long_name) return c.long_name;
  }
  return null;
}

function parseDurationSeconds(d) {
  if (d == null) return 0;
  if (typeof d === 'number' && Number.isFinite(d)) return d;
  if (typeof d === 'string') {
    const m = /^(\d+)s$/.exec(d.trim());
    if (m) return Number(m[1]);
    const n = Number(d);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof d === 'object' && d.seconds != null) return Number(d.seconds) || 0;
  return 0;
}

/**
 * Rota fechada: loja → paradas (ordem fixa) → loja.
 * @param {string} apiKey
 * @param {{ lat: number, lng: number }} store
 * @param {Array<{ lat: number, lng: number }>} stopsOrdered
 * @param {{ trafficAware?: boolean }} [opts]
 */
export async function computeRoundTripRoute(apiKey, store, stopsOrdered, opts = {}) {
  if (!stopsOrdered.length) {
    return { distanceMeters: 0, durationSeconds: 0, encodedPolyline: null };
  }
  if (stopsOrdered.length > GOOGLE_ROUTES_MAX_INTERMEDIATES) {
    throw new Error(
      `Routes API: no máximo ${GOOGLE_ROUTES_MAX_INTERMEDIATES} paradas intermediárias (esta rota tem ${stopsOrdered.length}).`,
    );
  }

  const storeLL = { latitude: store.lat, longitude: store.lng };
  const intermediates = stopsOrdered.map((s) => ({
    location: { latLng: { latitude: s.lat, longitude: s.lng } },
  }));

  const body = {
    origin: { location: { latLng: storeLL } },
    destination: { location: { latLng: storeLL } },
    intermediates,
    travelMode: 'DRIVE',
    routingPreference: opts.trafficAware ? 'TRAFFIC_AWARE_OPTIMAL' : 'TRAFFIC_UNAWARE',
    optimizeWaypointOrder: false,
  };

  const res = await fetch(ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.status || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const r0 = data.routes?.[0];
  if (!r0) throw new Error('Resposta sem rotas');

  const distanceMeters = Number(r0.distanceMeters ?? 0);
  const durationSeconds = parseDurationSeconds(r0.duration);
  const encodedPolyline = r0.polyline?.encodedPolyline ?? null;

  return { distanceMeters, durationSeconds, encodedPolyline };
}

/**
 * @param {object} plan - saída de `planRoutes`
 */
export async function enrichPlanWithGoogle(plan) {
  const key = getGoogleMapsServerKey();
  if (!key) return plan;

  const trafficAware = String(process.env.GOOGLE_ROUTES_TRAFFIC || '').trim() === '1';
  const store = plan.store;
  if (!store || store.lat == null || store.lng == null) return plan;

  const googleNote =
    'Distâncias Google: Routes API (volta à loja). Estimativa local (haversine) mantida em estimatedTotalKm.';
  const notes = Array.isArray(plan.notes) ? [...plan.notes] : [];
  if (!notes.includes(googleNote)) notes.push(googleNote);

  for (const route of plan.routes || []) {
    const stops = route.stops || [];
    if (!stops.length) {
      route.google = { skipped: true, reason: 'sem paradas' };
      continue;
    }
    if (stops.length > GOOGLE_ROUTES_MAX_INTERMEDIATES) {
      route.google = {
        skipped: true,
        reason: `Mais de ${GOOGLE_ROUTES_MAX_INTERMEDIATES} paradas (limite da Routes API).`,
      };
      continue;
    }
    try {
      const ordered = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
      const g = await computeRoundTripRoute(key, { lat: store.lat, lng: store.lng }, ordered, {
        trafficAware,
      });
      route.google = {
        distanceMeters: g.distanceMeters,
        distanceKm: Math.round((g.distanceMeters / 1000) * 100) / 100,
        durationSeconds: g.durationSeconds,
        durationMinutes: Math.round((g.durationSeconds / 60) * 10) / 10,
        encodedPolyline: g.encodedPolyline,
        trafficAware,
      };
    } catch (e) {
      route.google = { error: String(e.message || e) };
    }
  }

  plan.notes = notes;
  plan.googleEnrichedAt = new Date().toISOString();
  return plan;
}

/**
 * Geocoding (server-side, esconde a chave do browser).
 * @param {string} apiKey
 * @param {string} address
 */
export async function geocodeAddress(apiKey, address) {
  const q = String(address || '').trim();
  if (q.length < 3) throw new Error('Endereco muito curto');

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', q);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('region', 'br');
  url.searchParams.set('language', 'pt-BR');

  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || 'Geocoding negado — verifique a API Geocoding e a chave');
  }
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || data.status || 'Geocoding falhou');
  }

  const results = (data.results || []).map((r) => ({
    formattedAddress: r.formatted_address,
    lat: r.geometry?.location?.lat,
    lng: r.geometry?.location?.lng,
    placeId: r.place_id,
    neighborhood: pickNeighborhoodFromComponents(r.address_components),
  }));

  return { status: data.status, results };
}

/**
 * Grava lat/lng (e bairro se vier do Google) no pedido — usado após webhook com endereço sem coordenadas.
 * @param {import('better-sqlite3').Database} db
 */
export async function geocodeAndPersistOrderDelivery(db, orderId, address, apiKey) {
  const key = (apiKey || getGoogleMapsServerKey()).trim();
  if (!key || !String(address || '').trim()) {
    return { skipped: true, reason: 'no_key_or_address' };
  }

  const out = await geocodeAddress(key, String(address).trim());
  const first = out.results?.[0];
  if (!first || first.lat == null || first.lng == null) {
    return {
      skipped: true,
      reason: out.status === 'ZERO_RESULTS' ? 'zero_results' : 'no_result',
    };
  }

  db.prepare(
    `UPDATE orders SET delivery_lat = ?, delivery_lng = ?, delivery_neighborhood = COALESCE(?, delivery_neighborhood) WHERE id = ?`
  ).run(first.lat, first.lng, first.neighborhood ?? null, orderId);

  const row = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
  if (row) {
    db.prepare('INSERT INTO order_status_history (order_id, status, description) VALUES (?, ?, ?)').run(
      orderId,
      row.status,
      'Coordenadas preenchidas por geocoding (integracao)',
    );
  }

  return { ok: true, lat: first.lat, lng: first.lng };
}
