import { Router } from 'express';
import { z } from 'zod';
import { validationErrorResponse } from '../../validation/httpSchemas.js';
import { ensureDefaultWeekHours, getHoursConfig, getStoreOpenStatusNow, timeToMinutes } from './hours.js';
import { registerDeliveryZoneRoutes } from './deliveryZoneRoutes.js';

const SettingsPatchSchema = z
  .object({
    store_label: z.string().trim().min(1).max(120).optional(),
    store_address: z.string().trim().min(1).max(240).optional(),
    store_lat: z.coerce.number().finite().min(-90).max(90).optional(),
    store_lng: z.coerce.number().finite().min(-180).max(180).optional(),
    ops_ws_broadcast_ms: z.coerce.number().int().min(2000).max(60000).optional(),
    autopilot_enabled: z.coerce.boolean().optional(),
    allow_auto_assign: z.coerce.boolean().optional(),
    allow_auto_dispatch: z.coerce.boolean().optional(),
    /** Quando true, POST /routing/plan pode enriquecer rotas com Google Routes (se houver chave no servidor). */
    routing_google_maps_auto: z.coerce.boolean().optional(),
    /** fifo = ordem na fila; nearest = mais próximo do pedido (GPS) entre quem está na fila */
    dispatch_queue_mode: z.enum(['fifo', 'nearest']).optional(),
  })
  .strict();

const HhMm = z.string().regex(/^\d{1,2}:\d{2}$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const WeeklyRowSchema = z
  .object({
    iso_dow: z.coerce.number().int().min(1).max(7),
    active: z.coerce.boolean(),
    open_time: HhMm.optional(),
    close_time: HhMm.optional(),
    break_label: z.string().max(80).optional().default(''),
  })
  .strict()
  .refine((r) => (!r.active ? true : !!r.open_time && !!r.close_time), { message: 'open_time/close_time obrigatorios quando ativo' })
  .refine((r) => {
    if (!r.active) return true;
    return timeToMinutes(r.open_time) != null && timeToMinutes(r.close_time) != null;
  }, { message: 'Horario invalido' });

const ExceptionRowSchema = z
  .object({
    date: IsoDate,
    mode: z.enum(['open', 'closed']),
    open_time: HhMm.optional(),
    close_time: HhMm.optional(),
    break_label: z.string().max(80).optional().default(''),
    note: z.string().max(240).optional().default(''),
  })
  .strict()
  .refine((r) => (r.mode === 'closed' ? true : !!r.open_time && !!r.close_time), { message: 'open_time/close_time obrigatorios quando open' });

const HolidayRowSchema = z
  .object({
    date: IsoDate,
    name: z.string().max(120).optional().default(''),
    mode: z.enum(['closed', 'open']),
    open_time: HhMm.optional(),
    close_time: HhMm.optional(),
    note: z.string().max(240).optional().default(''),
  })
  .strict()
  .refine((r) => (r.mode === 'closed' ? true : !!r.open_time && !!r.close_time), { message: 'open_time/close_time obrigatorios quando open' });

const HoursPatchSchema = z
  .object({
    weekly: z.array(WeeklyRowSchema).min(7).max(7),
    exceptions: z.array(ExceptionRowSchema).optional().default([]),
    holidays: z.array(HolidayRowSchema).optional().default([]),
    rules: z
      .object({
        block_outside_hours: z.coerce.boolean().optional().default(false),
        closed_message: z.string().max(500).optional().default(''),
        sync_integrations: z.coerce.boolean().optional().default(false),
        mode: z.enum(['manual', 'ia']).optional().default('manual'),
      })
      .optional()
      .default({}),
    reason: z.string().max(240).optional().default(''),
  })
  .strict();

function upsertSetting(db, key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).run(key, String(value));
}

function readAllSettings(db) {
  const rows = db.prepare('SELECT key, value, updated_at FROM settings ORDER BY key ASC').all();
  /** @type {Record<string, any>} */
  const out = {};
  for (const r of rows) out[String(r.key)] = r.value;
  return out;
}

export function createSettingsRouter(db) {
  const r = Router();

  r.get('/', (_req, res) => {
    res.json({ ok: true, settings: readAllSettings(db) });
  });

  r.get('/hours', (_req, res) => {
    ensureDefaultWeekHours(db);
    const cfg = getHoursConfig(db);
    const statusNow = getStoreOpenStatusNow(db, new Date());
    res.json({ ok: true, ...cfg, statusNow });
  });

  r.patch('/hours', (req, res) => {
    ensureDefaultWeekHours(db);
    const parsed = HoursPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));

    const p = parsed.data;
    db.transaction(() => {
      // weekly (replace)
      db.prepare('DELETE FROM store_week_hours').run();
      const insW = db.prepare(
        `INSERT INTO store_week_hours (iso_dow, active, open_time, close_time, break_label)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const w of p.weekly) {
        insW.run(w.iso_dow, w.active ? 1 : 0, w.open_time || null, w.close_time || null, w.break_label || '');
      }

      // exceptions (replace)
      db.prepare('DELETE FROM store_date_exceptions').run();
      const insE = db.prepare(
        `INSERT INTO store_date_exceptions (date, mode, open_time, close_time, break_label, note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      );
      for (const e of p.exceptions) {
        insE.run(e.date, e.mode, e.open_time || null, e.close_time || null, e.break_label || '', e.note || '');
      }

      // holidays (replace)
      db.prepare('DELETE FROM store_holidays').run();
      const insH = db.prepare(
        `INSERT INTO store_holidays (date, name, mode, open_time, close_time, note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      );
      for (const h of p.holidays) {
        insH.run(h.date, h.name || '', h.mode, h.open_time || null, h.close_time || null, h.note || '');
      }

      // rules in settings table
      upsertSetting(db, 'block_outside_hours', p.rules.block_outside_hours ? 'true' : 'false');
      upsertSetting(db, 'closed_message', p.rules.closed_message || '');
      upsertSetting(db, 'sync_integrations', p.rules.sync_integrations ? 'true' : 'false');
      upsertSetting(db, 'hours_mode', p.rules.mode || 'manual');

      db.prepare(
        `INSERT INTO store_hours_audit (actor, source, reason, payload_json)
         VALUES (?, 'panel', ?, ?)`,
      ).run(null, p.reason || 'Atualização de horário', JSON.stringify(p));
    })();

    const cfg = getHoursConfig(db);
    const statusNow = getStoreOpenStatusNow(db, new Date());
    res.json({ ok: true, ...cfg, statusNow });
  });

  r.patch('/', (req, res) => {
    const parsed = SettingsPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));

    db.transaction(() => {
      for (const [k, v] of Object.entries(parsed.data)) {
        if (v === undefined) continue;
        upsertSetting(db, k, v);
      }
    })();

    res.json({ ok: true, settings: readAllSettings(db) });
  });

  registerDeliveryZoneRoutes(r, db);

  return r;
}

