import { apiGet, apiPost, apiPatch } from './apiClient.js';

export const menuService = {
  /** Catálogo: apenas itens ativos (atendimento). */
  catalog: () => apiGet('/menu/items'),
  /** Lista completa para gestão (inclui inativos). */
  listManage: () => apiGet('/menu/manage/items'),
  create: (body) => apiPost('/menu/manage/items', body),
  update: (id, body) => apiPatch(`/menu/manage/items/${id}`, body),
};
