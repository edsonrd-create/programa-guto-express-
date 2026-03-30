import React from 'react';
import { clientsService } from '../../../services/clients.service.js';
import { ordersService } from '../../../services/orders.service.js';
import { menuService } from '../../../services/menu.service.js';

export default function AtendimentoPage() {
  const [clientName, setClientName] = React.useState('');
  const [clientPhone, setClientPhone] = React.useState('');
  const [catalog, setCatalog] = React.useState([]);
  const [pickId, setPickId] = React.useState('');
  const [itemName, setItemName] = React.useState('Pizza');
  const [qty, setQty] = React.useState(1);
  const [unitPrice, setUnitPrice] = React.useState(49.9);
  const [deliveryFee, setDeliveryFee] = React.useState(0);
  const [neighborhood, setNeighborhood] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await menuService.catalog();
        const items = Array.isArray(data.items) ? data.items : [];
        if (!cancelled) setCatalog(items);
      } catch {
        if (!cancelled) setCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onPickCatalog(e) {
    const id = e.target.value;
    setPickId(id);
    if (!id) return;
    const it = catalog.find((m) => String(m.id) === id);
    if (it) {
      setItemName(it.name);
      setUnitPrice(Number(it.unitPrice) || 0);
    }
  }

  function onItemNameChange(e) {
    setPickId('');
    setItemName(e.target.value);
  }

  function onUnitPriceChange(e) {
    setPickId('');
    setUnitPrice(e.target.value);
  }

  async function submit(e) {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      setErr('Nome e telefone do cliente são obrigatórios.');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const c = await clientsService.create({ name: clientName.trim(), phone: clientPhone.trim() });
      const order = await ordersService.create({
        client_id: c.id,
        total: 0,
        delivery_fee: Number(deliveryFee) || 0,
        delivery_neighborhood: neighborhood.trim() || null,
      });
      const mid = pickId ? Number(pickId) : null;
      await ordersService.addItem(order.id, {
        item_name: itemName.trim(),
        quantity: Number(qty) || 1,
        unit_price: Number(unitPrice) || 0,
        meta: mid ? { menu_item_id: mid } : undefined,
      });
      const eta = order.estimated_delivery_minutes != null ? ` · Prazo estimado ~${order.estimated_delivery_minutes} min` : '';
      const feeNote =
        order.delivery_zone != null
          ? ` · Taxa zona ${order.delivery_zone.name}: R$ ${Number(order.delivery_fee || 0).toFixed(2)}`
          : '';
      setMsg(`Pedido #${order.id} criado para cliente #${c.id}${feeNote}${eta}.`);
      setPickId('');
      setItemName('Pizza');
      setUnitPrice(49.9);
      setQty(1);
    } catch (e) {
      const issues = e.body?.issues;
      setErr(
        Array.isArray(issues) && issues.length
          ? issues.map((i) => `${i.path}: ${i.message}`).join('; ')
          : e.body?.message || JSON.stringify(e.body) || e.message,
      );
    }
    setBusy(false);
  }

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Atendimento</div>
      <div style={{ color: '#94a3b8', marginBottom: 16 }}>
        Cliente + pedido + item. Escolha do cardápio ou texto livre.
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div style={{ color: '#34d399', marginBottom: 12 }}>{msg}</div>}

      <div className="glass-card" style={{ padding: 20, maxWidth: 480 }}>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: 12 }}>CLIENTE</div>
          <input className="input" placeholder="Nome" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <input className="input" placeholder="Telefone (único)" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: 12 }}>ITEM</div>
          <select className="input" value={pickId} onChange={onPickCatalog}>
            <option value="">— Catálogo ou texto livre —</option>
            {catalog.map((it) => (
              <option key={it.id} value={String(it.id)}>
                {it.name} (R$ {Number(it.unitPrice).toFixed(2)})
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Descrição do item"
            value={itemName}
            onChange={onItemNameChange}
          />
          <input className="input" type="number" min={1} placeholder="Qtd" value={qty} onChange={(e) => setQty(e.target.value)} />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Preço unit."
            value={unitPrice}
            onChange={onUnitPriceChange}
          />
          <input
            className="input"
            placeholder="Bairro (opcional — taxa automática se cadastrado)"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
          />
          <input className="input" type="number" step="0.01" placeholder="Taxa entrega (se não houver zona)" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          <button type="submit" className="btn" disabled={busy}>
            Criar pedido
          </button>
        </form>
      </div>
    </div>
  );
}
