import { Link } from 'react-router-dom';
import { useOpsSnapshot } from '../../../hooks/useOpsSnapshot.js';

export default function CommandCenterPage() {
  const { data, error } = useOpsSnapshot();
  const orders = (data?.orders ?? []).slice(0, 22);
  const deliveries = (data?.deliveries ?? []).slice(0, 18);

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Central de comando</div>
      <div style={{ color: '#94a3b8', marginBottom: 20 }}>
        Últimos pedidos e entregas ·{' '}
        <Link to="/pedidos" style={{ color: '#93c5fd' }}>
          abrir pedidos
        </Link>{' '}
        ·{' '}
        <Link to="/expedicao" style={{ color: '#93c5fd' }}>
          expedição
        </Link>
      </div>
      {error && <div className="err">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <div className="glass-card table-wrap">
          <div style={{ padding: '14px 16px', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Pedidos recentes</div>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Total</th>
                <th>Criado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700, color: '#93c5fd' }}>#{o.id}</td>
                  <td>{o.status}</td>
                  <td>R$ {Number(o.total_amount || 0).toFixed(2)}</td>
                  <td style={{ color: '#94a3b8', fontSize: 12 }}>{o.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>Sem pedidos na amostra.</div>}
        </div>

        <div className="glass-card table-wrap">
          <div style={{ padding: '14px 16px', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Entregas recentes</div>
          <table className="data">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Pedido</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.order_id}</td>
                  <td>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deliveries.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>Sem entregas.</div>}
        </div>
      </div>
    </div>
  );
}
