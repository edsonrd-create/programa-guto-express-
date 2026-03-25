import { STORE } from '../../config/storeGeo.js';
import { bearingDeg, classifyDirection, haversineKm } from './geo.js';

const DIRECTIONS = ['NORTE', 'LESTE', 'SUL', 'OESTE'];

/** Direções “opostas” — nunca na mesma rota */
const OPPOSITE = {
  NORTE: 'SUL',
  SUL: 'NORTE',
  LESTE: 'OESTE',
  OESTE: 'LESTE',
};

const defaultConfig = () => ({
  maxOrdersPerRoute: 4,
  maxRouteMinutes: 30,
  clusterKm: 2,
  soloWaitMinutes: 5,
  /** Velocidade média urbana (km/h) para estimativa de tempo em rota */
  avgSpeedKmh: 24,
  /** Minutos por parada (entrega + organização) */
  minutesPerStop: 3,
  /** Máximo pathKm / soma das idas diretas loja→ponto */
  maxDetourRatio: 1.3,
  /** Pedidos com mais idade (min) ganham prioridade e podem ignorar espera sugerida */
  priorityAgeMinutes: 25,
  /** Status elegíveis ao planejamento */
  eligibleStatuses: ['pronto', 'aguardando_motoboy'],
});

function ageMinutes(createdAt) {
  if (!createdAt) return 0;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 60000);
}

/**
 * Agrupa pedidos na mesma direção: greedy por proximidade mútua ≤ clusterKm.
 * Nunca mistura outra direção (já filtrado antes).
 */
function clusterByProximity(orders, clusterKm, maxPerCluster) {
  const sorted = [...orders].sort((a, b) => {
    if (a.ageMinutes !== b.ageMinutes) return b.ageMinutes - a.ageMinutes;
    return a.distStore - b.distStore;
  });
  const clusters = [];
  for (const o of sorted) {
    let placed = false;
    for (const c of clusters) {
      if (c.length >= maxPerCluster) continue;
      const ok = c.some((p) => haversineKm(p.lat, p.lng, o.lat, o.lng) <= clusterKm);
      if (ok) {
        c.push(o);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([o]);
  }
  return clusters;
}

/**
 * Ordem de entrega: mais próximo da loja → mais distante; empate: mais antigo primeiro.
 */
function orderStopsForDelivery(stops) {
  return [...stops].sort((a, b) => {
    if (Math.abs(a.distStore - b.distStore) > 0.05) return a.distStore - b.distStore;
    return (a.createdAtMs || 0) - (b.createdAtMs || 0);
  });
}

function pathLengthKm(storeLat, storeLng, orderedStops) {
  let km = 0;
  let lat = storeLat;
  let lng = storeLng;
  for (const s of orderedStops) {
    km += haversineKm(lat, lng, s.lat, s.lng);
    lat = s.lat;
    lng = s.lng;
  }
  km += haversineKm(lat, lng, storeLat, storeLng);
  return km;
}

function directStarKm(storeLat, storeLng, stops) {
  return stops.reduce((acc, s) => acc + haversineKm(storeLat, storeLng, s.lat, s.lng), 0);
}

function estimateMinutes(pathKm, numStops, cfg) {
  const drive = (pathKm / cfg.avgSpeedKmh) * 60;
  return drive + cfg.minutesPerStop * numStops;
}

/**
 * Escolhe motoboy: menos entregas ativas; em empate, primeiro da fila (mais tempo parado).
 */
export function pickSuggestedDriver(drivers, deliveries, queueRows) {
  const activeByDriver = {};
  for (const d of deliveries || []) {
    if (d.status === 'em_entrega' && d.driver_id) {
      activeByDriver[d.driver_id] = (activeByDriver[d.driver_id] || 0) + 1;
    }
  }
  const queueOrder = {};
  (queueRows || []).forEach((q, i) => {
    if (queueOrder[q.driver_id] === undefined) queueOrder[q.driver_id] = i;
  });
  const candidates = (drivers || []).filter((d) => ['disponivel', 'fila'].includes(d.status));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const ac = activeByDriver[a.id] || 0;
    const bc = activeByDriver[b.id] || 0;
    if (ac !== bc) return ac - bc;
    const aq = queueOrder[a.id] ?? 999;
    const bq = queueOrder[b.id] ?? 999;
    return aq - bq;
  });
  const best = candidates[0];
  return {
    id: best.id,
    name: best.name,
    reason: `Menor carga ativa (${activeByDriver[best.id] || 0}); prioridade na fila quando em fila.`,
  };
}

/**
 * @param {Array} ordersRows - linhas do SQLite com id, created_at, delivery_*, status
 * @param {object} driversRows
 * @param {object} deliveriesRows
 * @param {object} queueRows
 * @param {object} userConfig - sobrescreve defaults
 */
export function planRoutes(ordersRows, driversRows, deliveriesRows, queueRows, userConfig = {}) {
  const cfg = { ...defaultConfig(), ...userConfig };
  const storeLat = Number(userConfig.storeLat ?? STORE.lat);
  const storeLng = Number(userConfig.storeLng ?? STORE.lng);
  const storeLabel = userConfig.storeLabel ?? STORE.label;

  const skipped = [];
  const enriched = [];

  for (const row of ordersRows || []) {
    if (!cfg.eligibleStatuses.includes(row.status)) continue;
    const lat = row.delivery_lat;
    const lng = row.delivery_lng;
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      skipped.push({ id: row.id, reason: 'Sem delivery_lat / delivery_lng' });
      continue;
    }
    const la = Number(lat);
    const ln = Number(lng);
    const br = bearingDeg(storeLat, storeLng, la, ln);
    const dir = classifyDirection(br);
    const distStore = haversineKm(storeLat, storeLng, la, ln);
    const age = ageMinutes(row.created_at);
    enriched.push({
      id: row.id,
      client_id: row.client_id,
      status: row.status,
      lat: la,
      lng: ln,
      neighborhood: row.delivery_neighborhood || null,
      address: row.delivery_address || null,
      bearing: Math.round(br * 10) / 10,
      direction: dir,
      distStore,
      ageMinutes: age,
      createdAtMs: new Date(row.created_at).getTime() || 0,
    });
  }

  const byDir = {};
  for (const d of DIRECTIONS) byDir[d] = [];
  for (const o of enriched) byDir[o.direction].push(o);

  const routes = [];
  let routeIdx = 0;

  for (const dir of DIRECTIONS) {
    const list = byDir[dir];
    if (!list.length) continue;

    const clusters = clusterByProximity(list, cfg.clusterKm, cfg.maxOrdersPerRoute);

    for (const cluster of clusters) {
      const ordered = orderStopsForDelivery(cluster);
      const pathKm = pathLengthKm(storeLat, storeLng, ordered);
      const starKm = directStarKm(storeLat, storeLng, ordered);
      /** Com 1 parada, ida+volta à loja ≈ 2× o trecho loja→cliente; starKm só soma a ida — comparação multi-stop não se aplica. */
      const detourOk =
        ordered.length <= 1 || starKm < 1e-6 || pathKm <= cfg.maxDetourRatio * starKm;
      const minutes = estimateMinutes(pathKm, ordered.length, cfg);
      const tooLong = minutes > cfg.maxRouteMinutes;
      const efficiencyScore = pathKm > 1e-6 ? ordered.length / pathKm : ordered.length;

      const warnings = [];
      if (!detourOk) warnings.push(`Desvio acima de ${Math.round((cfg.maxDetourRatio - 1) * 100)}% vs soma das idas diretas loja→cliente`);
      if (tooLong) warnings.push(`Estimativa ${Math.round(minutes)} min > limite ${cfg.maxRouteMinutes} min`);

      let waitHint = null;
      if (ordered.length === 1) {
        const o = ordered[0];
        if (o.ageMinutes < cfg.priorityAgeMinutes && o.ageMinutes < cfg.soloWaitMinutes) {
          waitHint = `Único pedido no ${dir}: pode aguardar até ${cfg.soloWaitMinutes} min para tentar agrupar outro no mesmo sentido.`;
        }
      }

      const suggestedDriver = pickSuggestedDriver(driversRows, deliveriesRows, queueRows);

      routes.push({
        id: `R${++routeIdx}`,
        direction: dir,
        oppositeBlocked: OPPOSITE[dir],
        deliveryOrder: ordered.map((s) => s.id),
        stops: ordered.map((s) => ({
          orderId: s.id,
          lat: s.lat,
          lng: s.lng,
          neighborhood: s.neighborhood,
          address: s.address,
          bearingDeg: s.bearing,
          distanceFromStoreKm: Math.round(s.distStore * 1000) / 1000,
          ageMinutes: Math.round(s.ageMinutes * 10) / 10,
        })),
        estimatedTotalKm: Math.round(pathKm * 100) / 100,
        estimatedStarKm: Math.round(starKm * 100) / 100,
        estimatedTotalMinutes: Math.round(minutes * 10) / 10,
        efficiencyScore: Math.round(efficiencyScore * 1000) / 1000,
        detourOk,
        maxDetourRatio: cfg.maxDetourRatio,
        warnings,
        waitHint,
        suggestedDriver,
        ruleNoOppositeDirections: `Esta rota contém apenas o sentido ${dir} (nunca ${OPPOSITE[dir]} misturado).`,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    store: { lat: storeLat, lng: storeLng, label: storeLabel },
    config: cfg,
    routes,
    skippedOrders: skipped,
    notes: [
      'Rotas são geradas por direção (bearing) a partir da loja, com clusters por proximidade ≤ clusterKm.',
      'Prioridade: agrupar no mesmo sentido antes de sair com um pedido; pedidos antigos têm prioridade na ordenação.',
    ],
  };
}
