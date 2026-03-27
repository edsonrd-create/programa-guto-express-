function pad2(n) {
  return String(n).padStart(2, '0');
}

export function minutesToTime(m) {
  const mm = ((Number(m) % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60);
  const mi = mm % 60;
  return `${pad2(h)}:${pad2(mi)}`;
}

export function timeToMinutes(hhmm) {
  const s = String(hhmm || '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

/** Monday=1..Sunday=7 */
export function jsDayToIsoDow(jsDay) {
  // JS: 0 Sunday..6 Saturday
  if (jsDay === 0) return 7;
  return jsDay;
}

export function isoDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth() + 1);
  const day = pad2(dt.getDate());
  return `${y}-${m}-${day}`;
}

function readSettingsKV(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  /** @type {Record<string,string>} */
  const out = {};
  for (const r of rows) out[String(r.key)] = String(r.value);
  return out;
}

export function getHoursConfig(db) {
  const weekly = db
    .prepare(
      `SELECT iso_dow, active, open_time, close_time, break_label
         FROM store_week_hours
        ORDER BY iso_dow ASC`,
    )
    .all();

  const exceptions = db
    .prepare(
      `SELECT date, mode, open_time, close_time, break_label, note
         FROM store_date_exceptions
        ORDER BY date ASC`,
    )
    .all();

  const holidays = db
    .prepare(
      `SELECT date, name, mode, open_time, close_time, note
         FROM store_holidays
        ORDER BY date ASC`,
    )
    .all();

  const kv = readSettingsKV(db);
  const rules = {
    block_outside_hours: kv.block_outside_hours === 'true',
    closed_message:
      kv.closed_message ||
      'No momento estamos fechados. Retornamos no próximo horário de funcionamento.',
    sync_integrations: kv.sync_integrations === 'true',
    mode: kv.hours_mode === 'ia' ? 'ia' : 'manual',
  };

  const lastChange = db
    .prepare(
      `SELECT changed_at, actor, source, reason
         FROM store_hours_audit
        ORDER BY id DESC
        LIMIT 1`,
    )
    .get();

  return { weekly, exceptions, holidays, rules, lastChange: lastChange || null };
}

function matchByDate(rows, date) {
  for (const r of rows) if (String(r.date) === date) return r;
  return null;
}

/** Returns { openNow, reason, window?, nextChange? } */
export function getStoreOpenStatusNow(db, now = new Date()) {
  const cfg = getHoursConfig(db);
  const d = isoDate(now);
  const ex = matchByDate(cfg.exceptions, d);
  const hol = matchByDate(cfg.holidays, d);
  const jsDow = now.getDay();
  const isoDow = jsDayToIsoDow(jsDow);
  const week = cfg.weekly.find((w) => Number(w.iso_dow) === isoDow) || null;

  let mode = null;
  let active = false;
  let openTime = null;
  let closeTime = null;

  // Priority: exception > holiday > weekly
  const src = ex || hol || week;
  if (src) {
    mode = src.mode ?? null;
    if (mode === 'closed') {
      active = false;
    } else if (mode === 'open') {
      active = true;
      openTime = src.open_time ?? null;
      closeTime = src.close_time ?? null;
    } else {
      // weekly row
      active = Number(src.active) === 1 || src.active === true;
      openTime = src.open_time ?? null;
      closeTime = src.close_time ?? null;
    }
  }

  if (!active || !openTime || !closeTime) {
    return { openNow: false, reason: src ? 'schedule_inactive' : 'no_schedule', date: d };
  }

  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  if (openMin == null || closeMin == null) return { openNow: false, reason: 'invalid_time', date: d };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const overnight = closeMin < openMin;

  const isOpen = overnight
    ? nowMin >= openMin || nowMin < closeMin
    : nowMin >= openMin && nowMin < closeMin;

  return {
    openNow: isOpen,
    reason: ex ? 'exception' : hol ? 'holiday' : 'weekly',
    date: d,
    window: { open: openTime, close: closeTime, overnight },
  };
}

export function ensureDefaultWeekHours(db) {
  const row = db.prepare('SELECT COUNT(*) as c FROM store_week_hours').get();
  const c = Number(row?.c || 0);
  if (c > 0) return;
  const insert = db.prepare(
    `INSERT INTO store_week_hours (iso_dow, active, open_time, close_time, break_label)
     VALUES (?, ?, ?, ?, ?)`,
  );
  db.transaction(() => {
    // padrão pizzaria: seg-sáb ativo 18:00–23:30, dom fechado
    for (let dow = 1; dow <= 6; dow += 1) insert.run(dow, 1, '18:00', '23:30', 'Sem intervalo');
    insert.run(7, 0, '18:00', '23:00', 'Sem intervalo');
  })();
}

