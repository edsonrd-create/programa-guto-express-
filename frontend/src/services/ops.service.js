import { apiGet } from './apiClient.js';

export function fetchOperationalSnapshot() {
  return apiGet('/ops/snapshot');
}

export function fetchAutopilot() {
  return apiGet('/ai/autopilot');
}

export function fetchAiInsights() {
  return apiGet('/ai/insights');
}
