import React from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { initGoogleMapsAppCheck, isGoogleMapsAppCheckEnabled } from '../../../lib/initGoogleMapsAppCheck.js';

/** Referência estável — array novo a cada render quebra o useJsApiLoader e o mapa não inicializa. */
const MAP_LIBRARIES = Object.freeze(['geometry']);

const mapStyle = (h) => ({ width: '100%', height: h, minHeight: h, borderRadius: 12 });

const defaultMapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

function validStopsList(stops) {
  return (stops || []).filter((s) => {
    const la = Number(s.lat);
    const ln = Number(s.lng);
    return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
  });
}

function buildFallbackPath(store, stops) {
  if (!store || store.lat == null || store.lng == null) return [];
  const o = { lat: Number(store.lat), lng: Number(store.lng) };
  if (!Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return [];
  const middle = validStopsList(stops).map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }));
  if (!middle.length) return [];
  return [o, ...middle, o];
}

function RoutingRouteMapInner({ apiKey, store, stops, encodedPolyline, height = 300 }) {
  const cleanStops = React.useMemo(() => validStopsList(stops), [stops]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'routing-google-map',
    googleMapsApiKey: apiKey,
    version: 'weekly',
    libraries: MAP_LIBRARIES,
  });

  const [path, setPath] = React.useState([]);

  React.useEffect(() => {
    if (!isLoaded || !window.google?.maps?.importLibrary) return;
    if (!isGoogleMapsAppCheckEnabled()) return;
    let alive = true;
    (async () => {
      try {
        await initGoogleMapsAppCheck();
      } catch (e) {
        if (alive) console.warn('[Maps App Check]', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isLoaded]);

  React.useEffect(() => {
    if (!isLoaded || !window.google?.maps?.geometry?.encoding) {
      if (isLoaded) setPath(buildFallbackPath(store, cleanStops));
      return;
    }
    if (encodedPolyline) {
      try {
        const decoded = window.google.maps.geometry.encoding.decodePath(encodedPolyline);
        setPath(decoded.map((ll) => ({ lat: ll.lat(), lng: ll.lng() })));
      } catch {
        setPath(buildFallbackPath(store, cleanStops));
      }
      return;
    }
    setPath(buildFallbackPath(store, cleanStops));
  }, [isLoaded, encodedPolyline, store, cleanStops]);

  if (loadError) {
    const msg = String(loadError.message || loadError);
    const refererBlocked =
      /RefererNotAllowed|referer.*not allowed/i.test(msg) || msg.includes('RefererNotAllowedMapError');
    return (
      <div className="err" style={{ lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Mapa: {msg}</div>
        {refererBlocked && (
          <div style={{ fontSize: 13, color: '#cbd5e1' }}>
            No Google Cloud Console, abra a chave usada no painel → <strong>Restrições de aplicativo</strong> →{' '}
            <strong>Sites</strong> e inclua exatamente:{' '}
            <code style={{ color: '#93c5fd' }}>{typeof window !== 'undefined' ? `${window.location.origin}/*` : 'http://localhost:5173/*'}</code>
            <br />
            Aguarde alguns minutos após salvar e recarregue a página.
          </div>
        )}
      </div>
    );
  }

  /** Novo objeto a cada render quebra o GoogleMap/Polyline (MVCArray / setAt). */
  const stop0Lat = cleanStops[0] != null ? Number(cleanStops[0].lat) : null;
  const stop0Lng = cleanStops[0] != null ? Number(cleanStops[0].lng) : null;
  const mapCenter = React.useMemo(() => {
    if (store && store.lat != null && store.lng != null) {
      const la = Number(store.lat);
      const ln = Number(store.lng);
      if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
    }
    if (stop0Lat != null && stop0Lng != null && Number.isFinite(stop0Lat) && Number.isFinite(stop0Lng)) {
      return { lat: stop0Lat, lng: stop0Lng };
    }
    return { lat: -25.3648956, lng: -49.1771888 };
  }, [store?.lat, store?.lng, stop0Lat, stop0Lng]);

  /** Remonta o Polyline quando o trajeto muda — evita bug do wrapper (.setAt em path interno undefined). */
  const polylineMountKey = React.useMemo(() => {
    if (!path.length) return 'empty';
    const a = path[0];
    const b = path[path.length - 1];
    const encFrag = encodedPolyline ? String(encodedPolyline).slice(0, 120) : '';
    return `${path.length}|${a.lat},${a.lng}|${b.lat},${b.lng}|${encFrag}`;
  }, [path, encodedPolyline]);

  return (
    <div style={{ marginTop: 12 }}>
      {!isLoaded ? (
        <div
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            borderRadius: 12,
            color: '#64748b',
            fontSize: 14,
          }}
        >
          Carregando mapa…
        </div>
      ) : (
        <GoogleMap mapContainerStyle={mapStyle(height)} center={mapCenter} zoom={13} options={defaultMapOptions}>
          {path.length > 1 && (
            <Polyline
              key={polylineMountKey}
              path={path}
              options={{
                strokeColor: '#60a5fa',
                strokeOpacity: 0.92,
                strokeWeight: 4,
              }}
            />
          )}
          {store && store.lat != null && store.lng != null && Number.isFinite(Number(store.lat)) && Number.isFinite(Number(store.lng)) && (
            <Marker position={{ lat: Number(store.lat), lng: Number(store.lng) }} title={store?.label || 'Loja'} />
          )}
          {cleanStops.map((s) => (
            <Marker key={s.orderId} position={{ lat: Number(s.lat), lng: Number(s.lng) }} title={`#${s.orderId}`} />
          ))}
        </GoogleMap>
      )}
      {encodedPolyline ? (
        <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Trajeto: Routes API (estrada)</div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Trajeto: linha aproximada (sem polyline)</div>
      )}
    </div>
  );
}

/**
 * Mapa da rota (polyline Google ou linha reta loja → paradas → loja).
 */
export function RoutingRouteMap({ apiKey, store, stops, encodedPolyline, height = 300 }) {
  const key = (apiKey || '').trim();
  if (!key) {
    return (
      <div
        style={{
          padding: 14,
          color: '#94a3b8',
          fontSize: 13,
          background: '#0f172a',
          borderRadius: 12,
          minHeight: height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div>
          Para o mapa no painel, vá em <b style={{ color: '#e2e8f0' }}>Configurações</b> e cole a chave (Maps
          JavaScript API), ou defina <code style={{ color: '#cbd5e1' }}>VITE_GOOGLE_MAPS_API_KEY</code> no build.
        </div>
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
          Modo fallback: use o painel de rotas à direita e “Otimizar agora” com o motor interno + Google Routes no
          servidor (POST /routing/plan).
        </div>
      </div>
    );
  }

  return (
    <RoutingRouteMapInner
      key={key || 'no-key'}
      apiKey={key}
      store={store}
      stops={stops}
      encodedPolyline={encodedPolyline}
      height={height}
    />
  );
}
