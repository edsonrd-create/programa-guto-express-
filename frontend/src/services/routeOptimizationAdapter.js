/**
 * Ponte para otimizadores externos (Google Route Optimization API, Mapbox, OR-Tools como serviço).
 * O painel já usa POST /routing/plan (heurística + opcional Google Routes no backend).
 *
 * @param {object} input
 * @param {{ lat: number, lng: number, label?: string }} input.store
 * @param {Array<{ orderId: number, lat: number, lng: number, neighborhood?: string|null }>} input.stops
 * @param {Array<{ id: number, name?: string }>} input.vehicles
 * @param {Record<string, unknown>} [input.constraints]
 * @returns {Promise<{ provider: string, requestBody: object, note: string }>}
 */
export async function buildExternalOptimizationPayload(input) {
  return {
    provider: 'pending_integration',
    note:
      'Monte aqui o JSON exigido pela API escolhida (ex. optimizeTours do Google). Entrada já normalizada em requestBody.',
    requestBody: {
      origin: input.store,
      shipments: (input.stops || []).map((s) => ({
        orderId: s.orderId,
        location: { lat: s.lat, lng: s.lng },
        neighborhood: s.neighborhood ?? null,
      })),
      vehicles: input.vehicles || [],
      constraints: input.constraints || {},
    },
  };
}
