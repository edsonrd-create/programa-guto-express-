import { apiGet, apiPatch } from './apiClient.js';

export const settingsService = {
  get: () => apiGet('/settings'),
  patch: (body) => apiPatch('/settings', body),
};

