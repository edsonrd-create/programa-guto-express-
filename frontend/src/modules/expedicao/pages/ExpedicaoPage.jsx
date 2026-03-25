import React from 'react';
import { dispatchService } from '../../../services/dispatch.service.js';
import { driversService } from '../../../services/drivers.service.js';
import { RoutingPanel } from '../components/RoutingPanel.jsx';

function errMsg(e) {
  return e?.body?.message || e?.message || 'Erro';
}

function DispatchPanel() {
  const [deliveries, setDeliveries] = React.useState([]);
  const [readyOrders, setReadyOrders] = React.useState([]);
  const [queue, setQueue] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(0);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const [d, disp, q] = await Promise.all([
        dispatchService.listDeliveries(),
        dispatchService.listDispatchOrders(),
        driversService.queue(),
      ]);
      setDeliveries(d);
      setReadyOrders(disp.filter((o) => o.status === 'pronto'));
      setQueue(q);
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function assign(orderId) {
    setBusy(orderId);
    setErr('');
    try {
      await dispatchService.assignNext(orderId);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(0);
  }

  async function send(orderId) {
    setBusy(orderId);
    setErr('');
    try {
      await dispatchService.send(orderId);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(0);
  }

  async function delivered(orderId) {
    setBusy(orderId);
    setErr('');
    try {
      await dispatchService.markDelivered(orderId);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(0);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Expedição & entregas</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Módulo delivery · /dispatch + fila /drivers/queue</div>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          Atualizar
        </button>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Fila de motoboys ativos</div>
        {queue.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>Ninguém na fila — cadastre motorista e faça check-in.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1' }}>
            {queue.map((q) => (
              <li key={q.id}>
                #{q.driver_id} {q.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ fontWeight: 700, marginBottom: 10 }}>Pedidos prontos (atribuir)</div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        {readyOrders.map((o) => (
          <div key={o.id} className="glass-card" style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>#{o.id}</span>
            <button type="button" className="btn" disabled={busy === o.id} onClick={() => assign(o.id)}>
              Atribuir próximo da fila
            </button>
          </div>
        ))}
        {readyOrders.length === 0 && <div style={{ color: '#94a3b8' }}>Nenhum pedido em status &quot;pronto&quot;.</div>}
      </div>

      <div style={{ fontWeight: 700, marginBottom: 10 }}>Entregas</div>
      <div className="glass-card table-wrap">
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
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.order_id}</td>
                <td>{d.driver_name || d.driver_id}</td>
                <td>{d.status}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {d.status === 'aguardando_motoboy' && (
                    <button type="button" className="btn" disabled={busy === d.order_id} onClick={() => send(d.order_id)}>
                      Saiu
                    </button>
                  )}
                  {d.status === 'em_entrega' && (
                    <button type="button" className="btn btn-danger" disabled={busy === d.order_id} onClick={() => delivered(d.order_id)}>
                      Entregue
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deliveries.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>Sem entregas registradas.</div>}
      </div>
    </div>
  );
}

export default function ExpedicaoPage() {
  const [tab, setTab] = React.useState('expedicao');

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Expedição</div>
      <div className="tab-bar">
        <button type="button" className={tab === 'expedicao' ? 'tab tab-active' : 'tab'} onClick={() => setTab('expedicao')}>
          Fila & entregas
        </button>
        <button type="button" className={tab === 'rotas' ? 'tab tab-active' : 'tab'} onClick={() => setTab('rotas')}>
          Roteirização
        </button>
      </div>
      {tab === 'expedicao' ? <DispatchPanel /> : <RoutingPanel />}
    </div>
  );
}
