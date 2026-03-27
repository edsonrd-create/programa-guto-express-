import { z } from 'zod';
import { validationErrorResponse } from '../../validation/httpSchemas.js';
import {
  computeZonesSummary,
  findAnyDeliveryZoneByKey,
  normalizeZoneKey,
  rowToZoneDto,
  suggestZoneAdjustment,
  writeZoneAudit,
} from './deliveryZonesCore.js';

const PriorityZ = z.enum(['high', 'medium', 'low']);
const ModeZ = z.enum(['manual', 'ia']);

const ZoneCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    delivery_fee: z.coerce.number().finite().min(0),
    avg_minutes: z.coerce.number().int().min(5).max(240),
    min_order_amount: z.coerce.number().finite().min(0),
    active: z.coerce.boolean(),
    priority: PriorityZ,
    notes: z.string().max(1000).optional().default(''),
    mode: ModeZ,
    reason: z.string().max(240).optional().default(''),
  })
  .strict();

const ZonePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    delivery_fee: z.coerce.number().finite().min(0).optional(),
    avg_minutes: z.coerce.number().int().min(5).max(240).optional(),
    min_order_amount: z.coerce.number().finite().min(0).optional(),
    active: z.coerce.boolean().optional(),
    priority: PriorityZ.optional(),
    notes: z.string().max(1000).optional(),
    mode: ModeZ.optional(),
    reason: z.string().max(240).optional().default(''),
  })
  .strict();

const BulkSchema = z
  .object({
    active_only: z.coerce.boolean().optional().default(true),
    add_delivery_fee: z.coerce.number().finite().optional(),
    multiply_delivery_fee: z.coerce.number().finite().positive().optional(),
    set_delivery_fee: z.coerce.number().finite().min(0).optional(),
    set_avg_minutes: z.coerce.number().int().min(5).max(240).optional(),
    reason: z.string().max(500).optional().default('Alteração em massa'),
  })
  .strict()
  .refine(
    (o) =>
      o.add_delivery_fee != null ||
      o.multiply_delivery_fee != null ||
      o.set_delivery_fee != null ||
      o.set_avg_minutes != null,
    { message: 'Informe add_delivery_fee, multiply_delivery_fee, set_delivery_fee ou set_avg_minutes' },
  );

function filterZones(rows, { q, status, mode, priority }) {
  let out = rows.map(rowToZoneDto);
  const qq = (q || '').trim().toLowerCase();
  if (qq) out = out.filter((r) => r.name.toLowerCase().includes(qq) || r.name_key.includes(qq));
  if (status === 'active') out = out.filter((r) => r.active);
  if (status === 'inactive') out = out.filter((r) => !r.active);
  if (mode === 'manual') out = out.filter((r) => r.mode === 'manual');
  if (mode === 'ia') out = out.filter((r) => r.mode === 'ia');
  if (priority && ['high', 'medium', 'low'].includes(priority)) out = out.filter((r) => r.priority === priority);
  return out;
}

/**
 * @param {import('express').Router} r
 * @param {import('better-sqlite3').Database} db
 */
export function registerDeliveryZoneRoutes(r, db) {
  r.get('/delivery-zones', (req, res) => {
    const rows = db.prepare(`SELECT * FROM delivery_zones ORDER BY name COLLATE NOCASE ASC`).all();
    const q = req.query.q;
    const status = req.query.status;
    const mode = req.query.mode;
    const priority = req.query.priority;
    const zones = filterZones(rows, { q, status, mode, priority });
    const summary = computeZonesSummary(db);
    res.json({ ok: true, zones, summary });
  });

  r.get('/delivery-zones/export', (_req, res) => {
    const rows = db.prepare(`SELECT * FROM delivery_zones ORDER BY id ASC`).all();
    res.json({ ok: true, exportedAt: new Date().toISOString(), zones: rows.map(rowToZoneDto) });
  });

  r.post('/delivery-zones', (req, res) => {
    const parsed = ZoneCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));
    const p = parsed.data;
    const name_key = normalizeZoneKey(p.name);
    if (!name_key) return res.status(400).json({ ok: false, message: 'Nome invalido' });
    let id;
    try {
      const ins = db
        .prepare(
          `INSERT INTO delivery_zones (name, name_key, delivery_fee, avg_minutes, min_order_amount, active, priority, notes, mode, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        )
        .run(
          p.name.trim(),
          name_key,
          p.delivery_fee,
          p.avg_minutes,
          p.min_order_amount,
          p.active ? 1 : 0,
          p.priority,
          p.notes ?? '',
          p.mode,
        );
      id = ins.lastInsertRowid;
    } catch (e) {
      if (String(e?.message || e).includes('UNIQUE')) {
        return res.status(409).json({ ok: false, message: 'Ja existe bairro com o mesmo nome (normalizado)' });
      }
      throw e;
    }
    writeZoneAudit(db, id, { action: 'create', ...p }, p.reason || 'Criar zona');
    const row = db.prepare(`SELECT * FROM delivery_zones WHERE id = ?`).get(id);
    res.status(201).json({ ok: true, zone: rowToZoneDto(row) });
  });

  r.patch('/delivery-zones/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, message: 'id invalido' });
    const parsed = ZonePatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));
    const row = db.prepare(`SELECT * FROM delivery_zones WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ ok: false, message: 'Zona nao encontrada' });
    const p = parsed.data;
    const cur = rowToZoneDto(row);
    const name = p.name != null ? p.name.trim() : row.name;
    const name_key = p.name != null ? normalizeZoneKey(p.name) : row.name_key;
    if (p.name != null && !name_key) return res.status(400).json({ ok: false, message: 'Nome invalido' });
    const nextFee = p.delivery_fee !== undefined ? p.delivery_fee : cur.delivery_fee;
    const nextMins = p.avg_minutes !== undefined ? p.avg_minutes : cur.avg_minutes;
    const nextMinOrder = p.min_order_amount !== undefined ? p.min_order_amount : cur.min_order_amount;
    const nextActive = p.active !== undefined ? p.active : cur.active;
    const nextPriority = p.priority !== undefined ? p.priority : cur.priority;
    const nextNotes = p.notes !== undefined ? p.notes : cur.notes;
    const nextMode = p.mode !== undefined ? p.mode : cur.mode;

    try {
      db.prepare(
        `UPDATE delivery_zones SET
            name = ?,
            name_key = ?,
            delivery_fee = ?,
            avg_minutes = ?,
            min_order_amount = ?,
            active = ?,
            priority = ?,
            notes = ?,
            mode = ?,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).run(
        name,
        name_key,
        nextFee,
        nextMins,
        nextMinOrder,
        nextActive ? 1 : 0,
        nextPriority,
        nextNotes ?? '',
        nextMode,
        id,
      );
    } catch (e) {
      if (String(e?.message || e).includes('UNIQUE')) {
        return res.status(409).json({ ok: false, message: 'Conflito de nome com outra zona' });
      }
      throw e;
    }

    writeZoneAudit(
      db,
      id,
      {
        action: 'patch',
        before: cur,
        after: {
          ...cur,
          name,
          name_key,
          delivery_fee: nextFee,
          avg_minutes: nextMins,
          min_order_amount: nextMinOrder,
          active: nextActive,
          priority: nextPriority,
          notes: nextNotes,
          mode: nextMode,
        },
      },
      p.reason || 'Atualizar zona',
    );
    const updated = db.prepare(`SELECT * FROM delivery_zones WHERE id = ?`).get(id);
    res.json({ ok: true, zone: rowToZoneDto(updated) });
  });

  r.get('/delivery-zones/:id/history', (req, res) => {
    const id = Number(req.params.id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 200);
    if (!db.prepare(`SELECT id FROM delivery_zones WHERE id = ?`).get(id)) {
      return res.status(404).json({ ok: false, message: 'Zona nao encontrada' });
    }
    const rows = db
      .prepare(`SELECT * FROM delivery_zone_audit WHERE zone_id = ? ORDER BY id DESC LIMIT ?`)
      .all(id, limit);
    res.json({ ok: true, history: rows });
  });

  r.get('/delivery-zones/:id/ai-suggestion', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT * FROM delivery_zones WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ ok: false, message: 'Zona nao encontrada' });
    res.json({ ok: true, suggestion: suggestZoneAdjustment(row) });
  });

  r.post('/delivery-zones/bulk', (req, res) => {
    const parsed = BulkSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json(validationErrorResponse(parsed.error));
    const b = parsed.data;
    const all = db.prepare(`SELECT * FROM delivery_zones`).all();
    const targets = b.active_only ? all.filter((z) => Number(z.active) === 1) : all;
    const changed = [];

    db.transaction(() => {
      for (const z of targets) {
        let fee = Number(z.delivery_fee);
        let mins = Number(z.avg_minutes);
        if (b.set_delivery_fee != null) fee = b.set_delivery_fee;
        else {
          if (b.add_delivery_fee != null) fee += b.add_delivery_fee;
          if (b.multiply_delivery_fee != null) fee = Math.round(fee * b.multiply_delivery_fee * 100) / 100;
        }
        if (fee < 0) fee = 0;
        if (b.set_avg_minutes != null) mins = b.set_avg_minutes;

        db.prepare(
          `UPDATE delivery_zones SET delivery_fee = ?, avg_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).run(fee, mins, z.id);
        writeZoneAudit(
          db,
          z.id,
          { action: 'bulk', before: rowToZoneDto(z), after: { delivery_fee: fee, avg_minutes: mins }, bulk: b },
          b.reason,
        );
        changed.push(z.id);
      }
    })();

    res.json({ ok: true, affectedIds: changed, count: changed.length });
  });
}
