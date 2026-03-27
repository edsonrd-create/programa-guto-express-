/**
 * Outbox SQLite para entregas ao parceiro (padrão transactional outbox).
 * O produtor (webhook) grava na mesma transação que o domínio; o worker consome de forma assíncrona.
 */

export const SYNC_KIND_STORE_CLOSED = 'store_closed_notify';

export function enqueueStoreClosedPartnerSync(db, { integrationId, channel, externalOrderId, closedMessage, sourceIntegrationLogId }) {
  const idem = `store_closed:v1:${integrationId}:${String(externalOrderId)}`;
  const payload = JSON.stringify({
    externalOrderId: String(externalOrderId),
    closedMessage: String(closedMessage ?? ''),
    sourceIntegrationLogId: sourceIntegrationLogId != null ? Number(sourceIntegrationLogId) : null,
    enqueuedAt: new Date().toISOString(),
  });
  try {
    const r = db
      .prepare(
        `INSERT INTO integration_partner_sync_jobs (integration_id, channel, kind, idempotency_key, payload_json, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
      )
      .run(integrationId, String(channel || ''), SYNC_KIND_STORE_CLOSED, idem, payload);
    return { inserted: true, jobId: Number(r.lastInsertRowid) };
  } catch (e) {
    if (String(e?.message || e).includes('UNIQUE')) return { inserted: false, duplicate: true };
    throw e;
  }
}

export function claimNextPartnerSyncJob(db) {
  return db.transaction(() => {
    const job = db
      .prepare(`SELECT * FROM integration_partner_sync_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 1`)
      .get();
    if (!job) return null;
    db.prepare(
      `UPDATE integration_partner_sync_jobs
          SET status = 'processing',
              attempts = attempts + 1,
              processing_since = CURRENT_TIMESTAMP
        WHERE id = ?`,
    ).run(job.id);
    return db.prepare(`SELECT * FROM integration_partner_sync_jobs WHERE id = ?`).get(job.id);
  })();
}

export function markPartnerSyncDone(db, jobId, resultObj) {
  db.prepare(
    `UPDATE integration_partner_sync_jobs
        SET status = 'done',
            result_json = ?,
            processed_at = CURRENT_TIMESTAMP,
            last_error = NULL
      WHERE id = ?`,
  ).run(JSON.stringify(resultObj), jobId);
}

export function markPartnerSyncFailedOrRetry(db, job, err) {
  const maxAttempts = Math.max(1, Number(process.env.INTEGRATION_SYNC_MAX_ATTEMPTS || 5) || 5);
  const attempts = Number(job.attempts) || 1;
  const msg = String(err?.message || err);
  const shouldFail = attempts >= maxAttempts;
  if (shouldFail) {
    db.prepare(
      `UPDATE integration_partner_sync_jobs
          SET status = 'failed',
              last_error = ?,
              processed_at = CURRENT_TIMESTAMP,
              processing_since = NULL
        WHERE id = ?`,
    ).run(msg, job.id);
  } else {
    db.prepare(
      `UPDATE integration_partner_sync_jobs
          SET status = 'pending',
              last_error = ?,
              processing_since = NULL
        WHERE id = ?`,
    ).run(msg, job.id);
  }
}

/**
 * Reenfileira jobs presos em `processing` (crash do processo, SIGKILL, etc.).
 * Usa `processing_since` + limiar em segundos (`INTEGRATION_SYNC_STALE_PROCESSING_SEC`, default 120).
 */
export function requeueStalePartnerSyncJobs(db) {
  const sec = Math.max(30, Number(process.env.INTEGRATION_SYNC_STALE_PROCESSING_SEC || 120) || 120);
  const mod = `-${sec} seconds`;
  const staleMsg = `requeue: processing obsoleto (>${sec}s; possivel crash do worker)`;
  const r = db
    .prepare(
      `UPDATE integration_partner_sync_jobs
          SET status = 'pending',
              processing_since = NULL,
              last_error = ?
        WHERE status = 'processing'
          AND processing_since IS NOT NULL
          AND datetime(processing_since) < datetime('now', ?)`,
    )
    .run(staleMsg, mod);
  const n = Number(r.changes || 0);
  if (n > 0) console.warn(`[integration-sync] Reenfileirados ${n} job(s) em processing obsoleto`);
  return n;
}

export function countPartnerSyncJobsByStatus(db) {
  const rows = db.prepare(`SELECT status, COUNT(*) as c FROM integration_partner_sync_jobs GROUP BY status`).all();
  const out = { pending: 0, processing: 0, done: 0, failed: 0 };
  for (const r of rows) {
    const k = String(r.status);
    if (k in out) out[k] = Number(r.c) || 0;
  }
  return out;
}
