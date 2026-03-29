import React from 'react';
import { getRoutePathPoints, validStopsList } from '../../../lib/routeMapGeometry.js';

function boundsFromPoints(points) {
  if (!points.length) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const padLat = Math.max((maxLat - minLat) * 0.12, 0.002);
  const padLng = Math.max((maxLng - minLng) * 0.12, 0.002);
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };
}

function project(lat, lng, b, w, h, pad) {
  const dh = b.maxLat - b.minLat || 1e-9;
  const dw = b.maxLng - b.minLng || 1e-9;
  const x = pad + ((lng - b.minLng) / dw) * (w - 2 * pad);
  const y = pad + (1 - (lat - b.minLat) / dh) * (h - 2 * pad);
  return [x, y];
}

/**
 * Mapa esquemático (SVG): hub, paradas e linha — sem Maps JavaScript API.
 */
export default function OperationalRouteMapSvg({
  store,
  stops,
  encodedPolyline,
  height = 360,
  showLegend = true,
}) {
  const w = 800;
  const h = Math.max(200, Number(height) || 360);
  const pad = 36;
  const cleanStops = React.useMemo(() => validStopsList(stops), [stops]);
  const { points, source } = React.useMemo(
    () => getRoutePathPoints(store, cleanStops, encodedPolyline),
    [store, cleanStops, encodedPolyline],
  );

  const allForBounds = React.useMemo(() => {
    const list = [...points];
    if (store && store.lat != null && store.lng != null) {
      list.push({ lat: Number(store.lat), lng: Number(store.lng) });
    }
    for (const s of cleanStops) list.push({ lat: Number(s.lat), lng: Number(s.lng) });
    return list;
  }, [points, store, cleanStops]);

  const b = React.useMemo(() => boundsFromPoints(allForBounds), [allForBounds]);

  if (!b) {
    return (
      <div
        style={{
          height: h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          borderRadius: 12,
          color: '#64748b',
          fontSize: 14,
          padding: 16,
          textAlign: 'center',
        }}
      >
        Sem coordenadas de loja ou paradas para desenhar o mapa. Otimize as rotas com pedidos que tenham lat/lng.
      </div>
    );
  }

  const linePts = points
    .map((p) => {
      const [x, y] = project(p.lat, p.lng, b, w, h, pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const hues = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];

  let storeXY = null;
  if (store && store.lat != null && store.lng != null) {
    const la = Number(store.lat);
    const ln = Number(store.lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      storeXY = project(la, ln, b, w, h, pad);
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{
          width: '100%',
          height: h,
          borderRadius: 12,
          background: '#0f172a',
          display: 'block',
          border: '1px solid #1e293b',
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {linePts && points.length > 1 && (
          <polyline
            points={linePts}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.92}
          />
        )}
        {storeXY && (
          <g>
            <circle cx={storeXY[0]} cy={storeXY[1]} r="12" fill="#facc15" stroke="#fff" strokeWidth="2" />
            <text
              x={storeXY[0]}
              y={storeXY[1] + 28}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="12"
              fontWeight="700"
            >
              {store?.label || 'Loja'}
            </text>
          </g>
        )}
        {cleanStops.map((s, idx) => {
          const xy = project(Number(s.lat), Number(s.lng), b, w, h, pad);
          const hue = hues[idx % hues.length];
          return (
            <g key={`stop-${s.orderId}-${idx}`}>
              <circle cx={xy[0]} cy={xy[1]} r="9" fill={hue} stroke="#fff" strokeWidth="2" />
              <text x={xy[0]} y={xy[1] - 14} textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
                #{s.orderId}
              </text>
            </g>
          );
        })}
      </svg>
      {showLegend && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
          {source === 'google' && 'Trajeto: polyline (Routes API no servidor) · Vista esquemática SVG.'}
          {source === 'fallback' && 'Trajeto: linha loja → paradas → loja (aproximado) · Vista esquemática SVG.'}
          {source === 'empty' && 'Sem linha de percurso (adicione paradas com lat/lng ou polyline do servidor).'}
        </div>
      )}
    </div>
  );
}
