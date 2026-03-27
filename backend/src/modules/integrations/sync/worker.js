import {
  claimNextPartnerSyncJob,
  markPartnerSyncDone,
  markPartnerSyncFailedOrRetry,
  requeueStalePartnerSyncJobs,
} from './outbox.js';
import { deliverPartnerSyncPayload } from './deliver.js';

export function isIntegrationSyncWorkerEnabled() {
  const v = (process.env.INTEGRATION_SYNC_WORKER || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

function externalIdFromPayload(job) {
  try {
    const p = JSON.parse(job.payload_json || '{}');
    return p.externalOrderId != null ? String(p.externalOrderId) : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function processOnePartnerSyncJob(db) {
  const job = claimNextPartnerSyncJob(db);
  if (!job) return false;

  try {
    const result = await deliverPartnerSyncPayload(db, job);
    const ext = externalIdFromPayload(job);
    const summary =
      result.delivery === 'http'
        ? `partner_sync http ${result.status}`
        : `partner_sync stub (${String(job.kind)})`;

    db.transaction(() => {
      markPartnerSyncDone(db, job.id, result);
      db.prepare(
        `INSERT INTO integration_logs (integration_id, external_order_id, event, status, message)
         VALUES (?, ?, 'partner_sync_ok', 'ok', ?)`,
      ).run(job.integration_id, ext, summary);
    })();
  } catch (e) {
    markPartnerSyncFailedOrRetry(db, job, e);
  }

  return true;
}

export function startIntegrationSyncWorker(db) {
  requeueStalePartnerSyncJobs(db);

  const pollMs = Math.max(200, Number(process.env.INTEGRATION_SYNC_POLL_MS || 2000) || 2000);
  const batch = Math.max(1, Math.min(20, Number(process.env.INTEGRATION_SYNC_BATCH || 10) || 10));

  const tick = async () => {
    requeueStalePartnerSyncJobs(db);
    let n = 0;
    while (n < batch && (await processOnePartnerSyncJob(db))) n += 1;
  };

  tick().catch((e) => console.error('[integration-sync] tick', e));
  const id = setInterval(() => {
    tick().catch((e2) => console.error('[integration-sync] tick', e2));
  }, pollMs);

  return () => clearInterval(id);
}
