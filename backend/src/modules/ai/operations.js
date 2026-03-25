export function buildAiOperationalInsights({ orders = [], deliveries = [], queue = [], drivers = [] }) {
  const alerts = [];
  const suggestions = [];
  const readyOrders = orders.filter((o) => o.status === 'pronto');
  const preparingOrders = orders.filter((o) => o.status === 'em_preparo');
  const activeDeliveries = deliveries.filter((d) => d.status === 'em_entrega');
  if (readyOrders.length > 0 && queue.length === 0) alerts.push({ type: 'dispatch_blocked', severity: 'high', message: 'Existem pedidos prontos sem motoboys na fila.' });
  if (readyOrders.length >= 3 && queue.length > 0) suggestions.push({ type: 'batch_dispatch', message: 'Considere organizar saídas por bairro.' });
  if (preparingOrders.length >= 8) alerts.push({ type: 'kds_pressure', severity: 'medium', message: 'A cozinha está com alta carga de preparo.' });
  if (activeDeliveries.length >= Math.max(1, Math.floor(drivers.length * 0.8))) alerts.push({ type: 'fleet_pressure', severity: 'medium', message: 'Grande parte dos motoboys está em rota.' });
  return { summary: { readyOrders: readyOrders.length, preparingOrders: preparingOrders.length, activeDeliveries: activeDeliveries.length, queueActive: queue.length }, alerts, suggestions };
}
