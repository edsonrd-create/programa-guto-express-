import { STORE } from '../../config/storeGeo.js';
import { haversineKm } from '../routing/geo.js';

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} order - linha orders (precisa delivery_lat/lng opcionais)
 * @param {'fifo'|'nearest'} mode
 * @returns {{ dqId: number, driverId: number, name: string, reason: string } | null}
 */
export function pickNextQueueEntry(db, order, mode) {
  const rows = db
    .prepare(
      `SELECT dq.id AS dq_id, dq.entered_at, dq.driver_id, d.name, d.last_lat, d.last_lng
         FROM driver_queue dq
         JOIN drivers d ON d.id = dq.driver_id
        WHERE dq.active = 1
        ORDER BY dq.entered_at ASC`,
    )
    .all();

  if (!rows.length) return null;

  let targetLat = order.delivery_lat != null ? Number(order.delivery_lat) : null;
  let targetLng = order.delivery_lng != null ? Number(order.delivery_lng) : null;
  let targetLabel = 'destino do pedido';
  if (
    targetLat == null ||
    targetLng == null ||
    !Number.isFinite(targetLat) ||
    !Number.isFinite(targetLng)
  ) {
    targetLat = STORE.lat;
    targetLng = STORE.lng;
    targetLabel = 'loja (pedido sem coordenadas de entrega)';
  }

  if (mode !== 'nearest') {
    const r = rows[0];
    return {
      dqId: r.dq_id,
      driverId: r.driver_id,
      name: r.name,
      reason: 'Fila manual (FIFO): primeiro a dar check-in na fila.',
    };
  }

  const withGps = rows.filter(
    (r) =>
      r.last_lat != null &&
      r.last_lng != null &&
      Number.isFinite(Number(r.last_lat)) &&
      Number.isFinite(Number(r.last_lng)),
  );

  if (!withGps.length) {
    const r = rows[0];
    return {
      dqId: r.dq_id,
      driverId: r.driver_id,
      name: r.name,
      reason:
        'Modo GPS: nenhum motoboy na fila com localização recente; usando ordem de check-in (FIFO).',
    };
  }

  let best = withGps[0];
  let bestKm = haversineKm(Number(best.last_lat), Number(best.last_lng), targetLat, targetLng);
  for (let i = 1; i < withGps.length; i++) {
    const r = withGps[i];
    const km = haversineKm(Number(r.last_lat), Number(r.last_lng), targetLat, targetLng);
    if (km < bestKm) {
      best = r;
      bestKm = km;
    }
  }
  return {
    dqId: best.dq_id,
    driverId: best.driver_id,
    name: best.name,
    reason: `Modo GPS: mais próximo de ${targetLabel} (~${bestKm.toFixed(2)} km).`,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} driverId
 */
export function findActiveQueueEntryForDriver(db, driverId) {
  return db
    .prepare(
      `SELECT dq.id AS dq_id, d.name, d.id AS driver_id
         FROM driver_queue dq
         JOIN drivers d ON d.id = dq.driver_id
        WHERE dq.active = 1 AND dq.driver_id = ?`,
    )
    .get(driverId);
}
