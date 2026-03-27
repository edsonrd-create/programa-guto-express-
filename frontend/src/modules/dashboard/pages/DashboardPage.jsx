import { useOpsSnapshot } from '../../../hooks/useOpsSnapshot.js';
import { isSameLocalDay } from '../../../utils/date.js';

export default function DashboardPage() {
  const { data, error, loading, transport } = useOpsSnapshot();
  const orders = data?.orders ?? [];
  const queue = data?.driverQueue ?? [];
  const kds = data?.kds ?? [];

  const pedidosHoje = orders.filter((o) => isSameLocalDay(o.created_at)).length;
  const emPreparo = orders.filter((o) => o.status === 'em_preparo').length;
  const prontos = orders.filter((o) => o.status === 'pronto').length;
  const motoboysFila = queue.length;

  const ai = data?.ai;
  const store = data?.store;
  const stRules = store?.rules;
  const outbox = data?.integrationOutbox?.partnerSyncJobs;
  const outboxPending =
    outbox != null ? Number(outbox.pending || 0) + Number(outbox.processing || 0) : 0;

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Operação em tempo real</div>
          <div style={{ color: '#94a3b8' }}>
            Dados vivos · {transport === 'ws' ? 'WebSocket /ws/ops (+ backup HTTP)' : 'HTTP /ops/snapshot'}
          </div>
        </div>
        <div className="glass-card pulse-soft" style={{ padding: '10px 16px', fontSize: 13 }}>
          {loading && !data ? 'A carregar…' : data?.generatedAt ? new Date(data.generatedAt).toLocaleString('pt-BR') : '—'}
        </div>
      </div>
      {error && <div className="err">{error}</div>}

      {outbox != null && (
        <div
          className="glass-card"
          style={{
            padding: '12px 18px',
            marginBottom: 14,
            fontSize: 13,
            color: '#94a3b8',
            border: '1px solid rgba(59,130,246,0.25)',
          }}
        >
          <span style={{ fontWeight: 800, color: '#93c5fd' }}>Outbox parceiro</span>
          <span style={{ marginLeft: 10 }}>pendente ({outboxPending})</span>
          {' · '}
          ok {outbox.done ?? 0}
          {' · '}
          falha {outbox.failed ?? 0}
          <span style={{ marginLeft: 8, opacity: 0.85 }}>
            — fila SQLite + worker opcional <code style={{ fontSize: 11 }}>INTEGRATION_SYNC_WORKER=1</code>
          </span>
        </div>
      )}

      {store && (
        <div
          className="glass-card"
          style={{
            padding: '14px 18px',
            marginBottom: 18,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            alignItems: 'center',
            border: '1px solid rgba(148,163,184,0.2)',
          }}
        >
          <span style={{ fontWeight: 800, color: '#e2e8f0' }}>Loja (horário)</span>
          <span style={{ color: store.openNow ? '#86efac' : '#fca5a5', fontWeight: 800 }}>
            {store.openNow ? 'Aberta agora' : 'Fechada agora'}
          </span>
          {store.window && (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              Janela: {store.window.open}–{store.window.close}
              {store.window.overnight ? ' (vira o dia)' : ''}
            </span>
          )}
          {stRules && (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              Bloqueio de novos pedidos: <b style={{ color: stRules.orders_blocked_now ? '#fca5a5' : '#86efac' }}>{stRules.orders_blocked_now ? 'ativo' : 'inativo'}</b>
              {' · '}
              Modo: {stRules.mode === 'ia' ? 'assistido (IA)' : 'manual'}
              {stRules.sync_integrations ? ' · sync integrações ligado' : ''}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 18, marginBottom: 24 }}>
        {[
          { label: 'Pedidos hoje (amostra)', value: pedidosHoje },
          { label: 'Em preparo (total)', value: emPreparo },
          { label: 'Prontos (total)', value: prontos },
          { label: 'Motoboys na fila', value: motoboysFila },
          { label: 'Fila KDS (novo+prep+pronto)', value: kds.length },
        ].map((m) => (
          <div key={m.label} className="glass-card" style={{ padding: 20 }}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
          </div>
        ))}
      </div>

      {ai?.alerts?.length > 0 && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16, border: '1px solid rgba(251,191,36,0.35)' }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Alertas (IA regras)</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#fcd34d' }}>
            {ai.alerts.map((a, i) => (
              <li key={i}>{typeof a === 'string' ? a : a.message || JSON.stringify(a)}</li>
            ))}
          </ul>
        </div>
      )}

      {ai?.suggestions?.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Sugestões</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1' }}>
            {ai.suggestions.map((s, i) => (
              <li key={i}>{typeof s === 'string' ? s : s.message || JSON.stringify(s)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
