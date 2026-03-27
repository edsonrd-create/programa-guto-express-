/**
 * Adaptação leve por canal para POST outbound (contrato próprio até plugar APIs oficiais iFood/99).
 * INTEGRATION_SYNC_DELIVERY=channels usa URLs por variável de ambiente.
 */

/** @typedef {'ifood' | '99food' | 'generic'} PartnerHint */

export function detectPartnerChannel(channelRaw) {
  const c = String(channelRaw || '').trim().toLowerCase();
  if (c.includes('ifood')) return 'ifood';
  if (c.includes('99food') || c === '99' || /\b99\b/.test(c)) return '99food';
  return 'generic';
}

export function resolveChannelSyncUrl(partner) {
  const fallback = (process.env.INTEGRATION_SYNC_HTTP_URL || '').trim();
  if (partner === 'ifood') return (process.env.INTEGRATION_SYNC_IFOOD_URL || '').trim() || fallback;
  if (partner === '99food') return (process.env.INTEGRATION_SYNC_99FOOD_URL || '').trim() || fallback;
  return fallback;
}

/**
 * Corpo JSON estável para gateways internos ou BFF que traduzem para API do parceiro.
 */
export function buildStoreClosedChannelBody(job, payload, partner) {
  const occurredAt = new Date().toISOString();
  return {
    guto_event: 'store_closed_order_blocked',
    platform: partner === 'generic' ? String(job.channel || 'unknown') : partner,
    channel_raw: String(job.channel || ''),
    integration_id: job.integration_id,
    external_order_id: payload.externalOrderId != null ? String(payload.externalOrderId) : null,
    closed_customer_message: payload.closedMessage != null ? String(payload.closedMessage) : '',
    idempotency_key: String(job.idempotency_key || ''),
    source_integration_log_id: payload.sourceIntegrationLogId ?? null,
    enqueued_at: payload.enqueuedAt ?? null,
    occurred_at: occurredAt,
  };
}
