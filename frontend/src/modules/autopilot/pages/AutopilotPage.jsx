import { useAutopilot } from '../../../hooks/useAutopilot.js';

export default function AutopilotPage() {
  const { data, error, reload } = useAutopilot(15000);

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>Piloto automático</div>
          <div style={{ color: '#94a3b8' }}>Motor de regras · GET /ai/autopilot</div>
        </div>
        <button type="button" className="btn-ghost" onClick={reload}>
          Atualizar
        </button>
      </div>
      {error && <div className="err">{error}</div>}

      {data && (
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ marginBottom: 12 }}>
            Modo: <b style={{ color: '#93c5fd' }}>{data.mode}</b>
          </div>
          <div style={{ color: '#cbd5e1', marginBottom: 20 }}>{data.message}</div>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Ações sugeridas</div>
          {data.actions?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: '#e2e8f0' }}>
              {data.actions.map((a, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <code style={{ color: '#a5b4fc' }}>{a.type}</code>
                  {a.orderId != null && ` · pedido #${a.orderId}`}
                  {a.driverId != null && ` · motoboy #${a.driverId}`}
                  {a.reason && <div style={{ color: '#94a3b8', fontSize: 13 }}>{a.reason}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#94a3b8' }}>Nenhuma ação na fila.</div>
          )}
        </div>
      )}
    </div>
  );
}
