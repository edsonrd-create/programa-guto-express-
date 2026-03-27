import { apiGet, apiPatch, apiPost, getApiPublicBase } from './apiClient.js';

/** Deve coincidir com `backend/.../webhookSignature.js` */
export const WEBHOOK_SIGNATURE_HEADER = 'x-guto-webhook-signature';

/**
 * HMAC-SHA256 do corpo bruto (mesmos bytes enviados no POST), hex minúsculo.
 * @param {string} secret
 * @param {string} rawBody
 */
export async function signWebhookBody(secret, rawBody) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const integrationsService = {
  list: () => apiGet('/integrations'),
  create: (body) => apiPost('/integrations', body),
  patch: (id, body) => apiPatch(`/integrations/${id}`, body),
  reviewQueue: () => apiGet('/integrations/review-queue'),
  resolveReview: (id) => apiPost(`/integrations/review-queue/${id}/resolve`, {}),
  /** Jobs quando o backend usa `WEBHOOK_ASYNC=1`. */
  webhookJobs: (limit = 80) => apiGet(`/integrations/webhook-jobs?limit=${encodeURIComponent(limit)}`),
};

/**
 * Simula webhook contra o backend real (resposta bruta para debug).
 * Se a integração tiver `webhook_secret`, envia o header de assinatura (obrigatório no servidor).
 *
 * @param {string} channel
 * @param {object} jsonBody
 * @param {{ webhookSecret?: string | null }} [opts]
 */
export async function postWebhookSimulator(channel, jsonBody, opts = {}) {
  const base = getApiPublicBase();
  const url = `${base}/integrations/webhook/${encodeURIComponent(String(channel).trim())}`;
  const bodyStr = JSON.stringify(jsonBody);
  const headers = { 'Content-Type': 'application/json' };
  const secret = opts.webhookSecret != null ? String(opts.webhookSecret).trim() : '';
  if (secret) {
    const hex = await signWebhookBody(secret, bodyStr);
    headers[WEBHOOK_SIGNATURE_HEADER] = `sha256=${hex}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  });
  const text = await res.text();
  return { status: res.status, statusText: res.statusText, text };
}

export function webhookUrlForChannel(channel) {
  return `${getApiPublicBase()}/integrations/webhook/${encodeURIComponent(String(channel).trim())}`;
}
