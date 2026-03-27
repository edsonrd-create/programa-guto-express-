import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(backendRoot, '.env') });
/** Mesma chave do mapa no painel: preenche só variáveis ainda não definidas no backend. */
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env'), override: false });
