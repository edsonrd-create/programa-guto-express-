import React from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { initGoogleMapsAppCheck, isGoogleMapsAppCheckEnabled } from '../../../lib/initGoogleMapsAppCheck.js';
import OperationalRouteMapSvg from './OperationalRouteMapSvg.jsx';
import { getRoutePathPoints, validStopsList } from '../../../lib/routeMapGeometry.js';

/** Sem `geometry` — polyline é decodificada localmente (routeMapGeometry). */
const MAP_LIBRARIES = Object.freeze([]);

const mapStyle = (h) => ({ width: '100%', height: h, minHeight: h, borderRadius: 12 });

const defaultMapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

function RoutingRouteMapInner({ apiKey, store, stops, encodedPolyline, height = 300 }) {
  const cleanStops = React.useMemo(() => validStopsList(stops), [stops]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'routing-google-map',
    googleMapsApiKey: apiKey,
    version: 'weekly',
    libraries: MAP_LIBRARIES,
  });

  const routeGeom = React.useMemo(
    () => getRoutePathPoints(store, cleanStops, encodedPolyline),
    [store, cleanStops, encodedPolyline],
  );
  const path = routeGeom.points;
  const pathSource = routeGeom.source;

  React.useEffect(() => {
    if (!isLoaded || !window.google?.maps) return;
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

  if (loadError) {
    const msg = String(loadError.message || loadError);
    const refererBlocked =
      /RefererNotAllowed|referer.*not allowed/i.test(msg) || msg.includes('RefererNotAllowedMapError');
    return (
      <div>
        <div className="err" style={{ lineHeight: 1.5, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Mapa Google: {msg}</div>
          {refererBlocked && (
            <div style={{ fontSize: 13, color: '#cbd5e1' }}>
              No Google Cloud Console, abra a chave usada no painel → <strong>Restrições de aplicativo</strong> →{' '}
              <strong>Sites</strong> e inclua exatamente:{' '}
              <code style={{ color: '#93c5fd' }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/*` : 'http://localhost:5173/*'}
              </code>
              <br />
              Aguarde alguns minutos após salvar e recarregue a página.
            </div>
          )}
        </div>
        <OperationalRouteMapSvg store={store} stops={cleanStops} encodedPolyline={encodedPolyline} height={height} />
        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
          Acima: vista esquemática com hub, paradas e trajeto (polyline do servidor ou linha aproximada).
        </div>
      </div>
    );
  }

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
            <Marker
              key={String(s.orderId)}
              position={{ lat: Number(s.lat), lng: Number(s.lng) }}
              title={`#${s.orderId}`}
            />
          ))}
        </GoogleMap>
      )}
      {pathSource === 'google' ? (
        <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Trajeto: Routes API (estrada)</div>
      ) : pathSource === 'fallback' ? (
        <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Trajeto: linha aproximada (sem polyline)</div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Trajeto: —</div>
      )}
    </div>
  );
}

/**
 * Mapa da rota (Google Maps se houver chave no browser) + sempre geometria correta via decodificação local da polyline.
 * Sem chave: apenas SVG (hub + paradas + linha).
 */
export function RoutingRouteMap({ apiKey, store, stops, encodedPolyline, height = 300 }) {
  const key = (apiKey || '').trim();
  const cleanStops = React.useMemo(() => validStopsList(stops), [stops]);

  if (!key) {
    return (
      <div>
        <OperationalRouteMapSvg store={store} stops={cleanStops} encodedPolyline={encodedPolyline} height={height} />
        <div
          style={{
            marginTop: 12,
            padding: 12,
            color: '#94a3b8',
            fontSize: 12,
            background: 'rgba(15,23,42,0.6)',
            borderRadius: 10,
            border: '1px solid #1e293b',
          }}
        >
          <strong style={{ color: '#e2e8f0' }}>Mapa de ruas:</strong> em{' '}
          <b style={{ color: '#e2e8f0' }}>Configurações</b> defina a chave Maps (JavaScript) ou{' '}
          <code style={{ color: '#cbd5e1' }}>VITE_GOOGLE_MAPS_API_KEY</code>. A polyline do servidor e o hub já aparecem
          acima sem essa chave.
        </div>
      </div>
    );
  }

  return (
    <RoutingRouteMapInner
      key={key}
      apiKey={key}
      store={store}
      stops={cleanStops}
      encodedPolyline={encodedPolyline}
      height={height}
    />
  );
}
