/**
 * Chave da Maps JavaScript API no navegador: prioridade localStorage > VITE_GOOGLE_MAPS_API_KEY.
 * Não envia a chave ao servidor; fica só no dispositivo.
 */

const LS_KEY = 'guto_maps_browser_api_key_v1';

export const MAPS_BROWSER_KEY_EVENT = 'guto-maps-key-updated';

export function getMapsBrowserApiKey() {
  try {
    const fromLs = (localStorage.getItem(LS_KEY) || '').trim();
    if (fromLs) return fromLs;
  } catch {
    /* */
  }
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

/** Persiste ou remove a chave no navegador e notifica ouvintes (mapas em outras telas). */
export function setMapsBrowserApiKey(value) {
  const v = String(value ?? '').trim();
  try {
    if (v) localStorage.setItem(LS_KEY, v);
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MAPS_BROWSER_KEY_EVENT));
  }
}
