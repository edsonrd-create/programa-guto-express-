import { getHoursConfig, getStoreOpenStatusNow } from './hours.js';

export function getClosedMessage(db) {
  const cfg = getHoursConfig(db);
  const msg = String(cfg.rules.closed_message || '').trim();
  return msg || 'No momento estamos fechados. Retornamos no próximo horário de funcionamento.';
}

export function shouldBlockOrdersNow(db, now = new Date()) {
  const cfg = getHoursConfig(db);
  if (!cfg.rules.block_outside_hours) return { block: false, openNow: true, statusNow: null };
  const statusNow = getStoreOpenStatusNow(db, now);
  // Manual: aplica fechamento pelo calendário. IA/assistido: não bloqueia ingestão (operação pode seguir com revisão humana/autopilot).
  const iaMode = cfg.rules.mode === 'ia';
  if (iaMode) return { block: false, openNow: statusNow.openNow, statusNow };
  return { block: !statusNow.openNow, openNow: statusNow.openNow, statusNow };
}

