import React from 'react';
import { apiGet } from '../services/apiClient.js';
import { useOpsSnapshot } from '../contexts/OpsSnapshotContext.jsx';

export function StatusBar() {
  const { transport, data } = useOpsSnapshot();
  const [ok, setOk] = React.useState(null);
  const [at, setAt] = React.useState(null);
  const [authStatus, setAuthStatus] = React.useState(null);

  const ping = React.useCallback(async () => {
    try {
      await apiGet('/health');
      setOk(true);
    } catch {
      setOk(false);
    }
    try {
      const st = await apiGet('/auth/status');
      setAuthStatus(st);
    } catch {
      setAuthStatus(null);
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

  const viteKey = (import.meta.env.VITE_ADMIN_API_KEY || '').trim();
  const needsViteKey = Boolean(authStatus?.adminApiKeyConfigured) && !viteKey;

  const st = data?.store;
  const storeLine =
    st &&
    (() => {
      const open = Boolean(st.openNow);
      const r = st.rules;
      const block = r?.orders_blocked_now === true;
      const mode = r?.mode === 'ia' ? 'assistido' : 'manual';
      return (
        <span style={{ opacity: 0.9, whiteSpace: 'nowrap' }} title="Definido em Configurações → Horário">
          Loja:{' '}
          <b style={{ color: open ? '#86efac' : '#fca5a5' }}>{open ? 'aberta' : 'fechada'}</b>
          {r != null && (
            <>
              {' · '}
              bloqueio: <b style={{ color: block ? '#fca5a5' : '#94a3b8' }}>{block ? 'sim' : 'não'}</b>
              {' · '}
              modo: {mode}
            </>
          )}
        </span>
      );
    })();

  return (
    <div
      style={{
        padding: '8px 24px',
        fontSize: 12,
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(7, 17, 31, 0.6)',
      }}
    >
      <span style={{ color, fontWeight: 700 }}>●</span>
      <span>{label}</span>
      {storeLine}
      <span style={{ opacity: 0.92, flexShrink: 0 }}>
        {storeLine ? ' · ' : ''}
        <span style={{ color: transport === 'ws' ? '#6ee7b7' : '#94a3b8' }}>
          Snapshot: {transport === 'ws' ? 'WebSocket' : 'HTTP'}
        </span>
      </span>
      {at && <span style={{ opacity: 0.7 }}>Último ping: {at.toLocaleTimeString('pt-BR')}</span>}
      {needsViteKey && (
        <span
          style={{
            color: '#fbbf24',
            fontWeight: 700,
            maxWidth: 420,
            lineHeight: 1.35,
          }}
          title="O backend exige ADMIN_API_KEY"
        >
          Ação: defina VITE_ADMIN_API_KEY no frontend/.env (igual ao servidor) e reinicie o Vite.
        </span>
      )}
      <button type="button" className="btn-ghost" onClick={ping} style={{ marginLeft: 'auto' }}>
        Atualizar status
      </button>
    </div>
  );
}
