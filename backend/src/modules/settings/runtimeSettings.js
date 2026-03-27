/**
 * Leituras usadas em tempo de execução (SQLite `settings` + fallback em env).
 */

function getSettingRaw(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(String(key));
  return row ? String(row.value) : null;
}

function parseBoolStored(raw, fallback) {
  if (raw == null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

/** Intervalo de broadcast WS (/ws/ops): persistido ou OPS_WS_BROADCAST_MS (2000–60000). */
export function getOpsWsBroadcastMs(db) {
  const raw = getSettingRaw(db, 'ops_ws_broadcast_ms');
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(2000, Math.min(60000, Math.trunc(n)));
  }
  const fromEnv = Number(process.env.OPS_WS_BROADCAST_MS || 4000) || 4000;
  return Math.max(2000, Math.min(60000, Math.trunc(fromEnv)));
}

/**
 * Flags do autopilot em GET /ai/autopilot.
 * Sem linhas no banco: compatível com o comportamento antigo (hardcoded).
 */
export function getAutopilotRuntimeSettings(db) {
  return {
    enabled: parseBoolStored(getSettingRaw(db, 'autopilot_enabled'), true),
    allowAutoAssign: parseBoolStored(getSettingRaw(db, 'allow_auto_assign'), true),
    allowAutoDispatch: parseBoolStored(getSettingRaw(db, 'allow_auto_dispatch'), false),
  };
}
