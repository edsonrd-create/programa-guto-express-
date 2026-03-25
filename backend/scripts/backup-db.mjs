/**
 * Cópia de segurança do SQLite (database.sqlite) para backend/data/backups/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const dbFile = path.join(backendRoot, 'database.sqlite');
const backupDir = path.join(backendRoot, 'data', 'backups');

if (!fs.existsSync(dbFile)) {
  console.error('Arquivo nao encontrado:', dbFile);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupDir, `database-${stamp}.sqlite`);
fs.copyFileSync(dbFile, dest);
console.log('Backup OK:', dest);
