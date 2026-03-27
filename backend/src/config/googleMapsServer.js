/**
 * Chave Google usada no servidor (Routes API v2 + Geocoding).
 * Ordem: GOOGLE_MAPS_API_KEY → GOOGLE_MAPS_SERVER_KEY → VITE_GOOGLE_MAPS_API_KEY
 * (útil quando só frontend/.env está preenchido após loadEnv.js carregar ambos).
 */
export function getGoogleMapsServerKey() {
  return (
    (process.env.GOOGLE_MAPS_API_KEY || '').trim() ||
    (process.env.GOOGLE_MAPS_SERVER_KEY || '').trim() ||
    (process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
  );
}

export function isGoogleMapsServerConfigured() {
  return Boolean(getGoogleMapsServerKey());
}
