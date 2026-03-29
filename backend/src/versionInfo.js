import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Versão do `package.json` do backend (lida uma vez). */
export function getBackendVersion() {
  try {
    const p = path.join(__dirname, '..', 'package.json');
    const v = JSON.parse(readFileSync(p, 'utf8')).version;
    return typeof v === 'string' && v.trim() ? v.trim() : '0.0.0';
  } catch {
    return '0.0.0';
  }
}
