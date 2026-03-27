/**
 * Estratégias de entrega: stub | http (JSON genérico) | channels (iFood/99 + fallback URL).
 */
import { buildStoreClosedChannelBody, detectPartnerChannel, resolveChannelSyncUrl } from './channelAdapters.js';

async function postJson(url, bodyObj, timeoutMs) {
  const token = (process.env.INTEGRATION_SYNC_HTTP_TOKEN || '').trim();
  /** @type {Record<string, string>} */
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    return { status: res.status, bodyPreview: text.slice(0, 400) };
  } finally {
    clearTimeout(t);
  }
}

export async function deliverPartnerSyncPayload(db, job) {
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(job.integration_id);
  if (!integration) throw new Error('Integracao nao encontrada');

  const mode = (process.env.INTEGRATION_SYNC_DELIVERY || 'stub').trim().toLowerCase();
  let payload;
  try {
    payload = JSON.parse(job.payload_json || '{}');
  } catch {
    payload = {};
  }

  const timeoutMs = Math.max(3000, Number(process.env.INTEGRATION_SYNC_HTTP_TIMEOUT_MS || 15000) || 15000);

  if (mode === 'http') {
    const url = (process.env.INTEGRATION_SYNC_HTTP_URL || '').trim();
    if (!url) throw new Error('INTEGRATION_SYNC_HTTP_URL ausente com INTEGRATION_SYNC_DELIVERY=http');
    const body = {
      kind: job.kind,
      channel: job.channel,
      integration_id: job.integration_id,
      idempotency_key: job.idempotency_key,
      payload,
    };
    const { status, bodyPreview } = await postJson(url, body, timeoutMs);
    return { delivery: 'http', status, bodyPreview };
  }

  if (mode === 'channels') {
    const partner = detectPartnerChannel(job.channel);
    const url = resolveChannelSyncUrl(partner);
    if (!url) {
      const hint =
        partner === 'ifood'
          ? 'Defina INTEGRATION_SYNC_IFOOD_URL ou INTEGRATION_SYNC_HTTP_URL'
          : partner === '99food'
            ? 'Defina INTEGRATION_SYNC_99FOOD_URL ou INTEGRATION_SYNC_HTTP_URL'
            : 'Defina INTEGRATION_SYNC_HTTP_URL (canal generico)';
      throw new Error(`URL de sync por canal ausente (${partner}). ${hint}`);
    }
    const body = buildStoreClosedChannelBody(job, payload, partner);
    const { status, bodyPreview } = await postJson(url, body, timeoutMs);
    return {
      delivery: 'channels',
      partner,
      channel_raw: String(job.channel || ''),
      status,
      bodyPreview,
    };
  }

  return {
    delivery: 'stub',
    kind: job.kind,
    channel: job.channel,
    message:
      'Entrega simulada (INTEGRATION_SYNC_DELIVERY=stub). Use http, ou channels (iFood/99) + URLs.',
  };
}
