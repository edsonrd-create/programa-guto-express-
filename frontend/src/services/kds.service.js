import { apiGet, apiPost } from './apiClient.js';

export const kdsService = {
  queue: () => apiGet('/kds'),
  start: (orderId) => apiPost(`/kds/${orderId}/start`, {}),
  ready: (orderId) => apiPost(`/kds/${orderId}/ready`, {}),
};
