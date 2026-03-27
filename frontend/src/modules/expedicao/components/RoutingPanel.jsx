import React from 'react';
import { routingService } from '../../../services/routing.service.js';
import { RoutingRouteMap } from './RoutingRouteMap.jsx';
import { useMapsBrowserKey } from '../../../hooks/useMapsBrowserKey.js';

function errMsg(e) {
  return e?.body?.message || e?.message || 'Erro';
}

export function RoutingPanel() {
  const mapsJsKey = useMapsBrowserKey();
  const [config, setConfig] = React.useState(null);
  const [plan, setPlan] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [selectedRouteIdx, setSelectedRouteIdx] = React.useState(0);
  const [skipGoogleRoutes, setSkipGoogleRoutes] = React.useState(false);
  const [params, setParams] = React.useState({
    maxOrdersPerRoute: 4,
    maxRouteMinutes: 30,
    clusterKm: 2,
    soloWaitMinutes: 5,
    avgSpeedKmh: 24,
    minutesPerStop: 3,
    maxDetourRatio: 1.3,
    priorityAgeMinutes: 25,
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await routingService.getConfig();
        if (!cancelled) {
          setConfig(c);
          setParams((p) => ({
            ...p,
            maxOrdersPerRoute: c.defaults?.maxOrdersPerRoute ?? p.maxOrdersPerRoute,
            maxRouteMinutes: c.defaults?.maxRouteMinutes ?? p.maxRouteMinutes,
            clusterKm: c.defaults?.clusterKm ?? p.clusterKm,
            soloWaitMinutes: c.defaults?.soloWaitMinutes ?? p.soloWaitMinutes,
            avgSpeedKmh: c.defaults?.avgSpeedKmh ?? p.avgSpeedKmh,
            minutesPerStop: c.defaults?.minutesPerStop ?? p.minutesPerStop,
            maxDetourRatio: c.defaults?.maxDetourRatio ?? p.maxDetourRatio,
            priorityAgeMinutes: c.defaults?.priorityAgeMinutes ?? p.priorityAgeMinutes,
          }));
        }
      } catch (e) {
        if (!cancelled) setErr(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runPlan() {
    setBusy(true);
    setErr('');
    try {
      const r = await routingService.plan({ ...params, skipGoogleRoutes });
      setPlan(r);
      setSelectedRouteIdx(0);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  const routes = plan?.routes || [];
  const safeIdx = routes.length ? Math.min(selectedRouteIdx, routes.length - 1) : 0;
  const selectedRoute = routes[safeIdx];

  function field(k, label) {
    return (
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#94a3b8' }}>
        {label}
        <input
          className="select"
          type="number"
          step="any"
          value={params[k]}
          onChange={(e) => setParams((p) => ({ ...p, [k]: Number(e.target.value) }))}
        />
      </label>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Roteirização</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            POST /routing/plan · lat/lng nos pedidos · Google Routes opcional no servidor
          </div>
        </div>
        <button type="button" className="btn" disabled={busy} onClick={runPlan}>
          {busy ? 'Planejando…' : 'Planejar rotas'}
        </button>
      </div>
      {err && <div className="err">{err}</div>}

      {config?.store && (
        <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Origem (loja)</div>
          <div style={{ color: '#cbd5e1', fontSize: 14 }}>
            {config.store.label}
            <br />
            <span style={{ color: '#94a3b8' }}>
              {config.store.lat}, {config.store.lng}
            </span>
          </div>
          {config.google && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
              Google servidor: enrich rotas {config.google.routesApiEnrichment ? 'ativo' : 'inativo'} · geocode{' '}
              {config.google.geocodeProxy ? 'ativo' : 'inativo'}
              {config.google.trafficAwareRoutes ? ' · tráfego na rota' : ''}
            </div>
          )}
        </div>
      )}

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Parâmetros</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {field('maxOrdersPerRoute', 'Máx. pedidos/rota')}
          {field('maxRouteMinutes', 'Máx. minutos')}
          {field('clusterKm', 'Cluster km')}
          {field('soloWaitMinutes', 'Espera solo (min)')}
          {field('avgSpeedKmh', 'Vel. média km/h')}
          {field('minutesPerStop', 'Min/stop')}
          {field('maxDetourRatio', 'Máx. desvio (×)')}
          {field('priorityAgeMinutes', 'Idade prioridade (min)')}
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            fontSize: 13,
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={skipGoogleRoutes}
            onChange={(e) => setSkipGoogleRoutes(e.target.checked)}
          />
          Não chamar Google Routes (só heurística local)
        </label>
      </div>

      {plan && (
        <>
          {plan.routingGoogleError && (
            <div className="glass-card err" style={{ padding: 14, marginBottom: 16 }}>
              Enriquecimento Google falhou: {plan.routingGoogleError}
            </div>
          )}

          {routes.length > 0 && (
            <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Mapa · rota selecionada</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {routes.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className={i === safeIdx ? 'btn' : 'select'}
                    style={
                      i === safeIdx
                        ? { padding: '6px 12px', fontSize: 13 }
                        : { padding: '6px 12px', fontSize: 13, opacity: 0.85 }
                    }
                    onClick={() => setSelectedRouteIdx(i)}
                  >
                    {r.id}
                  </button>
                ))}
              </div>
              <RoutingRouteMap
                apiKey={mapsJsKey}
                store={plan.store}
                stops={selectedRoute?.stops}
                encodedPolyline={selectedRoute?.google?.encodedPolyline}
              />
            </div>
          )}

          {plan.skippedOrders?.length > 0 && (
            <div className="glass-card" style={{ padding: 16, marginBottom: 16, border: '1px solid #b45309' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Pedidos ignorados</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#fdba74', fontSize: 13 }}>
                {plan.skippedOrders.map((s) => (
                  <li key={s.id}>
                    #{s.id}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.routes?.length === 0 && (
            <div className="glass-card" style={{ padding: 16, color: '#94a3b8' }}>
              Nenhuma rota gerada.
            </div>
          )}

          <div style={{ display: 'grid', gap: 14 }}>
            {plan.routes?.map((r) => (
              <div key={r.id} className="glass-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 18 }}>{r.id}</span>
                    <span
                      style={{
                        marginLeft: 10,
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: '#1e3a5f',
                        color: '#93c5fd',
                        fontWeight: 700,
                      }}
                    >
                      {r.direction}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    ~{r.estimatedTotalKm} km · ~{r.estimatedTotalMinutes} min · score {r.efficiencyScore}
                  </div>
                </div>
                {r.google && !r.google.error && r.google.distanceKm != null && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#86efac' }}>
                    Google (ida + paradas + volta): {r.google.distanceKm} km · {r.google.durationMinutes} min
                    {r.google.trafficAware ? ' · com tráfego' : ''}
                  </div>
                )}
                {r.google?.error && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#fca5a5' }}>Google: {r.google.error}</div>
                )}
                {r.warnings?.length > 0 && <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 13 }}>{r.warnings.join(' · ')}</div>}
                {r.waitHint && <div style={{ marginTop: 8, color: '#a5b4fc', fontSize: 13 }}>{r.waitHint}</div>}
                <div style={{ marginTop: 10, fontSize: 13, color: '#cbd5e1' }}>
                  Ordem: <b style={{ color: '#e2e8f0' }}>{r.deliveryOrder?.join(' → ')}</b>
                </div>
                {r.suggestedDriver && (
                  <div style={{ marginTop: 6, fontSize: 13, color: '#86efac' }}>
                    Motoboy sugerido: <b>{r.suggestedDriver.name}</b> (#{r.suggestedDriver.id}) — {r.suggestedDriver.reason}
                  </div>
                )}
                <table className="data" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Ordem</th>
                      <th>Pedido</th>
                      <th>Bairro</th>
                      <th>Km loja</th>
                      <th>Idade (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.stops?.map((s, i) => (
                      <tr key={s.orderId}>
                        <td>{i + 1}</td>
                        <td style={{ fontWeight: 700 }}>#{s.orderId}</td>
                        <td>{s.neighborhood || '—'}</td>
                        <td>{s.distanceFromStoreKm}</td>
                        <td>{s.ageMinutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
