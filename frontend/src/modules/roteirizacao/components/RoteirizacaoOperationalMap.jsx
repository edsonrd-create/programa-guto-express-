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
  const mapHeight = 480;

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Mapa operacional</h2>
      <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
        Hub da loja, paradas da rota selecionada e trajeto (polyline do servidor quando disponível; mapa de ruas opcional
        com chave Maps nas configurações).
      </div>
      {(!plan || routes.length === 0) && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(30,41,59,0.5)',
            color: '#94a3b8',
            fontSize: 13,
          }}
        >
          Clique em <strong style={{ color: '#e2e8f0' }}>Otimizar agora</strong> com pedidos em status elegível e com
          lat/lng de entrega para gerar rotas e ver o mapa.
        </div>
      )}
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
        height={mapHeight}
      />
    </div>
  );
}
