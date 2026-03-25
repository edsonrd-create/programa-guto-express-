import React from 'react';
import { apiGet } from '../services/apiClient.js';
import { useOpsSnapshot } from '../contexts/OpsSnapshotContext.jsx';

export function StatusBar() {
  const { transport } = useOpsSnapshot();
  const [ok, setOk] = React.useState(null);
  const [at, setAt] = React.useState(null);

  const ping = React.useCallback(async () => {
    try {
      await apiGet('/health');
      setOk(true);
    } catch {
      setOk(false);
    }
    setAt(new Date());
  }, []);

  React.useEffect(() => {
    ping();
    const id = setInterval(ping, 15000);
    return () => clearInterval(id);
  }, [ping]);

  const label =
    ok === null ? 'Verificando API…' : ok ? 'API online' : 'API offline (suba o backend :3210)';
  const color = ok === null ? '#94a3b8' : ok ? '#34d399' : '#f87171';

  return (
    <div
      style={{
        padding: '8px 24px',
        fontSize: 12,
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(7, 17, 31, 0.6)',
      }}
    >
      <span style={{ color, fontWeight: 700 }}>●</span>
      <span>{label}</span>
      <span style={{ opacity: 0.75, color: transport === 'ws' ? '#6ee7b7' : '#94a3b8' }}>
        Snapshot: {transport === 'ws' ? 'WebSocket' : 'HTTP'}
      </span>
      {at && <span style={{ opacity: 0.7 }}>Último ping: {at.toLocaleTimeString('pt-BR')}</span>}
      <button type="button" className="btn-ghost" onClick={ping} style={{ marginLeft: 'auto' }}>
        Atualizar status
      </button>
    </div>
  );
}
