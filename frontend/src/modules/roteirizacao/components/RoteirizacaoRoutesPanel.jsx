import React from 'react';

function retornoEstimado(minutes) {
  const t = Date.now() + (Number(minutes) || 0) * 60000;
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function RoteirizacaoRoutesPanel({
  plan,
  rules,
  busyBatch,
  onOptimize,
  onDispatchRoute,
  selectedRouteIdx,
  onSelectRoute,
}) {
  const routes = plan?.routes || [];

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Painel de rotas</h2>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>
        Rotas do motor interno; distância/ETA compatíveis com Google Routes se configurado no backend.
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {routes.map((r, idx) => {
          const isAi = rules?.mode !== 'manual';
          const dist = r.google?.distanceKm != null ? r.google.distanceKm : r.estimatedTotalKm;
          const mins = r.google?.durationMinutes != null ? r.google.durationMinutes : r.estimatedTotalMinutes;
          const seq = (r.stops || []).map((s) => s.neighborhood || `#${s.orderId}`).join(' › ');
          return (
            <div
              key={r.id}
              style={{
                background: 'rgba(15,23,42,0.85)',
                border:
                  selectedRouteIdx === idx ? '1px solid rgba(59,130,246,0.5)' : '1px solid #1e293b',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800 }}>{r.id} · {r.suggestedDriver?.name || 'Motoboy'}</div>
                <span
                  style={{
                    padding: '5px 9px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    background: isAi ? '#1d4ed8' : '#374151',
                    color: isAi ? '#dbeafe' : '#e5e7eb',
                  }}
                >
                  {isAi ? 'IA' : 'Manual'}
                </span>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                Pedidos: {r.deliveryOrder?.join(', ') || '—'}
                <br />
                Sequência: {seq || '—'}
                <br />
                Distância: {dist} km
                <br />
                Tempo previsto: {mins} min
                <br />
                Retorno estimado: {retornoEstimado(mins)}
              </div>
              {r.warnings?.length > 0 && (
                <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 12 }}>{r.warnings.join(' · ')}</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={onOptimize}>
                  Otimizar
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => onSelectRoute(idx)}
                >
                  Ver no mapa
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 12 }}
                  disabled={busyBatch}
                  onClick={() => onDispatchRoute(r)}
                >
                  Despachar rota
                </button>
              </div>
            </div>
          );
        })}
        {!routes.length && (
          <div style={{ color: '#94a3b8' }}>Sem rotas — clique em “Otimizar agora” com pedidos geocodificados.</div>
        )}
      </div>
    </div>
  );
}
