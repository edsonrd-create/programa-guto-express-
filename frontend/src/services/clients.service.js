import { apiPost } from './apiClient.js';

export const clientsService = {
  create: (body) => apiPost('/clients', body),
};
