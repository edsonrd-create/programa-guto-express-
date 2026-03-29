import React from 'react';
import { Link } from 'react-router-dom';
import { apiGet, getApiPublicBase } from '../../../services/apiClient.js';

const LINKS = [
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/kds', label: 'KDS' },
  { to: '/integracoes', label: 'Integrações' },
  { to: '/expedicao', label: 'Expedição' },
  { to: '/roteirizacao', label: 'Roteirização' },
  { to: '/configuracoes', label: 'Configurações' },
];

export default function DevTestPage() {
  const [health, setHealth] = React.useState(null);
  const [snap, setSnap] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const base = getApiPublicBase();

  const ping = React.useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const h = await apiGet('/health');
      setHealth(h);
      const s = await apiGet('/ops/snapshot');
      setSnap(s);
    } catch (e) {
      setErr(e?.message || String(e));
      setHealth(null);
      setSnap(null);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void ping();
  }, [ping]);

  return (
    <div style={{ padding: 24, maxWidth: 900 }} className="fade-up">
      <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>Tela de teste rápido</h1>
      <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14 }}>
        Base API: <code style={{ color: '#93c5fd' }}>{base || '(relativa — Vite proxy)'}</code>
      </p>

      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button type="button" className="btn" disabled={loading} onClick={() => void ping()}>
            {loading ? 'Testando…' : 'Testar API de novo'}
          </button>
          <span style={{ color: '#64748b', fontSize: 13 }}>
            GET <code>/health</code> + <code>/ops/snapshot</code>
          </span>
        </div>
        {health && (
          <>
            {(health.version || health.node) && (
              <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: '#94a3b8' }}>
                {health.version && (
                  <>
                    Backend <strong style={{ color: '#e2e8f0' }}>v{health.version}</strong>
                  </>
                )}
                {health.version && health.node ? ' · ' : null}
                {health.node && <span>Node {health.node}</span>}
              </p>
            )}
            <pre style={{ marginTop: 12, fontSize: 12, color: '#cbd5e1', overflow: 'auto' }}>
              {JSON.stringify(health, null, 2)}
            </pre>
          </>
        )}
        {snap && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', color: '#93c5fd' }}>Snapshot (resumo)</summary>
            <pre style={{ fontSize: 11, color: '#94a3b8', maxHeight: 240, overflow: 'auto' }}>
              {JSON.stringify(
                {
                  orders: snap.orders?.length,
                  deliveries: snap.deliveries?.length,
                  drivers: snap.drivers?.length,
                  driverQueue: snap.driverQueue?.length,
                },
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </div>

      <div className="glass-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Atalhos</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="btn-ghost" style={{ textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
