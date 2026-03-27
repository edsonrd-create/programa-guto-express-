import './loadEnv.js';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { initBusinessMetrics, metricsMiddleware, handleMetrics } from './metrics.js';
import { createOrdersRouter } from './modules/orders/routes.js';
import { createKdsRouter } from './modules/kds/routes.js';
import { createDispatchRouter } from './modules/dispatch/routes.js';
import { createIntegrationsRouter } from './modules/integrations/routes.js';
import { createRoutingRouter } from './modules/routing/routes.js';
import { createCustomersRouter } from './modules/customers/routes.js';
import { createDriversRouter } from './modules/drivers/routes.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createMenuRouter } from './modules/menu/routes.js';
import { createSettingsRouter } from './modules/settings/routes.js';
import { getAutopilotRuntimeSettings } from './modules/settings/runtimeSettings.js';
import { decideAutopilotActions } from './modules/ai/autopilot.js';
import { buildOperationalSnapshot } from './modules/ops/snapshotBuilder.js';
import { createChatRouter } from './modules/ai/chatRouter.js';
import { isWebhookAsyncMode, startWebhookWorker } from './modules/integrations/webhookPipeline.js';
import { isIntegrationSyncWorkerEnabled, startIntegrationSyncWorker } from './modules/integrations/sync/worker.js';
import { attachOpsSocketHub } from './sockets/opsSocket.js';
import { timingSafeEqualString } from './lib/timingSafe.js';

initBusinessMetrics(db);

/** Número de proxies na frente do Node (ex.: 1 com nginx). Necessário para `req.ip` e rate limit por IP. */
function trustProxyHopsFromEnv() {
  const v = (process.env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return 1;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 1 && n <= 32) return Math.trunc(n);
  return null;
}

/** Se `METRICS_TOKEN` estiver definido, `GET /metrics` exige o mesmo valor em `Authorization: Bearer ...` ou query `?token=`. */
function metricsTokenGate(req, res, next) {
  const expected = (process.env.METRICS_TOKEN || '').trim();
  if (!expected) return next();
  const auth = String(req.headers.authorization || '');
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const bearer = m ? m[1].trim() : '';
  const q = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const provided = bearer || q;
  if (!timingSafeEqualString(provided, expected)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="metrics"');
    return res.status(401).json({ ok: false, message: 'Metrics nao autorizadas' });
  }
  next();
}

export function buildServerApp() {
  const app = express();
  const trustHops = trustProxyHopsFromEnv();
  if (trustHops != null) app.set('trust proxy', trustHops);

  app.use(cors());
  app.use(
    express.json({
      limit: '512kb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(metricsMiddleware);

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'guto-express-backend' }));

  app.get('/metrics', metricsTokenGate, (req, res, next) => {
    handleMetrics(req, res).catch(next);
  });

  app.use('/auth', createAuthRouter());
  app.use('/menu', createMenuRouter());
  app.use('/settings', createSettingsRouter(db));
  app.use('/clients', createCustomersRouter(db));
  app.use('/drivers', createDriversRouter(db));

  // Snapshot + regras
  app.get('/ops/snapshot', (_req, res) => res.json(buildOperationalSnapshot(db)));

  app.get('/ai/insights', (_req, res) => {
    const snap = buildOperationalSnapshot(db);
    res.json(snap.ai);
  });

  app.get('/ai/autopilot', (_req, res) => {
    const snap = buildOperationalSnapshot(db);
    const ap = getAutopilotRuntimeSettings(db);
    const body = decideAutopilotActions({
      orders: snap.orders,
      queue: snap.driverQueue.map((q) => ({ driver_id: q.driver_id })),
      settings: {
        enabled: ap.enabled,
        allowAutoAssign: ap.allowAutoAssign,
        allowAutoDispatch: ap.allowAutoDispatch,
      },
    });
    res.json({ ...body, config: ap, configSource: 'settings' });
  });

  // ChatGPT (OpenAI)
  app.use('/ai', createChatRouter(db));

  // Routers por modulo
  app.use(createOrdersRouter(db));
  app.use(createKdsRouter(db));
  app.use(createDispatchRouter(db));
  app.use(createIntegrationsRouter(db));
  app.use(createRoutingRouter(db));

  return app;
}

const PORT = Number(process.env.PORT) || 3210;
const HOST = process.env.HOST?.trim() || undefined;

const app = buildServerApp();
const httpServer = http.createServer(app);

let stopWebhookWorker = null;
if (isWebhookAsyncMode()) {
  stopWebhookWorker = startWebhookWorker(db);
  console.log('[webhook] WEBHOOK_ASYNC ativo — worker processando fila SQLite');
}

let stopIntegrationSyncWorker = null;
if (isIntegrationSyncWorkerEnabled()) {
  stopIntegrationSyncWorker = startIntegrationSyncWorker(db);
  console.log('[integration-sync] INTEGRATION_SYNC_WORKER ativo — outbox integration_partner_sync_jobs');
}

const opsSocket = attachOpsSocketHub(httpServer, db);

const server = httpServer;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Porta ${PORT} ja esta em uso. Feche o outro processo ou defina outra porta (ex.: PORT=3220).`,
    );
    process.exit(1);
  }
  throw err;
});

if (HOST) {
  server.listen(PORT, HOST, () => console.log(`Servidor rodando em http://${HOST}:${PORT}`));
} else {
  server.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
}

const shutdown = () => {
  if (stopWebhookWorker) stopWebhookWorker();
  if (stopIntegrationSyncWorker) stopIntegrationSyncWorker();
  opsSocket.close();
  server.close(() => process.exit(0));
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

