import Database from 'better-sqlite3';

export const db = new Database('database.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  total_amount REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'disponivel',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS driver_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL,
  entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  driver_id INTEGER,
  status TEXT NOT NULL DEFAULT 'aguardando_motoboy',
  assigned_at TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  token TEXT,
  webhook_secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  auto_accept INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration_orders_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id INTEGER,
  external_order_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'recebido',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(integration_id, external_order_id)
);

CREATE TABLE IF NOT EXISTS integration_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id INTEGER,
  external_order_id TEXT,
  event TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_raw_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (integration_raw_id) REFERENCES integration_orders_raw(id)
);

CREATE TABLE IF NOT EXISTS kds_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
`);

// Configurações persistentes (staging/prod) — sem segredos por padrão.
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Horário de funcionamento (operações)
db.exec(`
CREATE TABLE IF NOT EXISTS store_week_hours (
  iso_dow INTEGER NOT NULL PRIMARY KEY, -- 1=Mon ... 7=Sun
  active INTEGER NOT NULL DEFAULT 0,
  open_time TEXT,  -- HH:MM
  close_time TEXT, -- HH:MM (pode passar da meia-noite)
  break_label TEXT
);

CREATE TABLE IF NOT EXISTS store_date_exceptions (
  date TEXT NOT NULL PRIMARY KEY, -- YYYY-MM-DD
  mode TEXT NOT NULL DEFAULT 'open', -- open|closed
  open_time TEXT,
  close_time TEXT,
  break_label TEXT,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_holidays (
  date TEXT NOT NULL PRIMARY KEY, -- YYYY-MM-DD
  name TEXT,
  mode TEXT NOT NULL DEFAULT 'closed', -- closed|open
  open_time TEXT,
  close_time TEXT,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_hours_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  source TEXT NOT NULL DEFAULT 'panel',
  reason TEXT,
  payload_json TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Campos adicionais esperados pelo painel (roteirizacao / destino)
function hasColumn(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === column);
}

function addColumnIfMissing(table, column, ddl) {
  if (hasColumn(table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
}

addColumnIfMissing('orders', 'delivery_lat', 'delivery_lat REAL');
addColumnIfMissing('orders', 'delivery_lng', 'delivery_lng REAL');
addColumnIfMissing('orders', 'delivery_neighborhood', 'delivery_neighborhood TEXT');
addColumnIfMissing('orders', 'delivery_address', 'delivery_address TEXT');

// Fila persistente para webhooks (modo assíncrono)
db.exec(`
CREATE TABLE IF NOT EXISTS integration_webhook_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  integration_id INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  FOREIGN KEY (integration_id) REFERENCES integrations(id)
);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_jobs_pending
  ON integration_webhook_jobs (status, id);
`);

/** Outbox: sincronização assíncrona com parceiros (ex.: aviso de loja fechada após bloqueio por horário). */
db.exec(`
CREATE TABLE IF NOT EXISTS integration_partner_sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  FOREIGN KEY (integration_id) REFERENCES integrations(id)
);
CREATE INDEX IF NOT EXISTS idx_integration_partner_sync_pending
  ON integration_partner_sync_jobs (status, id);
`);

addColumnIfMissing('integration_partner_sync_jobs', 'processing_since', 'processing_since TEXT');

/** Taxa / prazo por bairro (delivery zones). */
db.exec(`
CREATE TABLE IF NOT EXISTS delivery_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  delivery_fee REAL NOT NULL DEFAULT 0,
  avg_minutes INTEGER NOT NULL DEFAULT 45,
  min_order_amount REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active_key ON delivery_zones (active, name_key);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS delivery_zone_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id INTEGER NOT NULL,
  actor TEXT,
  source TEXT NOT NULL DEFAULT 'panel',
  reason TEXT,
  payload_json TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (zone_id) REFERENCES delivery_zones(id)
);
`);

addColumnIfMissing('orders', 'estimated_delivery_minutes', 'estimated_delivery_minutes INTEGER');
addColumnIfMissing('orders', 'delivery_zone_id', 'delivery_zone_id INTEGER');
addColumnIfMissing('orders', 'kds_extras_json', 'kds_extras_json TEXT');
addColumnIfMissing('order_items', 'meta_json', 'meta_json TEXT');
addColumnIfMissing('clients', 'email', 'email TEXT');

addColumnIfMissing('drivers', 'last_lat', 'last_lat REAL');
addColumnIfMissing('drivers', 'last_lng', 'last_lng REAL');
addColumnIfMissing('drivers', 'location_updated_at', 'location_updated_at TEXT');

/** Itens de cardápio (listagem para atendimento / pedidos). */
db.exec(`
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit_price REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_menu_items_active_sort ON menu_items (active, sort_order, id);
`);
