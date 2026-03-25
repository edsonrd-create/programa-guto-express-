import { apiGet, apiPost } from './apiClient.js';

export const driversService = {
  list: () => apiGet('/drivers'),
  create: (body) => apiPost('/drivers', body),
  checkIn: (id) => apiPost(`/drivers/${id}/check-in`, {}),
  queue: () => apiGet('/drivers/queue'),
};
