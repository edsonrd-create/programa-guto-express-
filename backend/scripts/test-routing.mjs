/**
 * Testa /routing/* no backend em execução (use PORT se não for 3210).
 */
const PORT = Number(process.env.PORT || 3210);
const base = `http://127.0.0.1:${PORT}`;

async function main() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) {
    console.error(`Falha: backend não responde em ${base}/health (suba com: npm run dev na pasta backend)`);
    process.exit(1);
  }

  const cfgRes = await fetch(`${base}/routing/config`);
  if (!cfgRes.ok) {
    const t = await cfgRes.text();
    console.error(`GET /routing/config → ${cfgRes.status}`, t.slice(0, 200));
    process.exit(1);
  }
  const cfg = await cfgRes.json();
  console.log('OK config.store:', cfg.store?.label, cfg.store?.lat, cfg.store?.lng);

  const cls = await fetch(`${base}/routing/classify?lat=-25.38&lng=-49.177`);
  const clsJson = await cls.json();
  if (!cls.ok) {
    console.error('classify falhou', clsJson);
    process.exit(1);
  }
  console.log('OK classify (sul):', clsJson.direction, clsJson.bearingDeg, 'km', clsJson.distanceFromStoreKm);

  const planRes = await fetch(`${base}/routing/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clusterKm: 2, maxOrdersPerRoute: 4 }),
  });
  if (!planRes.ok) {
    const t = await planRes.text();
    console.error(`POST /routing/plan → ${planRes.status}`, t.slice(0, 300));
    process.exit(1);
  }
  const plan = await planRes.json();
  console.log('OK plan: rotas=', plan.routes?.length ?? 0, 'ignorados=', plan.skippedOrders?.length ?? 0);
  for (const r of plan.routes || []) {
    const det = r.detourOk ? 'detourOK' : 'detour!';
    console.log(`  ${r.id} ${r.direction} pedidos=${r.deliveryOrder?.length} km=${r.estimatedTotalKm} ${det} score=${r.efficiencyScore}`);
  }
  console.log('Teste de roteirização concluído.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
