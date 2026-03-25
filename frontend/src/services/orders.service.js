import { apiGet, apiPost, apiPatch } from './apiClient.js';

export const ordersService = {
  list: () => apiGet('/orders'),
  getById: (id) => apiGet(`/orders/${id}`),
  create: (body) => apiPost('/orders', body),
  addItem: (orderId, body) => apiPost(`/orders/${orderId}/items`, body),
  setStatus: (orderId, status) =>
    apiPost(`/orders/${orderId}/status`, { status, description: 'Alterado pelo painel' }),
  saveDelivery: (orderId, payload) => apiPatch(`/orders/${orderId}/delivery`, payload),
};
