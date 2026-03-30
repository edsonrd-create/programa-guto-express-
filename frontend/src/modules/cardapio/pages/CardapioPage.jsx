import React from 'react';
import { menuService } from '../../../services/menu.service.js';

export default function CardapioPage() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [busyId, setBusyId] = React.useState(null);
  const [newRow, setNewRow] = React.useState({
    name: '',
    unit_price: '0',
    sort_order: '0',
    notes: '',
    active: true,
  });

  async function reload() {
    setErr('');
    const data = await menuService.listManage();
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setErr(e.body?.message || e.message || 'Erro ao carregar cardápio');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setErr('');
    try {
      await menuService.create({
        name: newRow.name.trim(),
        unit_price: Number(newRow.unit_price) || 0,
        sort_order: Number.parseInt(newRow.sort_order, 10) || 0,
        notes: newRow.notes.trim() || null,
        active: Boolean(newRow.active),
      });
      setNewRow({ name: '', unit_price: '0', sort_order: '0', notes: '', active: true });
      await reload();
    } catch (e) {
      const issues = e.body?.issues;
      setErr(
        Array.isArray(issues) && issues.length
          ? issues.map((i) => `${i.path}: ${i.message}`).join('; ')
          : e.body?.message || e.message,
      );
    }
  }

  async function patchItem(id, body) {
    setBusyId(id);
    setErr('');
    try {
      await menuService.update(id, body);
      await reload();
    } catch (e) {
      const issues = e.body?.issues;
      setErr(
        Array.isArray(issues) && issues.length
          ? issues.map((i) => `${i.path}: ${i.message}`).join('; ')
          : e.body?.message || e.message,
      );
    } finally {
      setBusyId(null);
    }
  }

  function updateLocal(id, field, value) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
  }

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Cardápio</div>
      <div style={{ color: '#94a3b8', marginBottom: 16 }}>
        Itens do catálogo (`menu_items`). Desativar = oculto no atendimento.
      </div>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="glass-card" style={{ padding: 20, marginBottom: 20, maxWidth: 640 }}>
        <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>NOVO ITEM</div>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 10 }}>
          <input
            className="input"
            placeholder="Nome"
            value={newRow.name}
            onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
            required
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              style={{ maxWidth: 140 }}
              placeholder="Preço"
              value={newRow.unit_price}
              onChange={(e) => setNewRow((r) => ({ ...r, unit_price: e.target.value }))}
            />
            <input
              className="input"
              type="number"
              style={{ maxWidth: 100 }}
              placeholder="Ordem"
              value={newRow.sort_order}
              onChange={(e) => setNewRow((r) => ({ ...r, sort_order: e.target.value }))}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={newRow.active}
                onChange={(e) => setNewRow((r) => ({ ...r, active: e.target.checked }))}
              />
              Ativo
            </label>
          </div>
          <input
            className="input"
            placeholder="Notas (opcional)"
            value={newRow.notes}
            onChange={(e) => setNewRow((r) => ({ ...r, notes: e.target.value }))}
          />
          <button type="submit" className="btn">
            Adicionar
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8' }}>A carregar…</div>
      ) : (
        <div className="glass-card" style={{ padding: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                <th style={{ padding: 8 }}>Nome</th>
                <th style={{ padding: 8 }}>Preço</th>
                <th style={{ padding: 8 }}>Ordem</th>
                <th style={{ padding: 8 }}>Ativo</th>
                <th style={{ padding: 8 }}>Notas</th>
                <th style={{ padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: 8 }}>
                    <input
                      className="input"
                      style={{ minWidth: 160 }}
                      value={it.name}
                      onChange={(e) => updateLocal(it.id, 'name', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      style={{ width: 100 }}
                      value={it.unitPrice}
                      onChange={(e) => updateLocal(it.id, 'unitPrice', Number(e.target.value))}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      className="input"
                      type="number"
                      style={{ width: 72 }}
                      value={it.sortOrder}
                      onChange={(e) => updateLocal(it.id, 'sortOrder', Number.parseInt(e.target.value, 10) || 0)}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(it.active)}
                      onChange={(e) => updateLocal(it.id, 'active', e.target.checked)}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      className="input"
                      style={{ minWidth: 120 }}
                      value={it.notes ?? ''}
                      onChange={(e) => updateLocal(it.id, 'notes', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === it.id}
                      onClick={() =>
                        patchItem(it.id, {
                          name: it.name.trim(),
                          unit_price: Number(it.unitPrice) || 0,
                          sort_order: Number.parseInt(it.sortOrder, 10) || 0,
                          active: Boolean(it.active),
                          notes: (it.notes || '').trim() || null,
                        })
                      }
                    >
                      Guardar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div style={{ color: '#94a3b8', padding: 16 }}>Sem itens. Adicione acima ou use texto livre no atendimento.</div>
          )}
        </div>
      )}
    </div>
  );
}
