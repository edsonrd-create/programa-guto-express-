import React from 'react';
import { Link } from 'react-router-dom';
import { buildGroupingSuggestion } from '../../../services/roteirizacao.service.js';
import ExpedicaoConnectedKpis from './ExpedicaoConnectedKpis.jsx';
import ExpedicaoOperationalMapSimulated from './ExpedicaoOperationalMapSimulated.jsx';

function priorityClass(key) {
  if (key === 'high') return '#fca5a5';
  if (key === 'medium') return '#fde68a';
  return '#86efac';
}

export default function ExpedicaoConnectedView({
  kpis,
  ready,
  plan,
  queue,
  drivers,
  deliveries,
  mode,
  setMode,
  planBusy,
  busy,
  setBusy,
  err,
  setErr,
  load,
  runPlan,
  skipGoogleRoutes,
  setSkipGoogleRoutes,
  dispatchService,
  ageMinutes,
  slaClock,
  routeForOrder,
  priorityLabel,
}) {
  const [routeIdx, setRouteIdx] = React.useState(0);
  const grouping = plan ? buildGroupingSuggestion(plan) : null;

  async function assignOne(orderId) {
    setBusy(orderId);
    setErr('');
    try {
      await dispatchService.assignNext(orderId);
      await load();
      await runPlan();
    } catch (e) {
      setErr(e?.body?.message || e?.message || 'Despacho falhou');
    }
    setBusy(0);
  }

  /** Despacha todos os pedidos em “pronto” na ordem da fila, sem seleção manual. */
  async function assignAllReady() {
    const ids = (ready || []).filter((o) => o.status === 'pronto').map((o) => o.id);
    if (!ids.length) {
      setErr('Nenhum pedido pronto na fila.');
      return;
    }
    setBusy(-1);
    setErr('');
    try {
      for (const id of ids) {
        await dispatchService.assignNext(id);
      }
      await load();
      await runPlan();
    } catch (e) {
      setErr(e?.body?.message || e?.message || 'Despacho em lote falhou');
    }
    setBusy(0);
  }

  function hintGroup(orderId) {
    const r = routeForOrder(orderId);
    if (r) setRouteIdx(Math.max(0, (plan?.routes || []).indexOf(r)));
  }

  const queueDriverIds = new Set((queue || []).map((q) => Number(q.driver_id)));
  const driversList = drivers || [];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Expedição conectada com a Roteirização</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
            Pedidos prontos, agrupamento e despacho — modo {mode === 'ia' ? 'assistido (IA)' : 'manual'}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            Atualizar fila
          </button>
          <button type="button" className="btn" disabled={planBusy} onClick={() => void runPlan()}>
            {planBusy ? 'Planejando…' : 'Atualizar plano / IA'}
          </button>
          <button type="button" className="btn-ghost" disabled={busy === -1} onClick={() => void assignAllReady()}>
            Despachar todos na fila
          </button>
          <button type="button" className="btn-ghost" onClick={() => setMode(mode === 'ia' ? 'manual' : 'ia')}>
            Modo {mode === 'ia' ? 'manual' : 'IA'}
          </button>
          <Link to="/roteirizacao" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Central roteirização
          </Link>
        </div>
      </div>

      {err && (
        <div className="err" style={{ marginBottom: 12 }}>
          {err}
        </div>
      )}

      <ExpedicaoConnectedKpis kpis={kpis} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)',
          gap: 20,
          marginBottom: 20,
        }}
        className="expedicao-layout-3"
      >
        <div className="glass-card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Pedidos prontos</h2>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>
            Status <strong>pronto</strong> — use <strong>Despachar agora</strong> em um clique ou &quot;Despachar todos na fila&quot; no topo.
          </div>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {ready.map((o) => {
              const pr = priorityLabel(o);
              const am = Math.round(ageMinutes(o.created_at));
              const urgent = am >= 20;
              return (
                <div
                  key={o.id}
                  style={{
                    background: 'rgba(15,23,42,0.85)',
                    border: '1px solid #1e293b',
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>
                      #{o.id} — {o.client_name || 'Cliente'}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '5px 9px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#1e293b',
                          color: '#cbd5e1',
                        }}
                      >
                        Painel
                      </span>
                      <span
                        style={{
                          padding: '5px 9px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#1d4ed8',
                          color: '#dbeafe',
                        }}
                      >
                        Pronto
                      </span>
                      {urgent && (
                        <span
                          style={{
                            padding: '5px 9px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: '#7f1d1d',
                            color: '#fca5a5',
                          }}
                        >
                          Urgente
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
                    {o.client_phone && (
                      <>
                        Telefone: {o.client_phone}
                        <br />
                      </>
                    )}
                    Bairro: {o.delivery_neighborhood || '—'}
                    <br />
                    Endereço: {o.delivery_address || '—'}
                    <br />
                    Pronto há: {am} min
                    <br />
                    SLA: {slaClock(o.created_at, o.estimated_delivery_minutes)}
                    <br />
                    Prioridade:{' '}
                    <span style={{ color: priorityClass(pr.key), fontWeight: 800 }}>{pr.label}</span>
                    {mode === 'ia' && routeForOrder(o.id) && (
                      <>
                        <br />
                        Rota sugerida: <strong style={{ color: '#93c5fd' }}>{routeForOrder(o.id).id}</strong>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button type="button" className="btn" disabled={busy === o.id} onClick={() => assignOne(o.id)}>
                      Despachar agora
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => hintGroup(o.id)}>
                      Agrupar
                    </button>
                    <Link to="/pedidos" className="btn-ghost" style={{ fontSize: 13 }}>
                      Pedidos
                    </Link>
                  </div>
                </div>
              );
            })}
            {ready.length === 0 && <div style={{ color: '#94a3b8' }}>Nenhum pedido pronto.</div>}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Sugestões de agrupamento</h2>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Derivadas do plano atual (motor + Google opcional).</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {(plan?.routes || [])
              .filter((x) => (x.stops || []
              ).length >= 2)
              .slice(0, 4)
              .map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: 'rgba(15,23,42,0.85)',
                    border: '1px solid #1e293b',
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 800 }}>{r.id}</span>
                    {mode === 'ia' && (
                      <span
                        style={{
                          padding: '5px 9px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#1d4ed8',
                          color: '#dbeafe',
                        }}
                      >
                        IA
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
                    Pedidos: {r.deliveryOrder?.join(' · ') || '—'}
                    <br />
                    {r.stops?.[0]?.neighborhood && <>Bairro: {r.stops[0].neighborhood}</>}
                    {r.suggestedDriver && (
                      <>
                        <br />
                        Motoboy sugerido: <strong>{r.suggestedDriver.name}</strong>
                      </>
                    )}
                    <br />
                    Dist. ~{r.google?.distanceKm ?? r.estimatedTotalKm} km · Tempo ~{' '}
                    {r.google?.durationMinutes ?? r.estimatedTotalMinutes} min
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" className="btn-ghost" onClick={() => setRouteIdx(plan.routes.indexOf(r))}>
                      Ver no mapa
                    </button>
                  </div>
                </div>
              ))}
            {(!plan?.routes || !plan.routes.some((x) => (x.stops || []).length >= 2)) && (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Gere um plano para ver agrupamentos.</div>
            )}
            {mode === 'ia' && grouping && (
              <div
                style={{
                  marginTop: 8,
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid rgba(59,130,246,0.45)',
                  borderLeft: '4px solid #3b82f6',
                  background: 'rgba(15,23,42,0.75)',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Sugestão principal</h3>
                <div style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.5 }}>{grouping.rationale}</div>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Despacho rápido</h2>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Fila de check-in e status dos motoboys.</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {driversList.map((d) => {
              const inQ = queueDriverIds.has(Number(d.id));
              return (
                <div
                  key={d.id}
                  style={{
                    background: 'rgba(15,23,42,0.85)',
                    border: '1px solid #1e293b',
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 800 }}>{d.name || `Motoboy #${d.id}`}</span>
                    <span
                      style={{
                        padding: '5px 9px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: inQ ? '#14532d' : '#422006',
                        color: inQ ? '#86efac' : '#fdba74',
                      }}
                    >
                      {inQ ? 'Na fila' : d.status || 'Fora da fila'}
                    </span>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                    Status operacional: {d.status || '—'}
                    {inQ && (
                      <>
                        <br />
                        Pronto para despacho FIFO
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
                    O sistema usa <strong>próximo da fila</strong> em “Despachar agora”.
                  </div>
                </div>
              );
            })}
            {driversList.length === 0 && <div style={{ color: '#94a3b8' }}>Nenhum motoboy cadastrado.</div>}
          </div>
        </div>
      </div>

      <ExpedicaoOperationalMapSimulated plan={plan} selectedRouteIdx={routeIdx} onSelectRoute={setRouteIdx} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 20,
          marginTop: 20,
        }}
        className="expedicao-bottom-grid"
      >
        <div className="glass-card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Fila operacional detalhada</h2>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Um clique em Despachar atribui o próximo motoboy da fila.</div>
          <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 16 }}>
            <table className="data" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Bairro</th>
                  <th>Pronto há</th>
                  <th>SLA</th>
                  <th>Motoboy (sug.)</th>
                  <th>Rota</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ready.map((o) => {
                  const r = routeForOrder(o.id);
                  const am = Math.round(ageMinutes(o.created_at));
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700 }}>#{o.id}</td>
                      <td>{o.client_name || '—'}</td>
                      <td>{o.delivery_neighborhood || '—'}</td>
                      <td>{am} min</td>
                      <td>{slaClock(o.created_at, o.estimated_delivery_minutes)}</td>
                      <td>{r?.suggestedDriver?.name || '—'}</td>
                      <td>{r?.id || '—'}</td>
                      <td>
                        <button type="button" className="btn" style={{ padding: '6px 10px', fontSize: 12 }} disabled={busy === o.id} onClick={() => assignOne(o.id)}>
                          Despachar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ready.length === 0 && <div style={{ padding: 12, color: '#94a3b8' }}>Sem linhas.</div>}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Regras rápidas + manual</h2>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>
            Parâmetros do plano (local na sessão). Desligar Google só no pedido — o servidor pode impor política global em
            Configurações.
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, color: '#e2e8f0' }}>
            <input type="checkbox" checked={skipGoogleRoutes} onChange={(e) => setSkipGoogleRoutes(e.target.checked)} />
            Não usar Google Routes neste plano (heurística)
          </label>
          <div style={{ marginTop: 16, display: 'grid', gap: 10, fontSize: 13, color: '#94a3b8' }}>
            <div>
              Timeline (exemplo): ao despachar, registre observações em <Link to="/pedidos">Pedidos</Link>.
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 18, marginTop: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Entregas em curso</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Pedido</th>
                <th>Motoboy</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(deliveries || []).slice(0, 40).map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.order_id}</td>
                  <td>{d.driver_name || d.driver_id}</td>
                  <td>{d.status}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {d.status === 'aguardando_motoboy' && (
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        disabled={busy === d.order_id}
                        onClick={async () => {
                          setBusy(d.order_id);
                          setErr('');
                          try {
                            await dispatchService.send(d.order_id);
                            await load();
                          } catch (e) {
                            setErr(e?.body?.message || e?.message || 'Erro');
                          }
                          setBusy(0);
                        }}
                      >
                        Saiu
                      </button>
                    )}
                    {d.status === 'em_entrega' && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        disabled={busy === d.order_id}
                        onClick={async () => {
                          setBusy(d.order_id);
                          setErr('');
                          try {
                            await dispatchService.markDelivered(d.order_id);
                            await load();
                          } catch (e) {
                            setErr(e?.body?.message || e?.message || 'Erro');
                          }
                          setBusy(0);
                        }}
                      >
                        Entregue
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(deliveries || []).length === 0 && (
            <div style={{ padding: 12, color: '#94a3b8' }}>Nenhuma entrega registrada.</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1300px) {
          .expedicao-layout-3,
          .expedicao-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
