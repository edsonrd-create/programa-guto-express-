import React from 'react';
import { getMapsBrowserApiKey, MAPS_BROWSER_KEY_EVENT } from '../lib/mapsBrowserKeyStorage.js';

/** Re-renderiza quando a chave do mapa muda (Configurações ou outra aba). */
export function useMapsBrowserKey() {
  const [key, setKey] = React.useState(getMapsBrowserApiKey);
  React.useEffect(() => {
    const fn = () => setKey(getMapsBrowserApiKey());
    window.addEventListener(MAPS_BROWSER_KEY_EVENT, fn);
    return () => window.removeEventListener(MAPS_BROWSER_KEY_EVENT, fn);
  }, []);
  return key;
}
