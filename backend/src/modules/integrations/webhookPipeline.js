import { normalizeIntegrationPayload } from './normalizer.js';
import { processIntegrationOrder } from './processor.js';
import { geocodeAndPersistOrderDelivery } from '../routing/googleRoutes.js';
import { getGoogleMapsServerKey } from '../../config/googleMapsServer.js';
import { getHoursConfig } from '../settings/hours.js';
import { getClosedMessage, shouldBlockOrdersNow } from '../settings/hoursEnforcer.js';
import { enqueueStoreClosedPartnerSync } from './sync/outbox.js';

/** Se `WEBHOOK_GEOCODE_DELIVERY=1` e houver chave Google no servidor, preenche lat/lng após criar o pedido. */
export async function maybeApplyWebhookGeocode(db, result) {
  if ((process.env.WEBHOOK_GEOCODE_DELIVERY || '').trim() !== '1') return result;
  if (result.mode !== 'accepted' || !result.orderId || !result.pendingGeocodeAddress) return result;

  const key = getGoogleMapsServerKey();
  if (!key) return { ...result, geocode: { skipped: true, reason: 'Chave Google ausente no servidor' } };

  try {
    const geo = await geocodeAndPersistOrderDelivery(db, result.orderId, result.pendingGeocodeAddress, key);
    return { ...result, geocode: geo };
  } catch (e) {
    return { ...result, geocode: { error: String(e.message || e) } };
  }
}

export function isWebhookAsyncMode() {
  const v = (process.env.WEBHOOK_ASYNC || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

export function enqueueWebhookJob(db, { channel, integrationId, normalized }) {
  const r = db
    .prepare(
      `INSERT INTO integration_webhook_jobs (channel, integration_id, payload_json, status)
       VALUES (?, ?, ?, 'pending')`
    )
    .run(channel, integrationId, JSON.stringify(normalized));
  return Number(r.lastInsertRowid);
}

function claimNextJob(db) {
  return db.transaction(() => {
    const job = db
      .prepare(`SELECT * FROM integration_webhook_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 1`)
      .get();
    if (!job) return null;

    db.prepare(`UPDATE integration_webhook_jobs
                   SET status = 'processing',
                       attempts = attempts + 1
                 WHERE id = ?`).run(job.id);

    return db.prepare(`SELECT * FROM integration_webhook_jobs WHERE id = ?`).get(job.id);
  })();
}

function markJobDone(db, jobId, resultJson) {
  db.prepare(
    `UPDATE integration_webhook_jobs
       SET status = 'done',
           result_json = ?,
           processed_at = CURRENT_TIMESTAMP,
           last_error = NULL
     WHERE id = ?`
  ).run(JSON.stringify(resultJson), jobId);
}

function markJobErrorOrRetry(db, job, error) {
  const maxAttempts = Math.max(1, Number(process.env.WEBHOOK_JOB_MAX_ATTEMPTS || 5) || 5);
  const attempts = Number(job.attempts) || 1;
  const duplicate = String(error.message || '').includes('UNIQUE');

  const shouldFail = duplicate || attempts >= maxAttempts;
  const msg = String(error.message || error);
  if (shouldFail) {
    db.prepare(
      `UPDATE integration_webhook_jobs
         SET status = 'failed',
             last_error = ?,
             processed_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(msg, job.id);
  } else {
    db.prepare(
      `UPDATE integration_webhook_jobs
         SET status = 'pending',
             last_error = ?
       WHERE id = ?`
    ).run(msg, job.id);
  }
}

export async function processOneWebhookJob(db) {
  const job = claimNextJob(db);
  if (!job) return false;

  let normalized;
  try {
    normalized = JSON.parse(job.payload_json || '{}');
  } catch (e) {
    markJobErrorOrRetry(db, job, new Error(`payload_json invalido: ${e.message}`));
    return true;
  }

  const integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(job.integration_id);
  if (!integration) {
    markJobErrorOrRetry(db, job, new Error('Integracao nao encontrada'));
    return true;
  }

  try {
    const result = runWebhookOrderTransaction(db, integration, normalized);
    const finalResult = await maybeApplyWebhookGeocode(db, result);
    markJobDone(db, job.id, finalResult);
  } catch (e) {
    logWebhookError(db, integration, normalized, e);
    markJobErrorOrRetry(db, job, e);
  }

  return true;
}

export function startWebhookWorker(db) {
  const pollMs = Math.max(100, Number(process.env.WEBHOOK_WORKER_POLL_MS || 500) || 500);
  const batch = Math.max(1, Math.min(30, Number(process.env.WEBHOOK_WORKER_BATCH || 15) || 15));

  const tick = async () => {
    let n = 0;
    while (n < batch && (await processOneWebhookJob(db))) n += 1;
  };

  tick().catch((e) => console.error('[webhook] worker tick', e));
  const id = setInterval(() => {
    tick().catch((e) => console.error('[webhook] worker tick', e));
  }, pollMs);
  return () => clearInterval(id);
}

export function runWebhookOrderTransaction(db, integration, normalized) {
  const channel = normalized.sourceChannel || integration.channel;

  return db.transaction(() => {
    const raw = normalized.raw ?? normalized;

    const externalOrderId = String(normalized.externalOrderId || raw.externalOrderId || raw.id || `auto-${Date.now()}`);
    const items = Array.isArray(normalized.items) ? normalized.items : [];
    const customerName = normalized.customer?.name;
    const customerPhone = normalized.customer?.phone ?? null;
    const total = Number(normalized.total ?? raw.total ?? raw.amount_total ?? 0);

    const orderRow = db.prepare(
      `INSERT INTO integration_orders_raw (integration_id, external_order_id, payload_json, processing_status)
       VALUES (?, ?, ?, 'recebido')`
    ).run(integration.id, externalOrderId, JSON.stringify(raw));

    db.prepare(
      `INSERT INTO integration_logs (integration_id, external_order_id, event, status, message)
       VALUES (?, ?, 'webhook_received', 'ok', 'Pedido recebido via webhook')`
    ).run(integration.id, externalOrderId);

    const block = shouldBlockOrdersNow(db, new Date());
    if (block.block) {
      const hoursCfg = getHoursConfig(db);
      const syncOn = hoursCfg.rules.sync_integrations;
      const logEvent = syncOn ? 'store_closed_pending_sync' : 'store_closed_block';
      const reviewReason = syncOn
        ? 'Fora do horário (bloqueio automático; sync com integrações ativo)'
        : 'Fora do horário de funcionamento (bloqueio automático)';
      db.prepare(`UPDATE integration_orders_raw SET processing_status = ? WHERE id = ?`).run('revisao', orderRow.lastInsertRowid);
      db.prepare(`INSERT INTO review_queue (integration_raw_id, reason) VALUES (?, ?)`)
        .run(orderRow.lastInsertRowid, reviewReason);
      const closedMsg = getClosedMessage(db);
      const logIns = db
        .prepare(
          `INSERT INTO integration_logs (integration_id, external_order_id, event, status, message)
           VALUES (?, ?, ?, 'warning', ?)`,
        )
        .run(integration.id, externalOrderId, logEvent, closedMsg);
      if (syncOn) {
        enqueueStoreClosedPartnerSync(db, {
          integrationId: integration.id,
          channel,
          externalOrderId,
          closedMessage: closedMsg,
          sourceIntegrationLogId: Number(logIns.lastInsertRowid),
        });
      }
      return { mode: 'review', externalOrderId };
    }

    if (!items.length || !customerName || total <= 0) {
      db.prepare(`UPDATE integration_orders_raw SET processing_status = ? WHERE id = ?`).run('revisao', orderRow.lastInsertRowid);
      db.prepare(`INSERT INTO review_queue (integration_raw_id, reason) VALUES (?, ?)`)
        .run(orderRow.lastInsertRowid, 'Payload incompleto para criacao automatica');
      return { mode: 'review', externalOrderId };
    }

    const enriched = normalizeIntegrationPayload(channel, {
      ...raw,
      externalOrderId,
      customer: { name: customerName, phone: customerPhone },
      items,
      total
    });

    const processed = processIntegrationOrder(db, enriched);
    db.prepare(`UPDATE integration_orders_raw SET processing_status = ? WHERE id = ?`).run('aprovado', orderRow.lastInsertRowid);
    db.prepare(
      `INSERT INTO integration_logs (integration_id, external_order_id, event, status, message)
       VALUES (?, ?, 'auto_accepted', 'ok', 'Pedido criado automaticamente')`
    ).run(integration.id, externalOrderId);

    return {
      mode: 'accepted',
      externalOrderId,
      orderId: processed.orderId,
      pendingGeocodeAddress: processed.pendingGeocodeAddress || null,
    };
  })();
}

export function logWebhookError(db, integration, normalized, error) {
  const duplicate = String(error.message || '').includes('UNIQUE');
  const externalOrderId = normalized?.externalOrderId || normalized?.raw?.externalOrderId || 'unknown';

  db.prepare(
    `INSERT INTO integration_logs (integration_id, external_order_id, event, status, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    integration.id,
    String(externalOrderId),
    duplicate ? 'duplicate_blocked' : 'webhook_error',
    duplicate ? 'warning' : 'error',
    String(error.message || error)
  );
}

