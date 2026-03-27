/**
 * Maps JS + Places API (nova): carregamento único e App Check opcional.
 * Chave: localStorage (Configurações) ou VITE_GOOGLE_MAPS_API_KEY. Requer "Places API (New)" no GCP.
 */

import { initGoogleMapsAppCheck } from './initGoogleMapsAppCheck.js';
import { getMapsBrowserApiKey, MAPS_BROWSER_KEY_EVENT } from './mapsBrowserKeyStorage.js';

/** Mesmo id do useJsApiLoader em RoutingRouteMap.jsx para não duplicar o script. */
const MAPS_SCRIPT_ID = 'routing-google-map';
const MAP_LOADER_LIBS = Object.freeze(['geometry']);

let loadPromise = null;

if (typeof window !== 'undefined') {
  window.addEventListener(MAPS_BROWSER_KEY_EVENT, () => {
    loadPromise = null;
  });
}

export { getMapsBrowserApiKey };

/**
 * Garante o bootstrap do Maps (weekly) e retorna o módulo `places` (importLibrary).
 * Chama initGoogleMapsAppCheck() quando configurado (antes de chamadas Places).
 */
export async function ensurePlacesReady() {
  const key = getMapsBrowserApiKey();
  if (!key) {
    throw new Error('Configure a chave do mapa em Configurações (navegador) ou VITE_GOOGLE_MAPS_API_KEY.');
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      if (typeof window !== 'undefined' && window.google?.maps?.importLibrary) return;

      const { Loader } = await import('@googlemaps/js-api-loader');
      const loader = new Loader({
        apiKey: key,
        version: 'weekly',
        id: MAPS_SCRIPT_ID,
        libraries: MAP_LOADER_LIBS,
      });
      await loader.load();
    })();
  }

  await loadPromise;

  if (typeof window.google === 'undefined' || !window.google.maps?.importLibrary) {
    throw new Error('Falha ao carregar Google Maps.');
  }

  await initGoogleMapsAppCheck();
  return window.google.maps.importLibrary('places');
}

function pickNeighborhoodFromPlaceComponents(components) {
  if (!Array.isArray(components)) return null;
  const order = ['sublocality_level_1', 'neighborhood', 'sublocality', 'administrative_area_level_4'];
  for (const t of order) {
    const c = components.find((x) => Array.isArray(x.types) && x.types.includes(t));
    if (c) {
      const label = c.longText || c.long_name || c.shortText || c.short_name;
      if (label) return label;
    }
  }
  return null;
}

function readLatLng(loc) {
  if (!loc) return { lat: null, lng: null };
  if (typeof loc.lat === 'function' && typeof loc.lng === 'function') {
    return { lat: loc.lat(), lng: loc.lng() };
  }
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return { lat: loc.lat, lng: loc.lng };
  }
  return { lat: null, lng: null };
}

/** Loja padrão (Colombo/PR) — viés de busca; sobrescreva via env se necessário. */
function defaultLocationBias() {
  const lat = Number(import.meta.env.VITE_STORE_LAT ?? -25.36486);
  const lng = Number(import.meta.env.VITE_STORE_LNG ?? -49.17735);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { center: { lat, lng }, radius: 35000 };
}

/**
 * Busca textual (Places API nova). Retorna null se não houver resultados.
 * @param {string} textQuery
 */
export async function searchAddressByText(textQuery) {
  const q = String(textQuery || '').trim();
  if (q.length < 3) {
    throw new Error('Digite pelo menos 3 caracteres.');
  }

  const placesLib = await ensurePlacesReady();
  const Place = placesLib.Place;
  if (!Place || typeof Place.searchByText !== 'function') {
    throw new Error('Place.searchByText indisponível. Ative Places API (New) no Google Cloud.');
  }

  const bias = defaultLocationBias();
  const baseRequest = {
    textQuery: q,
    fields: ['location', 'formattedAddress', 'addressComponents', 'displayName'],
    maxResultCount: 6,
    region: 'br',
  };
  const request = bias ? { ...baseRequest, locationBias: bias } : baseRequest;

  let places;
  try {
    ({ places } = await Place.searchByText(request));
  } catch (e) {
    if (bias && request.locationBias) {
      ({ places } = await Place.searchByText(baseRequest));
    } else {
      throw e;
    }
  }
  if (!Array.isArray(places) || places.length === 0) return null;

  const p = places[0];
  const { lat, lng } = readLatLng(p.location);
  const formattedAddress = p.formattedAddress || p.displayName || null;
  const neighborhood = pickNeighborhoodFromPlaceComponents(p.addressComponents);

  return {
    lat,
    lng,
    formattedAddress,
    neighborhood,
    displayName: p.displayName || null,
  };
}
