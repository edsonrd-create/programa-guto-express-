/**
 * Recria os cadastros padrão de integração (canais) se ainda não existirem.
 * Não apaga dados existentes. Rode após trocar de pasta ou perder o database.sqlite.
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

const defaults = [
  { name: 'iFood', channel: 'ifood' },
  { name: 'Neemo', channel: 'neemo' },
  { name: 'Expresso Delivery', channel: 'expresso_delivery' },
  { name: '99food', channel: '99food' },
];

let inserted = 0;
for (const row of defaults) {
  const exists = db.prepare('SELECT id FROM integrations WHERE channel = ?').get(row.channel);
  if (exists) continue;
  db.prepare(
    'INSERT INTO integrations (name, channel, token, webhook_secret, active, auto_accept) VALUES (?, ?, NULL, NULL, 0, 1)',
  ).run(row.name, row.channel);
  inserted += 1;
  console.log(`+ canal criado: ${row.channel} (${row.name})`);
}

console.log(inserted ? `Concluído: ${inserted} canal(is) novo(s).` : 'Nada a fazer: todos os canais já existem.');
db.close();
