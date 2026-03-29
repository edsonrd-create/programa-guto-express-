import React from 'react';
import '../kds-card.css';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function statusLabel(status) {
  const s = String(status || '');
  if (s === 'novo') return 'Novo';
  if (s === 'em_preparo') return 'Em preparo';
  if (s === 'pronto') return 'Pronto';
  return s;
}

/**
 * @param {{ pedido: object, busy: boolean, onStart: (id:number)=>void, onReady: (id:number)=>void }} props
 */
export function KdsOrderCard({ pedido, busy, onStart, onReady }) {
  const o = pedido;
  const id = o.id;

  return (
    <div className="kds-card">
      <div className="kds-header">
        <div>
          <h2>Pedido #{id}</h2>
          <p>{o.createdAt || '—'}</p>
          <span className="kds-status-pill">{statusLabel(o.status)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {o.status === 'novo' && (
            <button type="button" className="btn-preparo" disabled={busy} onClick={() => onStart(id)}>
              Iniciar preparo
            </button>
          )}
          {o.status === 'em_preparo' && (
            <button type="button" className="btn-pronto" disabled={busy} onClick={() => onReady(id)}>
              Marcar pronto
            </button>
          )}
          {o.status === 'pronto' && <span className="kds-ready-label">Pronto para expedição</span>}
        </div>
      </div>

      <div className="kds-info">
        <p>
          <strong>Cliente:</strong> {o.customer?.name ?? '—'}
        </p>
        <p>
          <strong>E-mail:</strong> {o.customer?.email && o.customer.email !== '-' ? o.customer.email : '—'}
        </p>
        <p>
          <strong>Telefone:</strong> {o.customer?.phone ?? '—'}
        </p>
        <p>
          <strong>Canal:</strong> {o.channel ?? '—'}
        </p>
        <p>
          <strong>Entrega:</strong> {o.deliveryType ?? '—'}
        </p>
        <p>
          <strong>Pagamento:</strong> {o.paymentMethod ?? '—'}
        </p>
        <p>
          <strong>Faixa entrega:</strong> {o.deliveryRange ?? '—'}
        </p>
        <p>
          <strong>Taxa:</strong> {money(o.deliveryFee)}
        </p>
        <p style={{ gridColumn: '1 / -1' }}>
          <strong>Endereço:</strong> {o.address?.full || '—'}
        </p>
      </div>

      <div className="kds-items">
        {(o.items || []).map((item, idx) => (
          <div key={idx} className="item-card">
            <div className="item-top">
              <strong>
                {item.quantity ?? 1}x {item.name ?? 'Item'}
              </strong>
              <span>{money(item.price)}</span>
            </div>
            {item.description ? <div className="item-desc">{item.description}</div> : null}

            {item.flavors?.length > 0 && (
              <div className="item-section">
                <strong>Sabores:</strong>
                <ul>
                  {item.flavors.map((fl, i) => (
                    <li key={i}>{fl}</li>
                  ))}
                </ul>
              </div>
            )}

            {item.addons?.length > 0 && (
              <div className="item-section">
                <strong>Adicionais:</strong>
                <ul>
                  {item.addons.map((addon, i) => (
                    <li key={i}>
                      {addon.name} — {money(addon.price)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.linkedItems?.length > 0 && (
              <div className="item-section">
                <strong>Itens vinculados:</strong>
                <ul>
                  {item.linkedItems.map((linked, i) => (
                    <li key={i}>
                      {linked.name} — {money(linked.price)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="kds-footer">
        <p>
          <strong>Subtotal:</strong> {money(o.subtotal)}
        </p>
        <p>
          <strong>Taxa entrega:</strong> {money(o.deliveryFee)}
        </p>
        <p>
          <strong>Total:</strong> {money(o.total)}
        </p>
      </div>
    </div>
  );
}
