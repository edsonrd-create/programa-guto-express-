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
