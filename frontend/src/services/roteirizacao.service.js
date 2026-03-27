import { dispatchService } from './dispatch.service.js';
import { driversService } from './drivers.service.js';
import { apiGet } from './apiClient.js';
import { routingService } from './routing.service.js';

export const roteirizacaoService = {
  getRoutingConfig: () => routingService.getConfig(),
  plan: (body) => routingService.plan(body),
  listOrdersWithClients: () => apiGet('/orders'),
  listDeliveries: () => dispatchService.listDeliveries(),
  listDispatchOrders: () => dispatchService.listDispatchOrders(),
  assignNext: (orderId) => dispatchService.assignNext(orderId),
  send: (orderId) => dispatchService.send(orderId),
  queue: () => driversService.queue(),
  listDrivers: () => driversService.list(),
};

/** @param {any} plan */
export function buildGroupingSuggestion(plan) {
  if (!plan?.routes?.length) return null;
  let best = null;
  for (const r of plan.routes) {
    const stops = r.stops || [];
    if (stops.length < 2) continue;
    const hoods = [...new Set(stops.map((s) => s.neighborhood).filter(Boolean))];
    if (hoods.length === 1) {
      const gain = stops.length >= 2 ? Math.round((stops.length - 1) * 4.5) : 0;
      if (!best || stops.length > best.stopCount) {
        best = {
          type: 'same_neighborhood',
          neighborhood: hoods[0],
          orderIds: stops.map((s) => s.orderId),
          routeId: r.id,
          estimatedMinutesSaved: gain,
          driverName: r.suggestedDriver?.name,
          rationale: `Vários pedidos no mesmo bairro (${hoods[0]}). Uma saída reduz espera na expedição e tende a cumprir SLA.`,
        };
      }
    }
  }
  if (best) return best;
  const top = [...plan.routes].sort((a, b) => (b.stops?.length || 0) - (a.stops?.length || 0))[0];
  if (top?.stops?.length >= 2) {
    return {
      type: 'cluster',
      routeId: top.id,
      orderIds: top.stops.map((s) => s.orderId),
      direction: top.direction,
      estimatedMinutesSaved: Math.min(15, Math.round(top.estimatedTotalMinutes * 0.15)),
      driverName: top.suggestedDriver?.name,
      rationale: `Rota ${top.id} agrupa ${top.stops.length} paradas no sentido ${top.direction}, conforme o motor interno.`,
    };
  }
  return null;
}
