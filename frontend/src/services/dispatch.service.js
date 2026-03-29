import { apiGet, apiPost } from './apiClient.js';

export const dispatchService = {
  listDeliveries: () => apiGet('/dispatch/deliveries'),
  listDispatchOrders: () => apiGet('/dispatch'),
  assignNext: (orderId, body = {}) => apiPost(`/dispatch/${orderId}/assign-next-driver`, body),
  /** Atribui um motoboy específico que esteja na fila (modo manual explícito). */
  assignDriver: (orderId, driverId) => apiPost(`/dispatch/${orderId}/assign-driver`, { driverId }),
  send: (orderId) => apiPost(`/dispatch/${orderId}/send`, {}),
  markDelivered: (orderId) => apiPost(`/dispatch/${orderId}/mark-delivered`, {}),
};
