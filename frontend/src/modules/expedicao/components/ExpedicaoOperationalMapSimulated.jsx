import React from 'react';

/**
 * Mapa esquemático (hub + paradas + linhas) sem API Google — útil como visão operacional rápida.
 */
export default function ExpedicaoOperationalMapSimulated({ plan, selectedRouteIdx, onSelectRoute }) {
  const routes = plan?.routes || [];
  const safeIdx = routes.length ? Math.min(selectedRouteIdx, routes.length - 1) : 0;
  const r = routes[safeIdx];
  const stops = r?.stops || [];

  const hues = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7'];

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Mapa operacional (simulado)</h2>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>
            Posições ilustrativas da rota selecionada. Para mapa real, use <strong>Roteirização</strong> com chave
            Google.
          </div>
        </div>
        {routes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {routes.map((x, i) => (
              <button
                key={x.id}
                type="button"
                className={i === safeIdx ? 'btn' : 'btn-ghost'}
                style={{ fontSize: 12 }}
                onClick={() => onSelectRoute(i)}
              >
                {x.id}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 16,
          height: 320,
          borderRadius: 16,
          background: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
            #0f172a`,
          backgroundSize: '32px 32px',
          border: '1px solid #1e293b',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {!r || stops.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: 14,
              padding: 20,
              textAlign: 'center',
            }}
          >
            Planeje rotas com <strong style={{ color: '#94a3b8' }}>“Atualizar plano / IA”</strong> para ver o hub e as
            paradas.
          </div>
        ) : (
          <>
            {stops.map((s, idx) => {
              const angle = -Math.PI / 2 + (idx / Math.max(stops.length, 1)) * Math.PI * 1.2;
              const rad = 22 + (idx % 3) * 7;
              const left = 50 + rad * Math.cos(angle);
              const top = 50 + rad * Math.sin(angle) * 0.75;
              const hue = hues[idx % hues.length];
              return (
                <div
                  key={s.orderId}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#e2e8f0',
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: hue,
                      margin: '0 auto 6px',
                      border: '2px solid #fff',
                    }}
                  />
                  #{s.orderId}
                </div>
              );
            })}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#facc15',
                  margin: '0 auto 6px',
                  border: '2px solid #fff',
                }}
              />
              Loja
            </div>
            {stops.map((s, idx) => {
              const angle = -Math.PI / 2 + (idx / Math.max(stops.length, 1)) * Math.PI * 1.2;
              const rad = 22 + (idx % 3) * 7;
              const left = 50 + rad * Math.cos(angle);
              const top = 50 + rad * Math.sin(angle) * 0.75;
              const len = Math.hypot(left - 50, top - 50) * 4;
              const rot = (Math.atan2(top - 50, left - 50) * 180) / Math.PI;
              return (
                <div
                  key={`line-${s.orderId}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${len}px`,
                    height: 3,
                    background: 'rgba(59,130,246,0.75)',
                    transformOrigin: 'left center',
                    transform: `rotate(${rot}deg)`,
                    borderRadius: 999,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
