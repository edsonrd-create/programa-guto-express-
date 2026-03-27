import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { normalizeIntegrationPayload } from './normalizer.js';
import {
  isWebhookAsyncMode,
  enqueueWebhookJob,
  logWebhookError,
  runWebhookOrderTransaction,
  maybeApplyWebhookGeocode,
} from './webhookPipeline.js';
import { processIntegrationOrder } from './processor.js';
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from './webhookSignature.js';
import { countPartnerSyncJobsByStatus } from './sync/outbox.js';

export function createIntegrationsRouter(db) {
  const router = Router();

  const webhookLimiter = rateLimit({
    windowMs: Math.max(1000, Number(process.env.WEBHOOK_RATE_WINDOW_MS || 60_000) || 60_000),
    max: Math.max(1, Number(process.env.WEBHOOK_RATE_MAX || 200) || 200),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: 'RATE_LIMIT',
      message: 'Muitas requisicoes de webhook; aguarde e tente novamente.',
    },
    keyGenerator: (req) => ipKeyGenerator(req),
  });

  router.get('/integrations', (_req, res) => {
    res.json(db.prepare('SELECT * FROM integrations ORDER BY id DESC').all());
  });

  router.post('/integrations', (req, res) => {
    const { name, channel, token = null, webhook_secret = null, active = true, auto_accept = false } = req.body;
    const result = db.prepare('INSERT INTO integrations (name, channel, token, webhook_secret, active, auto_accept) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, channel, token, webhook_secret, active ? 1 : 0, auto_accept ? 1 : 0);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.post('/integrations/webhook/:channel', webhookLimiter, async (req, res) => {
    const channel = req.params.channel;
    let integration = db.prepare('SELECT * FROM integrations WHERE channel = ? LIMIT 1').get(channel);
    if (!integration) {
      const created = db.prepare('INSERT INTO integrations (name, channel, active, auto_accept) VALUES (?, ?, 1, 1)').run(channel, channel);
      integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(created.lastInsertRowid);
    }

    if (!integration.active) {
      return res.status(403).json({
        ok: false,
        code: 'INTEGRATION_DISABLED',
        message: 'Integracao inativa no painel. Ative o canal em Integracoes antes de receber webhooks.',
      });
    }

    const sig = verifyWebhookSignature(integration.webhook_secret, req.rawBody, req.headers[WEBHOOK_SIGNATURE_HEADER]);
    if (!sig.ok) {
      return res.status(401).json({
        ok: false,
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: `Assinatura invalida ou ausente. Com webhook_secret configurado, envie o header ${WEBHOOK_SIGNATURE_HEADER}: sha256=<hex> (HMAC-SHA256 do corpo JSON bruto, 64 caracteres hex).`,
      });
    }

    const normalized = normalizeIntegrationPayload(channel, req.body || {});

    if (isWebhookAsyncMode()) {
      const jobId = enqueueWebhookJob(db, { channel, integrationId: integration.id, normalized });
      return res.status(202).json({
        ok: true,
        queued: true,
        jobId,
        externalOrderId: normalized.externalOrderId
      });
    }

    try {
      const result = runWebhookOrderTransaction(db, integration, normalized);
      const finalResult = await maybeApplyWebhookGeocode(db, result);
      if (finalResult.mode === 'review') {
        return res.status(202).json({ ok: true, mode: 'review', externalOrderId: finalResult.externalOrderId });
      }
      return res.status(202).json({
        ok: true,
        mode: 'accepted',
        externalOrderId: finalResult.externalOrderId,
        orderId: finalResult.orderId,
        geocode: finalResult.geocode,
      });
    } catch (error) {
      logWebhookError(db, integration, normalized, error);
      const duplicate = String(error.message || '').includes('UNIQUE');
      return res.status(duplicate ? 409 : 500).json({ ok: false, duplicate, message: String(error.message || error) });
    }
  });

  router.get('/integrations/orders', (_req, res) => res.json(db.prepare('SELECT * FROM integration_orders_raw ORDER BY id DESC').all()));
  router.get('/integrations/logs', (_req, res) => res.json(db.prepare('SELECT * FROM integration_logs ORDER BY id DESC').all()));

  /** Fila assíncrona de webhooks (`WEBHOOK_ASYNC=1`). */
  router.get('/integrations/webhook-jobs', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
    const rows = db.prepare('SELECT * FROM integration_webhook_jobs ORDER BY id DESC LIMIT ?').all(limit);
    res.json(rows);
  });

  /**
   * Outbox de sync com parceiro (`INTEGRATION_SYNC_WORKER=1` processa em background).
   * GET conta por status; lista ordenada por id DESC.
   */
  router.get('/integrations/sync-jobs', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
    const rows = db.prepare('SELECT * FROM integration_partner_sync_jobs ORDER BY id DESC LIMIT ?').all(limit);
    res.json({ counts: countPartnerSyncJobsByStatus(db), jobs: rows });
  });

  router.post('/integrations/sync-jobs/:id/retry', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ ok: false, message: 'id invalido' });
    const row = db.prepare('SELECT * FROM integration_partner_sync_jobs WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ ok: false, message: 'Job nao encontrado' });
    if (row.status !== 'failed') {
      return res.status(409).json({ ok: false, message: 'Apenas jobs failed podem ser reenfileirados' });
    }
    db.prepare(
      `UPDATE integration_partner_sync_jobs
          SET status = 'pending',
              last_error = NULL,
              processed_at = NULL,
              processing_since = NULL,
              attempts = 0
        WHERE id = ?`,
    ).run(id);
    res.json({ ok: true, id });
  });

  router.patch('/integrations/:id', (req, res) => {
    const id = Number(req.params.id);
    const integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(id);
    if (!integration) return res.status(404).json({ ok: false, message: 'Integracao nao encontrada' });

    const { name, token, webhook_secret, active } = req.body || {};
    const nextName = typeof name === 'string' && name.trim() ? name.trim() : integration.name;
    const nextToken = token === '' || token === undefined ? (integration.token ?? null) : token;
    const nextWebhookSecret = webhook_secret === '' || webhook_secret === undefined ? (integration.webhook_secret ?? null) : webhook_secret;
    const nextActive = typeof active === 'boolean' ? (active ? 1 : 0) : integration.active;

    db.prepare('UPDATE integrations SET name = ?, token = ?, webhook_secret = ?, active = ? WHERE id = ?').run(
      nextName,
      nextToken,
      nextWebhookSecret,
      nextActive,
      id
    );

    res.json(db.prepare('SELECT * FROM integrations WHERE id = ?').get(id));
  });

  router.get('/integrations/review-queue', (_req, res) => {
    const rows = db.prepare(
      `SELECT rq.id,
              rq.integration_raw_id,
              rq.reason,
              rq.resolved_at,
              raw.external_order_id,
              raw.payload_json
         FROM review_queue rq
         JOIN integration_orders_raw raw ON raw.id = rq.integration_raw_id
        ORDER BY rq.id DESC`
    ).all();
    res.json(rows);
  });

  router.post('/integrations/review-queue/:id/resolve', async (req, res) => {
    const reviewId = Number(req.params.id);

    const row = db.prepare(
      `SELECT rq.*,
              raw.integration_id,
              raw.external_order_id,
              raw.payload_json,
              i.channel
         FROM review_queue rq
         JOIN integration_orders_raw raw ON raw.id = rq.integration_raw_id
         JOIN integrations i ON i.id = raw.integration_id
        WHERE rq.id = ?`
    ).get(reviewId);

    if (!row) return res.status(404).json({ ok: false, message: 'Fila de revisao nao encontrada' });
    if (row.resolved_at) return res.status(409).json({ ok: false, message: 'Ja resolvido' });

    let rawPayload;
    try {
      rawPayload = JSON.parse(row.payload_json || '{}');
    } catch {
      rawPayload = {};
    }

    const normalized = normalizeIntegrationPayload(row.channel, rawPayload);

    try {
      const processed = db.transaction(() => {
        const p = processIntegrationOrder(db, normalized);
        db.prepare('UPDATE integration_orders_raw SET processing_status = ? WHERE id = ?').run('aprovado', row.integration_raw_id);
        db.prepare(
          'INSERT INTO integration_logs (integration_id, external_order_id, event, status, message) VALUES (?, ?, ?, ?, ?)'
        ).run(
          row.integration_id,
          row.external_order_id,
          'auto_accepted',
          'ok',
          'Pedido resolvido na review_queue'
        );
        db.prepare('UPDATE review_queue SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?').run(reviewId);
        return p;
      })();

      await maybeApplyWebhookGeocode(db, {
        mode: 'accepted',
        orderId: processed.orderId,
        pendingGeocodeAddress: processed.pendingGeocodeAddress,
      });
      res.json({ ok: true, orderId: processed.orderId });
    } catch (e) {
      const duplicate = String(e.message || '').includes('UNIQUE');
      res.status(duplicate ? 409 : 500).json({ ok: false, duplicate, message: String(e.message || e) });
    }
  });

  return router;
}
