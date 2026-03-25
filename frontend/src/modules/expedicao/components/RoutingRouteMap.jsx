import React from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';

const mapContainerStyle = { width: '100%', height: 300, borderRadius: 12 };

const defaultMapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

function buildFallbackPath(store, stops) {
  if (!store || store.lat == null || store.lng == null || !stops?.length) return [];
  const o = { lat: Number(store.lat), lng: Number(store.lng) };
  const middle = stops.map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }));
  return [o, ...middle, o];
}

function RoutingRouteMapInner({ apiKey, store, stops, encodedPolyline }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'routing-google-map',
    googleMapsApiKey: apiKey,
    libraries: ['geometry'],
  });

  const [path, setPath] = React.useState([]);

  React.useEffect(() => {
    if (!isLoaded || !window.google?.maps?.geometry?.encoding) {
      if (isLoaded) setPath(buildFallbackPath(store, stops));
      return;
    }
    if (encodedPolyline) {
      try {
        const decoded = window.google.maps.geometry.encoding.decodePath(encodedPolyline);
        setPath(decoded.map((ll) => ({ lat: ll.lat(), lng: ll.lng() })));
      } catch {
        setPath(buildFallbackPath(store, stops));
      }
      return;
    }
    setPath(buildFallbackPath(store, stops));
  }, [isLoaded, encodedPolyline, store, stops]);

  if (loadError) {
    return <div className="err">Mapa: {String(loadError.message || loadError)}</div>;
  }

  const center =
    store && store.lat != null
      ? { lat: Number(store.lat), lng: Number(store.lng) }
      : { lat: -25.4284, lng: -49.2733 };

  return (
    <div style={{ marginTop: 12 }}>
      {!isLoaded ? (
        <div
          style={{
            height: 300,
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
        <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={13} options={defaultMapOptions}>
          {path.length > 1 && (
            <Polyline
              path={path}
              options={{
                strokeColor: '#60a5fa',
                strokeOpacity: 0.92,
                strokeWeight: 4,
              }}
            />
          )}
          <Marker position={center} title={store?.label || 'Loja'} />
          {(stops || []).map((s) => (
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
export function RoutingRouteMap({ apiKey, store, stops, encodedPolyline }) {
  const key = (apiKey || '').trim();
  if (!key) {
    return (
      <div style={{ padding: 14, color: '#94a3b8', fontSize: 13, background: '#0f172a', borderRadius: 12 }}>
        Para o mapa no painel, defina <code style={{ color: '#cbd5e1' }}>VITE_GOOGLE_MAPS_API_KEY</code> (Maps
        JavaScript API, restrição por referrer).
      </div>
    );
  }

  return (
    <RoutingRouteMapInner
      apiKey={key}
      store={store}
      stops={stops}
      encodedPolyline={encodedPolyline}
    />
  );
}
