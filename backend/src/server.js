import 'dotenv/config';
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
import { decideAutopilotActions } from './modules/ai/autopilot.js';
import { buildOperationalSnapshot } from './modules/ops/snapshotBuilder.js';
import { createChatRouter } from './modules/ai/chatRouter.js';
import { isWebhookAsyncMode, startWebhookWorker } from './modules/integrations/webhookPipeline.js';
import { attachOpsSocketHub } from './sockets/opsSocket.js';

initBusinessMetrics(db);

export function buildServerApp() {
  const app = express();
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

  app.get('/metrics', (req, res, next) => {
    handleMetrics(req, res).catch(next);
  });

  app.use('/auth', createAuthRouter());
  app.use('/menu', createMenuRouter());
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
    res.json(
      decideAutopilotActions({
        orders: snap.orders,
        queue: snap.driverQueue.map((q) => ({ driver_id: q.driver_id })),
        settings: { enabled: true, allowAutoAssign: true, allowAutoDispatch: false }
      })
    );
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
  opsSocket.close();
  server.close(() => process.exit(0));
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

