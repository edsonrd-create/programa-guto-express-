import React from 'react';
import { RoutingRouteMap } from '../../expedicao/components/RoutingRouteMap.jsx';
import { useMapsBrowserKey } from '../../../hooks/useMapsBrowserKey.js';

/**
 * Mapa central: rota selecionada do plano + hub da loja.
 */
export default function RoteirizacaoOperationalMap({ plan, selectedRouteIdx, onSelectRoute }) {
  const mapsKey = useMapsBrowserKey();
  const routes = plan?.routes || [];
  const safeIdx = routes.length ? Math.min(selectedRouteIdx, routes.length - 1) : 0;
  const r = routes[safeIdx];
  const stops = r?.stops || [];

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Mapa operacional</h2>
      <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
        Hub da loja, paradas da rota selecionada e polyline (Google opcional no servidor).
      </div>
      {routes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {routes.map((x, i) => (
            <button
              key={x.id}
              type="button"
              className={i === safeIdx ? 'btn' : 'btn-ghost'}
              style={{ fontSize: 12 }}
              onClick={() => onSelectRoute(i)}
            >
              {x.id} · {x.direction}
            </button>
          ))}
        </div>
      )}
      <RoutingRouteMap
        apiKey={mapsKey}
        store={plan?.store}
        stops={stops}
        encodedPolyline={r?.google?.encodedPolyline}
        height={mapsKey ? 520 : 200}
      />
    </div>
  );
}
