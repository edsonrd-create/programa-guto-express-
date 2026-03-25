import { apiGet, apiPatch, apiPost, getApiPublicBase } from './apiClient.js';

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
 */
export async function postWebhookSimulator(channel, jsonBody) {
  const base = getApiPublicBase();
  const url = `${base}/integrations/webhook/${encodeURIComponent(String(channel).trim())}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonBody),
  });
  const text = await res.text();
  return { status: res.status, statusText: res.statusText, text };
}

export function webhookUrlForChannel(channel) {
  return `${getApiPublicBase()}/integrations/webhook/${encodeURIComponent(String(channel).trim())}`;
}
