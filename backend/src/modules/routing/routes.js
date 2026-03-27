import { Router } from 'express';
import { STORE } from '../../config/storeGeo.js';
import { bearingDeg, classifyDirection, haversineKm } from './geo.js';
import { planRoutes } from './engine.js';
import { enrichPlanWithGoogle, geocodeAddress } from './googleRoutes.js';
import { getGoogleMapsServerKey, isGoogleMapsServerConfigured } from '../../config/googleMapsServer.js';

function parseNum(v, def) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function readRoutingGoogleMapsAuto(db) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get('routing_google_maps_auto');
  return String(row?.value ?? '').toLowerCase() !== 'false';
}

export function createRoutingRouter(db) {
  const router = Router();

  const googleMapsKeyConfigured = isGoogleMapsServerConfigured();

  router.get('/routing/config', (_req, res) => {
    const routingGoogleMapsAuto = readRoutingGoogleMapsAuto(db);
    res.json({
      store: STORE,
      routingGoogleMapsAuto,
      google: {
        routesApiEnrichment: googleMapsKeyConfigured && routingGoogleMapsAuto,
        geocodeProxy: googleMapsKeyConfigured,
        trafficAwareRoutes: String(process.env.GOOGLE_ROUTES_TRAFFIC || '').trim() === '1',
      },
      defaults: {
        maxOrdersPerRoute: 4,
        maxRouteMinutes: 30,
        clusterKm: 2,
        soloWaitMinutes: 5,
        avgSpeedKmh: 24,
        minutesPerStop: 3,
        maxDetourRatio: 1.3,
        priorityAgeMinutes: 25,
        eligibleStatuses: ['pronto', 'aguardando_motoboy'],
      },
    });
  });

  /** Classificar um ponto (lat/lng) em relação à loja — útil para testes */
  router.get('/routing/classify', (req, res) => {
    const lat = parseNum(req.query.lat, NaN);
    const lng = parseNum(req.query.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, message: 'lat e lng obrigatorios' });
    }
    const br = bearingDeg(STORE.lat, STORE.lng, lat, lng);
    const dir = classifyDirection(br);
    const dist = haversineKm(STORE.lat, STORE.lng, lat, lng);
    res.json({
      bearingDeg: Math.round(br * 100) / 100,
      direction: dir,
      distanceFromStoreKm: Math.round(dist * 1000) / 1000,
      store: STORE,
    });
  });

  router.get('/routing/geocode', async (req, res) => {
    const key = getGoogleMapsServerKey();
    if (!key) {
      return res.status(503).json({
        ok: false,
        message: 'Chave Google nao configurada no servidor',
      });
    }
    const q = String(req.query.q || req.query.address || '').trim();
    if (q.length < 3) {
      return res.status(400).json({ ok: false, message: 'Parametro q (endereco) obrigatorio' });
    }
    try {
      const out = await geocodeAddress(key, q);
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(502).json({ ok: false, message: String(e.message || e) });
    }
  });

  router.post('/routing/plan', async (req, res) => {
    const body = req.body || {};
    const cfg = {
      maxOrdersPerRoute: parseNum(body.maxOrdersPerRoute, 4),
      maxRouteMinutes: parseNum(body.maxRouteMinutes, 30),
      clusterKm: parseNum(body.clusterKm, 2),
      soloWaitMinutes: parseNum(body.soloWaitMinutes, 5),
      avgSpeedKmh: parseNum(body.avgSpeedKmh, 24),
      minutesPerStop: parseNum(body.minutesPerStop, 3),
      maxDetourRatio: parseNum(body.maxDetourRatio, 1.3),
      priorityAgeMinutes: parseNum(body.priorityAgeMinutes, 25),
      storeLat: body.storeLat != null ? Number(body.storeLat) : undefined,
      storeLng: body.storeLng != null ? Number(body.storeLng) : undefined,
      storeLabel: body.storeLabel,
    };
    if (Array.isArray(body.eligibleStatuses) && body.eligibleStatuses.length) {
      cfg.eligibleStatuses = body.eligibleStatuses;
    }

    const orders = db.prepare('SELECT * FROM orders ORDER BY id ASC').all();
    const drivers = db.prepare('SELECT * FROM drivers').all();
    const deliveries = db.prepare('SELECT * FROM deliveries').all();
    const queue = db
      .prepare(
        'SELECT dq.driver_id, dq.entered_at FROM driver_queue dq WHERE dq.active = 1 ORDER BY dq.entered_at ASC',
      )
      .all();

    let result = planRoutes(orders, drivers, deliveries, queue, cfg);
    const systemAllowsGoogle = readRoutingGoogleMapsAuto(db);
    const skipGoogle =
      body.skipGoogleRoutes === true ||
      body.skipGoogleRoutes === '1' ||
      !systemAllowsGoogle;
    if (!skipGoogle && googleMapsKeyConfigured) {
      try {
        result = await enrichPlanWithGoogle(result);
      } catch (e) {
        result.routingGoogleError = String(e.message || e);
      }
    }
    res.json(result);
  });

  return router;
}
