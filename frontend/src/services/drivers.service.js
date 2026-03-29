import { apiGet, apiPost } from './apiClient.js';

export const driversService = {
  list: () => apiGet('/drivers'),
  create: (body) => apiPost('/drivers', body),
  checkIn: (id) => apiPost(`/drivers/${id}/check-in`, {}),
  queue: () => apiGet('/drivers/queue'),
  /** Atualiza GPS do motoboy (usado no modo fila por proximidade). */
  postLocation: (id, body) => apiPost(`/drivers/${id}/location`, body),
};
