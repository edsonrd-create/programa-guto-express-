/**
 * Geometria do mapa de rota: polyline codificada (mesmo formato do Google) e fallback loja → paradas → loja.
 */

export function validStopsList(stops) {
  return (stops || []).filter((s) => {
    const la = Number(s.lat);
    const ln = Number(s.lng);
    return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
  });
}

/** Decodifica polyline no formato Encoded Polyline Algorithm Format (Google). */
export function decodeEncodedPolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const path = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;
  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    path.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return path;
}

export function buildFallbackPath(store, stops) {
  if (!store || store.lat == null || store.lng == null) return [];
  const o = { lat: Number(store.lat), lng: Number(store.lng) };
  if (!Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return [];
  const middle = validStopsList(stops).map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }));
  if (!middle.length) return [];
  return [o, ...middle, o];
}

/**
 * Pontos do trajeto: polyline do servidor (Routes API) ou linha quebrada loja → paradas → loja.
 * @returns {{ points: Array<{lat:number,lng:number}>, source: 'google'|'fallback'|'empty' }}
 */
export function getRoutePathPoints(store, stops, encodedPolyline) {
  const clean = validStopsList(stops);
  if (encodedPolyline && String(encodedPolyline).trim().length > 0) {
    try {
      const pts = decodeEncodedPolyline(String(encodedPolyline).trim());
      if (pts.length > 1) return { points: pts, source: 'google' };
    } catch {
      /* fallback abaixo */
    }
  }
  const fb = buildFallbackPath(store, clean);
  if (fb.length > 1) return { points: fb, source: 'fallback' };
  return { points: [], source: 'empty' };
}
