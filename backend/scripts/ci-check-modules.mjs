/**
 * CI: syntax-check de módulos críticos (além de server.js em test:smoke).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const files = [
  'scripts/smoke-http.mjs',
  'src/lib/corsConfig.js',
  'src/lib/globalRateLimit.js',
  'src/modules/integrations/routes.js',
  'src/modules/integrations/webhookPipeline.js',
  'src/modules/integrations/webhookSignature.js',
  'src/modules/integrations/processor.js',
  'src/modules/integrations/normalizer.js',
  'src/modules/integrations/sync/outbox.js',
  'src/modules/integrations/sync/deliver.js',
  'src/modules/integrations/sync/channelAdapters.js',
  'src/modules/integrations/sync/worker.js',
  'src/modules/orders/routes.js',
  'src/modules/customers/routes.js',
  'src/sockets/opsSocket.js',
  'src/validation/httpSchemas.js',
  'src/modules/settings/runtimeSettings.js',
  'src/modules/settings/hoursEnforcer.js',
  'src/modules/settings/deliveryZonesCore.js',
  'src/modules/settings/deliveryZoneRoutes.js',
  'src/modules/ops/snapshotBuilder.js',
];

let failed = false;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
