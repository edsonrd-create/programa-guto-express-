import client from 'prom-client';

const registry = new client.Registry();

client.collectDefaultMetrics({
  register: registry,
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requests HTTP recebidas.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requests HTTP em segundos.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

let businessMetricsInitialized = false;

export function initBusinessMetrics(db) {
  if (businessMetricsInitialized) return;
  businessMetricsInitialized = true;

  const knownOrderStatuses = ['novo', 'em_preparo', 'pronto', 'aguardando_motoboy', 'despachado', 'entregue'];
  const knownDeliveryStatuses = ['aguardando_motoboy', 'em_entrega', 'entregue'];

  const ordersByStatus = new client.Gauge({
    name: 'guto_orders_total',
    help: 'Total de pedidos por status.',
    labelNames: ['status'],
    registers: [registry],
  });
  ordersByStatus.collect = () => {
    try {
      ordersByStatus.reset();
      for (const s of knownOrderStatuses) ordersByStatus.set({ status: s }, 0);
      const rows = db.prepare('SELECT status, COUNT(*) as c FROM orders GROUP BY status').all();
      for (const r of rows) ordersByStatus.set({ status: String(r.status) }, Number(r.c) || 0);
    } catch {
      // Não derruba /metrics se o DB ainda não estiver pronto
    }
  };

  const deliveriesByStatus = new client.Gauge({
    name: 'guto_deliveries_total',
    help: 'Total de entregas por status.',
    labelNames: ['status'],
    registers: [registry],
  });
  deliveriesByStatus.collect = () => {
    try {
      deliveriesByStatus.reset();
      for (const s of knownDeliveryStatuses) deliveriesByStatus.set({ status: s }, 0);
      const rows = db.prepare('SELECT status, COUNT(*) as c FROM deliveries GROUP BY status').all();
      for (const r of rows) deliveriesByStatus.set({ status: String(r.status) }, Number(r.c) || 0);
    } catch {}
  };

  const driverQueueActive = new client.Gauge({
    name: 'guto_driver_queue_active_total',
    help: 'Quantidade de motoboys na fila ativa.',
    registers: [registry],
  });
  driverQueueActive.collect = () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as c FROM driver_queue WHERE active = 1').get();
      driverQueueActive.set(Number(row?.c) || 0);
    } catch {}
  };

  const integrationsActive = new client.Gauge({
    name: 'guto_integrations_active_total',
    help: 'Quantidade de integrações ativas.',
    registers: [registry],
  });
  integrationsActive.collect = () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as c FROM integrations WHERE active = 1').get();
      integrationsActive.set(Number(row?.c) || 0);
    } catch {}
  };

  const integrationsReviewQueue = new client.Gauge({
    name: 'guto_integrations_review_queue_total',
    help: 'Quantidade de pedidos em revisão (review_queue sem resolved_at).',
    registers: [registry],
  });
  integrationsReviewQueue.collect = () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as c FROM review_queue WHERE resolved_at IS NULL').get();
      integrationsReviewQueue.set(Number(row?.c) || 0);
    } catch {}
  };

  // Evita lint “unused”, e mantém referência viva.
  void ordersByStatus;
  void deliveriesByStatus;
  void driverQueueActive;
  void integrationsActive;
  void integrationsReviewQueue;
}

function getRouteLabel(req) {
  // Quando existe rota do Express, isso dá uma label estável (ex.: /drivers/:id)
  if (req.route?.path) return req.route.path;
  // Melhor tentativa: baseUrl + path (para routers montados)
  if (req.baseUrl) return `${req.baseUrl}${req.path || ''}` || req.baseUrl;
  return req.path || 'unknown';
}

export function metricsMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const route = getRouteLabel(req);
    const statusCode = String(res.statusCode);
    const method = req.method;

    httpRequestsTotal.inc({ method, route, status_code: statusCode }, 1);

    const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;
    httpRequestDurationSeconds.observe(
      { method, route, status_code: statusCode },
      durationSeconds,
    );
  });

  next();
}

export async function handleMetrics(_req, res) {
  res.setHeader('Content-Type', registry.contentType);
  res.send(await registry.metrics());
}

