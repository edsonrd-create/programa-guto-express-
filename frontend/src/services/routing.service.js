import { apiGet, apiPost } from './apiClient.js';

export const routingService = {
  getConfig: () => apiGet('/routing/config'),
  plan: (body) => apiPost('/routing/plan', body),
  /** Geocoding via backend (usa GOOGLE_MAPS_API_KEY no servidor). */
  geocode: (q) => apiGet(`/routing/geocode?q=${encodeURIComponent(String(q || '').trim())}`),
};
