/**
 * Converte SemVer para formato aceite pelo NuGet / Squirrel (alinhado a convertVersion do electron-winstaller).
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

export function toNuGetVersion(version) {
  if (version == null || String(version).trim() === '') return '0.0.0';
  const noBuild = String(version).split('+')[0].trim();
  const parts = noBuild.split('-');
  const mainVersion = parts.shift();
  if (mainVersion == null || mainVersion === '') return '0.0.0';
  if (parts.length > 0) {
    return [mainVersion, parts.join('-').replace(/\./g, '')].join('-');
  }
  return mainVersion;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

export function readPreferredAppVersion() {
  const candidates = ['backend/package.json', 'frontend/package.json', 'package.json'];
  for (const rel of candidates) {
    const p = path.join(root, rel);
    if (!existsSync(p)) continue;
    try {
      const v = JSON.parse(readFileSync(p, 'utf8')).version;
      if (v != null && String(v).trim() !== '') return String(v).trim();
    } catch {
      /* ignore */
    }
  }
  return '0.0.0';
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    console.log(`Uso:
  node scripts/nuget-version.mjs           → versão NuGet (backend → frontend → raiz)
  node scripts/nuget-version.mjs <semver>  → converte uma string`);
    process.exit(0);
  }
  const out = arg ? toNuGetVersion(arg) : toNuGetVersion(readPreferredAppVersion());
  console.log(out);
}
