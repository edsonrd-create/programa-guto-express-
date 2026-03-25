const R_KM = 6371;

/** Graus → radianos */
function toRad(d) {
  return (d * Math.PI) / 180;
}

/**
 * Distância em km (fórmula de Haversine).
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R_KM * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Azimute da origem até o destino, 0° = Norte, 90° = Leste (sentido horário desde o Norte).
 */
export function bearingDeg(latFrom, lngFrom, latTo, lngTo) {
  const φ1 = toRad(latFrom);
  const φ2 = toRad(latTo);
  const Δλ = toRad(lngTo - lngFrom);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = (Math.atan2(y, x) * 180) / Math.PI;
  return (θ + 360) % 360;
}

/**
 * NORTE 315°–45° | LESTE 45°–135° | SUL 135°–225° | OESTE 225°–315°
 */
export function classifyDirection(bearing) {
  const b = ((bearing % 360) + 360) % 360;
  if (b >= 315 || b < 45) return 'NORTE';
  if (b >= 45 && b < 135) return 'LESTE';
  if (b >= 135 && b < 225) return 'SUL';
  return 'OESTE';
}

export function pointKey(lat, lng) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}
