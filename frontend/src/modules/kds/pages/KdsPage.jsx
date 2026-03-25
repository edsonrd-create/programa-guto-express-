import React from 'react';
import { kdsService } from '../../../services/kds.service.js';

function errMsg(e) {
  return e?.body?.message || e?.message || 'Erro';
}

export default function KdsPage() {
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(0);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      setRows(await kdsService.queue());
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  async function startPrep(id) {
    setBusy(id);
    setErr('');
    try {
      await kdsService.start(id);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(0);
  }

  async function markReady(id) {
    setBusy(id);
    setErr('');
    try {
      await kdsService.ready(id);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(0);
  }

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>KDS — Cozinha</div>
          <div style={{ color: '#94a3b8' }}>Módulo kitchen · API /kds</div>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          Atualizar
        </button>
      </div>
      {err && <div className="err">{err}</div>}
      <div style={{ display: 'grid', gap: 14 }}>
        {rows.map((o) => (
          <div key={o.id} className="glass-card" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ minWidth: 120 }}>
              <div style={{ fontWeight: 800 }}>Pedido #{o.id}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{o.status}</div>
            </div>
            <div style={{ flex: 1, color: '#cbd5e1', fontSize: 13 }}>
              Itens (qty): <b>{o.total_items ?? 0}</b> · Total R$ {Number(o.total_amount || 0).toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {o.status === 'novo' && (
                <button type="button" className="btn" disabled={busy === o.id} onClick={() => startPrep(o.id)}>
                  Iniciar preparo
                </button>
              )}
              {o.status === 'em_preparo' && (
                <button type="button" className="btn" disabled={busy === o.id} onClick={() => markReady(o.id)}>
                  Marcar pronto
                </button>
              )}
              {o.status === 'pronto' && <span style={{ color: '#34d399', fontWeight: 600 }}>Pronto para expedição</span>}
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <div className="glass-card" style={{ padding: 20, color: '#94a3b8' }}>Fila KDS vazia.</div>}
    </div>
  );
}
