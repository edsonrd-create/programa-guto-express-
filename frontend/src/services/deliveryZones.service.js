import { apiGet, apiPatch, apiPost } from './apiClient.js';

function qs(params) {
  const e = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    e.set(k, String(v));
  }
  const s = e.toString();
  return s ? `?${s}` : '';
}

export const deliveryZonesService = {
  list: (params) => apiGet(`/settings/delivery-zones${qs(params)}`),
  exportJson: () => apiGet('/settings/delivery-zones/export'),
  create: (body) => apiPost('/settings/delivery-zones', body),
  update: (id, body) => apiPatch(`/settings/delivery-zones/${id}`, body),
  history: (id, limit = 40) => apiGet(`/settings/delivery-zones/${id}/history${qs({ limit })}`),
  aiSuggestion: (id) => apiGet(`/settings/delivery-zones/${id}/ai-suggestion`),
  bulk: (body) => apiPost('/settings/delivery-zones/bulk', body),
};
