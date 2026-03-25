export function decideAutopilotActions({ orders = [], queue = [], settings = { enabled: false, allowAutoAssign: false, allowAutoDispatch: false } }) {
  const actions = [];
  const readyOrders = orders.filter((o) => o.status === 'pronto');
  if (!settings.enabled) return { mode: 'manual', actions: [], message: 'Piloto automático desativado. Operação segue manual.' };
  if (settings.allowAutoAssign && readyOrders.length > 0 && queue.length > 0) {
    actions.push({ type: 'assign_next_driver', orderId: readyOrders[0].id, driverId: queue[0].driver_id, reason: 'Pedido pronto e motoboy disponível na fila FIFO.' });
  }
  if (settings.allowAutoDispatch && readyOrders.length > 2 && queue.length > 0) {
    actions.push({ type: 'suggest_batch_dispatch', reason: 'Há vários pedidos prontos. Avaliar saída em lote por bairro.' });
  }
  return { mode: 'assisted', actions, message: actions.length ? 'Piloto automático gerou sugestões e ações permitidas.' : 'Nenhuma ação automática necessária no momento.' };
}
