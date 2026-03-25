import { Link } from 'react-router-dom';
import { useOpsSnapshot } from '../../../hooks/useOpsSnapshot.js';

export default function LiveOpsPage() {
  const { data, error } = useOpsSnapshot();
  const kds = data?.kds ?? [];

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>Live Ops</div>
          <div style={{ color: '#94a3b8' }}>Fila cozinha (snapshot) · ações em </div>
        </div>
        <Link to="/kds" className="btn">
          Abrir KDS completo
        </Link>
      </div>
      {error && <div className="err">{error}</div>}

      <div style={{ display: 'grid', gap: 12 }}>
        {kds.map((o) => (
          <div key={o.id} className="glass-card" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ minWidth: 120 }}>
              <div style={{ fontWeight: 800 }}>#{o.id}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{o.status}</div>
            </div>
            <div style={{ flex: 1, color: '#cbd5e1', fontSize: 13 }}>
              Itens: <b>{o.total_items ?? 0}</b> · Total R$ {Number(o.total_amount || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Somente leitura aqui — use KDS para avançar estados</div>
          </div>
        ))}
      </div>
      {kds.length === 0 && <div className="glass-card" style={{ padding: 20, color: '#94a3b8' }}>Nada na fila KDS.</div>}
    </div>
  );
}
