import React from 'react';
import RoteirizacaoKpis from '../components/RoteirizacaoKpis.jsx';
import RoteirizacaoQueue from '../components/RoteirizacaoQueue.jsx';
import RoteirizacaoOperationalMap from '../components/RoteirizacaoOperationalMap.jsx';
import RoteirizacaoRoutesPanel from '../components/RoteirizacaoRoutesPanel.jsx';
import RoteirizacaoCouriersPanel from '../components/RoteirizacaoCouriersPanel.jsx';
import RoteirizacaoRulesPanel from '../components/RoteirizacaoRulesPanel.jsx';
import RoteirizacaoIaSuggestion from '../components/RoteirizacaoIaSuggestion.jsx';
import RoteirizacaoGoogleAutoPanel from '../components/RoteirizacaoGoogleAutoPanel.jsx';
import { useRoteirizacaoLive } from '../hooks/useRoteirizacaoLive.js';
import { roteirizacaoService } from '../../../services/roteirizacao.service.js';

export default function RoteirizacaoPage() {
  const {
    snap,
    transport,
    reloadSnap,
    orders,
    deliveries,
    queue,
    drivers,
    config,
    plan,
    setPlan,
    busyPlan,
    runPlan,
    rules,
    setRules,
    loadBaseline,
    err,
    setErr,
  } = useRoteirizacaoLive();

  const [selectedRouteIdx, setSelectedRouteIdx] = React.useState(0);
  const [busyId, setBusyId] = React.useState(0);
  const [busyBatch, setBusyBatch] = React.useState(false);
  const [routingInfo, setRoutingInfo] = React.useState('');

  React.useEffect(() => {
    setSelectedRouteIdx(0);
  }, [plan?.generatedAt]);

  async function dispatchOrder(orderId) {
    setBusyId(orderId);
    setErr('');
    try {
      await roteirizacaoService.assignNext(orderId);
      await loadBaseline();
      await runPlan();
    } catch (e) {
      setErr(e?.body?.message || e?.message || 'Despacho falhou');
    }
    setBusyId(0);
  }

  async function dispatchRoute(route) {
    setBusyBatch(true);
    setErr('');
    try {
      const ids = route.deliveryOrder || [];
      for (const oid of ids) {
        const o = orders.find((x) => Number(x.id) === Number(oid));
        if (o?.status === 'pronto') {
          await roteirizacaoService.assignNext(oid);
        }
      }
      await loadBaseline();
      await runPlan();
    } catch (e) {
      setErr(e?.body?.message || e?.message || 'Despacho em lote falhou');
    }
    setBusyBatch(false);
  }

  function onGroupHint(orderId) {
    if (!plan?.routes?.length) {
      setErr('Otimize primeiro para ver agrupamentos sugeridos.');
      return;
    }
    const r = plan.routes.find((x) => x.deliveryOrder?.includes(orderId));
    if (r) {
      const idx = plan.routes.indexOf(r);
      setSelectedRouteIdx(idx);
      setErr('');
    } else {
      setErr(`Pedido #${orderId} não está em rota (falta lat/lng ou status).`);
    }
  }

  function handleApplySuggestion() {
    setSelectedRouteIdx(0);
    void runPlan();
  }

  return (
    <div style={{ padding: 20 }} className="fade-up">
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
          <h1 style={{ margin: 0, fontSize: 28 }}>Central de Roteirização Inteligente</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
            Despacho, agrupamento, ETA e snapshot{' '}
            <span style={{ color: transport === 'ws' ? '#6ee7b7' : '#94a3b8' }}>({transport})</span>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn" disabled={busyPlan} onClick={() => runPlan()}>
            {busyPlan ? 'Otimizando…' : 'Otimizar agora'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busyBatch}
            onClick={async () => {
              setBusyBatch(true);
              try {
                for (const o of orders.filter((x) => x.status === 'pronto')) {
                  await roteirizacaoService.assignNext(o.id);
                }
                await loadBaseline();
                await runPlan();
              } catch (e) {
                setErr(e?.body?.message || e?.message || 'Despacho global falhou');
              }
              setBusyBatch(false);
            }}
          >
            Despachar rotas (todos prontos)
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setRules((r) => ({ ...r, mode: r.mode === 'manual' ? 'ia' : 'manual' }))}
          >
            Alternar para {rules.mode === 'manual' ? 'IA' : 'manual'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => void reloadSnap()}>
            Atualizar snapshot
          </button>
        </div>
      </div>

      <RoteirizacaoGoogleAutoPanel
        config={config}
        loadBaseline={loadBaseline}
        onMsg={(t) => {
          setRoutingInfo(t);
          setErr('');
        }}
        onErr={(t) => {
          setErr(t);
          setRoutingInfo('');
        }}
      />
      {routingInfo && (
        <div style={{ color: '#34d399', fontSize: 14, marginBottom: 12 }}>{routingInfo}</div>
      )}

      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      {snap?.integrationOutbox && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
          Outbox parceiro pendente:{' '}
          {(snap.integrationOutbox.partnerSyncJobs?.pending || 0) +
            (snap.integrationOutbox.partnerSyncJobs?.processing || 0)}
        </div>
      )}

      <RoteirizacaoKpis orders={orders} deliveries={deliveries} queue={queue} rules={rules} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.35fr) minmax(0, 1fr)',
          gap: 20,
          marginBottom: 20,
        }}
        className="roteiriza-main-grid"
      >
        <RoteirizacaoQueue
          orders={orders}
          plan={plan}
          busyId={busyId}
          onDispatch={dispatchOrder}
          onGroupHint={onGroupHint}
          mode={rules.mode}
        />
        <RoteirizacaoOperationalMap
          plan={plan}
          selectedRouteIdx={selectedRouteIdx}
          onSelectRoute={setSelectedRouteIdx}
        />
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <RoteirizacaoRoutesPanel
            plan={plan}
            rules={rules}
            busyBatch={busyBatch}
            onOptimize={() => runPlan()}
            onDispatchRoute={dispatchRoute}
            selectedRouteIdx={selectedRouteIdx}
            onSelectRoute={setSelectedRouteIdx}
          />
          <RoteirizacaoCouriersPanel drivers={drivers} queue={queue} deliveries={deliveries} />
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 20 }}
        className="roteiriza-rules-grid"
      >
        <RoteirizacaoRulesPanel
          rules={rules}
          setRules={setRules}
          config={config}
          busy={busyPlan}
          onSave={() => {
            void runPlan();
          }}
        />
        <RoteirizacaoIaSuggestion
          plan={plan}
          rules={rules}
          onApply={handleApplySuggestion}
          onReject={() => setPlan(null)}
        />
      </div>

      <style>{`
        @media (max-width: 1300px) {
          .roteiriza-main-grid,
          .roteiriza-rules-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
