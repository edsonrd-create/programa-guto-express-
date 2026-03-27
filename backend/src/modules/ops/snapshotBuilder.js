import { buildAiOperationalInsights } from '../ai/operations.js';
import { getHoursConfig, getStoreOpenStatusNow } from '../settings/hours.js';
import { shouldBlockOrdersNow } from '../settings/hoursEnforcer.js';
import { countPartnerSyncJobsByStatus } from '../integrations/sync/outbox.js';

export function buildOperationalSnapshot(db) {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
  const deliveries = db.prepare('SELECT * FROM deliveries ORDER BY id DESC LIMIT 100').all();
  const queue = db
    .prepare(
      `SELECT dq.id,
              dq.entered_at,
              d.id driver_id,
              d.name,
              d.status
         FROM driver_queue dq
         JOIN drivers d ON d.id = dq.driver_id
        WHERE dq.active = 1
        ORDER BY dq.entered_at ASC`
    )
    .all();
  const drivers = db.prepare('SELECT * FROM drivers ORDER BY id DESC LIMIT 100').all();

  const kds = db
    .prepare(
      `SELECT o.*,
              (SELECT COALESCE(SUM(quantity),0) FROM order_items oi WHERE oi.order_id = o.id) total_items
         FROM orders o
        WHERE o.status IN ('novo','em_preparo','pronto')
        ORDER BY id ASC`
    )
    .all();

  const now = new Date();
  const statusNow = getStoreOpenStatusNow(db, now);
  const hoursCfg = getHoursConfig(db);
  const blockInfo = shouldBlockOrdersNow(db, now);

  return {
    orders,
    deliveries,
    driverQueue: queue,
    drivers,
    kds,
    store: {
      ...statusNow,
      rules: {
        block_outside_hours: hoursCfg.rules.block_outside_hours,
        mode: hoursCfg.rules.mode,
        sync_integrations: hoursCfg.rules.sync_integrations,
        orders_blocked_now: blockInfo.block,
      },
    },
    ai: buildAiOperationalInsights({ orders, deliveries, queue, drivers }),
    integrationOutbox: {
      partnerSyncJobs: countPartnerSyncJobsByStatus(db),
    },
    generatedAt: new Date().toISOString()
  };
}

