/**
 * @typedef {'manual' | 'ia' | 'ia_approval'} RoutingUiMode
 * @typedef {'high' | 'medium' | 'low'} SlaPriority
 * @typedef {'internal' | 'google_mapbox_ready'} RouteProviderHint
 *
 * @typedef {object} RoutingRulesState
 * @property {number} groupingWindowMin
 * @property {number} maxPerCourier
 * @property {SlaPriority} slaPriority
 * @property {RoutingUiMode} mode
 * @property {number} maxRadiusKm
 * @property {number} capacityPerRoute
 * @property {boolean} delayBlock
 * @property {RouteProviderHint} provider
 * @property {boolean} skipGoogleRoutes
 *
 * @typedef {object} PlanStop
 * @property {number} orderId
 * @property {number} lat
 * @property {number} lng
 * @property {string|null} neighborhood
 * @property {string|null} address
 *
 * @typedef {object} PlannedRoute
 * @property {string} id
 * @property {string} direction
 * @property {number[]} deliveryOrder
 * @property {PlanStop[]} stops
 * @property {number} estimatedTotalKm
 * @property {number} estimatedTotalMinutes
 * @property {object} [suggestedDriver]
 * @property {object} [google]
 */

export {};
