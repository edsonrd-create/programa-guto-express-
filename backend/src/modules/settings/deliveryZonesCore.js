/**
 * Cadastro de bairros / zonas de entrega: taxa, tempo médio, pedido mínimo, prioridade, modo manual vs IA.
 */

export function normalizeZoneKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function findActiveDeliveryZone(db, neighborhoodName) {
  const key = normalizeZoneKey(neighborhoodName);
  if (!key) return null;
  return db.prepare(`SELECT * FROM delivery_zones WHERE name_key = ? AND active = 1`).get(key);
}

export function findAnyDeliveryZoneByKey(db, neighborhoodName) {
  const key = normalizeZoneKey(neighborhoodName);
  if (!key) return null;
  return db.prepare(`SELECT * FROM delivery_zones WHERE name_key = ?`).get(key);
}

export function computeZonesSummary(db) {
  const rows = db.prepare(`SELECT delivery_fee, avg_minutes, active FROM delivery_zones`).all();
  const active = rows.filter((r) => Number(r.active) === 1);
  const avgFee =
    active.length > 0 ? active.reduce((s, r) => s + Number(r.delivery_fee || 0), 0) / active.length : 0;
  const avgMin =
    active.length > 0 ? active.reduce((s, r) => s + Number(r.avg_minutes || 0), 0) / active.length : 0;
  return {
    totalZones: rows.length,
    activeCount: active.length,
    avgDeliveryFee: Math.round(avgFee * 100) / 100,
    avgMinutesOverall: Math.round(avgMin),
  };
}

export function writeZoneAudit(db, zoneId, payload, reason, actor = null) {
  db.prepare(
    `INSERT INTO delivery_zone_audit (zone_id, actor, source, reason, payload_json)
     VALUES (?, ?, 'panel', ?, ?)`,
  ).run(zoneId, actor, reason ?? null, JSON.stringify(payload));
}

/** Heurística local (painel “IA”): reajuste leve de taxa e tempo; substituível por modelo depois. */
export function suggestZoneAdjustment(zone) {
  const dow = new Date().getDay();
  const isWeekend = dow === 0 || dow === 5 || dow === 6;
  const fee = Number(zone.delivery_fee || 0);
  const mins = Number(zone.avg_minutes || 45);
  let feeDelta = 0;
  let minDelta = 0;
  const reasons = [];

  if (mins >= 50) {
    minDelta = 8;
    reasons.push('tempo médio elevado: +8 min sugeridos');
  } else if (mins >= 40) {
    minDelta = 5;
    reasons.push('tempo médio alto: +5 min sugeridos');
  }

  const pct = String(zone.mode) === 'ia' && isWeekend ? 0.12 : isWeekend ? 0.06 : mins >= 45 ? 0.05 : 0;
  if (pct > 0) {
    feeDelta = Math.round(fee * pct * 100) / 100;
    reasons.push(
      String(zone.mode) === 'ia' && isWeekend
        ? 'modo assistido + pico fim de semana: taxa +12%'
        : isWeekend
          ? 'pico fim de semana: taxa +6%'
          : 'ajuste operacional leve: taxa +5%',
    );
  }

  if (!reasons.length) {
    reasons.push('Parâmetros equilibrados; manter valores ou revisar manualmente.');
  }

  return {
    zone_id: zone.id,
    neighborhood: zone.name,
    suggested_delivery_fee: Math.round((fee + feeDelta) * 100) / 100,
    suggested_avg_minutes: Math.min(120, Math.round(mins + minDelta)),
    suggested_min_order_amount: Number(zone.min_order_amount || 0),
    rationale: reasons.join(' '),
    baseline: { delivery_fee: fee, avg_minutes: mins, min_order_amount: Number(zone.min_order_amount || 0) },
  };
}

export function rowToZoneDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    name_key: row.name_key,
    delivery_fee: Number(row.delivery_fee ?? 0),
    avg_minutes: Number(row.avg_minutes ?? 45),
    min_order_amount: Number(row.min_order_amount ?? 0),
    active: Number(row.active) === 1,
    priority: row.priority,
    notes: row.notes ?? '',
    mode: row.mode === 'ia' ? 'ia' : 'manual',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
