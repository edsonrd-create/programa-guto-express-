import { apiGet, apiPost } from './apiClient.js';

export const dispatchService = {
  listDeliveries: () => apiGet('/dispatch/deliveries'),
  listDispatchOrders: () => apiGet('/dispatch'),
  assignNext: (orderId) => apiPost(`/dispatch/${orderId}/assign-next-driver`, {}),
  send: (orderId) => apiPost(`/dispatch/${orderId}/send`, {}),
  markDelivered: (orderId) => apiPost(`/dispatch/${orderId}/mark-delivered`, {}),
};
