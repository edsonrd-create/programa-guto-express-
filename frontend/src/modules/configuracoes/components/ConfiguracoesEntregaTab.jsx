import React from 'react';
import { deliveryZonesService } from '../../../services/deliveryZones.service.js';

function errMsg(e) {
  const issues = e?.body?.issues;
  if (Array.isArray(issues) && issues.length) return issues.map((i) => `${i.path}: ${i.message}`).join('; ');
  return e?.body?.message || e?.message || 'Erro';
}

function brl(n) {
  const x = Number(n) || 0;
  return x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function priorityStyle(p) {
  if (p === 'high') return { color: '#fca5a5', fontWeight: 800 };
  if (p === 'medium') return { color: '#fde68a', fontWeight: 800 };
  return { color: '#86efac', fontWeight: 800 };
}

function priorityLabel(p) {
  const m = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  return m[p] || p;
}

const emptyEditor = {
  name: '',
  delivery_fee: '6',
  avg_minutes: '35',
  min_order_amount: '25',
  active: true,
  priority: 'medium',
  notes: '',
  mode: 'manual',
};

export default function ConfiguracoesEntregaTab() {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [zones, setZones] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  const [filters, setFilters] = React.useState({ q: '', status: '', mode: '', priority: '' });
  const [editor, setEditor] = React.useState({ ...emptyEditor });
  const [editingId, setEditingId] = React.useState(null);
  const [history, setHistory] = React.useState(null);
  const [suggestion, setSuggestion] = React.useState(null);
  const [bulk, setBulk] = React.useState({
    open: false,
    active_only: true,
    add_delivery_fee: '',
    multiply_delivery_fee: '',
    set_delivery_fee: '',
    set_avg_minutes: '',
    reason: 'Ajuste em massa — pizzaria',
  });

  const load = React.useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await deliveryZonesService.list(filters);
      setZones(res.zones || []);
      setSummary(res.summary || null);
    } catch (e) {
      setErr(errMsg(e));
    }
    setLoading(false);
  }, [filters]);

  React.useEffect(() => {
    load();
  }, [load]);

  function selectZone(z) {
    if (!z) {
      setEditingId(null);
      setEditor({ ...emptyEditor });
      setSuggestion(null);
      return;
    }
    setEditingId(z.id);
    setEditor({
      name: z.name,
      delivery_fee: String(z.delivery_fee),
      avg_minutes: String(z.avg_minutes),
      min_order_amount: String(z.min_order_amount),
      active: z.active,
      priority: z.priority,
      notes: z.notes || '',
      mode: z.mode,
    });
    setSuggestion(null);
  }

  async function saveZone() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const body = {
        name: editor.name.trim(),
        delivery_fee: Number(editor.delivery_fee),
        avg_minutes: Number(editor.avg_minutes),
        min_order_amount: Number(editor.min_order_amount),
        active: Boolean(editor.active),
        priority: editor.priority,
        notes: editor.notes,
        mode: editor.mode,
        reason: editingId ? 'Edição painel' : 'Novo bairro',
      };
      if (editingId) {
        await deliveryZonesService.update(editingId, body);
        setMsg('Bairro atualizado.');
      } else {
        const res = await deliveryZonesService.create(body);
        setMsg(`Bairro criado (#${res.zone?.id}).`);
        if (res.zone?.id) selectZone(res.zone);
      }
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function loadHistory(id) {
    setBusy(true);
    setErr('');
    try {
      const res = await deliveryZonesService.history(id);
      setHistory({ id, rows: res.history || [] });
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function loadAi(id) {
    setBusy(true);
    setErr('');
    try {
      const res = await deliveryZonesService.aiSuggestion(id);
      setSuggestion(res.suggestion);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function applySuggestion() {
    if (!suggestion || !editingId) return;
    setEditor((e) => ({
      ...e,
      delivery_fee: String(suggestion.suggested_delivery_fee),
      avg_minutes: String(suggestion.suggested_avg_minutes),
    }));
    setMsg('Valores da sugestão aplicados no formulário — clique em Salvar bairro.');
  }

  async function runBulk() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const body = {
        active_only: bulk.active_only,
        reason: bulk.reason || 'Em massa',
      };
      if (bulk.add_delivery_fee !== '') body.add_delivery_fee = Number(bulk.add_delivery_fee);
      if (bulk.multiply_delivery_fee !== '') body.multiply_delivery_fee = Number(bulk.multiply_delivery_fee);
      if (bulk.set_delivery_fee !== '') body.set_delivery_fee = Number(bulk.set_delivery_fee);
      if (bulk.set_avg_minutes !== '') body.set_avg_minutes = Number(bulk.set_avg_minutes);
      const res = await deliveryZonesService.bulk(body);
      setMsg(`Em massa: ${res.count} bairro(s) atualizado(s).`);
      setBulk((b) => ({ ...b, open: false }));
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function doExport() {
    setBusy(true);
    setErr('');
    try {
      const res = await deliveryZonesService.exportJson();
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `delivery-zones-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg('Exportação baixada.');
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {err && <div className="err">{err}</div>}
      {msg && <div style={{ color: '#34d399' }}>{msg}</div>}

      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Filtros e ações rápidas</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
            gap: 12,
            marginTop: 14,
            alignItems: 'end',
          }}
          className="entrega-toolbar"
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Buscar bairro</span>
            <input
              className="input"
              placeholder="Ex.: Maracanã, Guaraituba"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Status</span>
            <select className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Modo</span>
            <select className="input" value={filters.mode} onChange={(e) => setFilters((f) => ({ ...f, mode: e.target.value }))}>
              <option value="">Todos</option>
              <option value="manual">Manual</option>
              <option value="ia">Assistido por IA</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Prioridade</span>
            <select className="input" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
              <option value="">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <button type="button" className="btn" onClick={() => load()} disabled={busy}>
            Filtrar
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.85fr)', gap: 20 }} className="entrega-grid">
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Lista de bairros</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
            Taxa e prazo entram automaticamente em pedidos quando o bairro cadastrado coincide com o informado (nome normalizado).
          </div>
          {loading ? (
            <div style={{ color: '#94a3b8' }}>Carregando…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Bairro</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Taxa</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Tempo</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Mín.</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Status</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Prio</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Modo</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr
                      key={z.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: editingId === z.id ? 'rgba(59,130,246,0.08)' : undefined,
                      }}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: 700 }}>{z.name}</td>
                      <td style={{ padding: '12px 8px' }}>{brl(z.delivery_fee)}</td>
                      <td style={{ padding: '12px 8px' }}>{z.avg_minutes} min</td>
                      <td style={{ padding: '12px 8px' }}>{brl(z.min_order_amount)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: z.active ? '#14532d' : '#3f1d1d',
                            color: z.active ? '#86efac' : '#fca5a5',
                          }}
                        >
                          {z.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', ...priorityStyle(z.priority) }}>{priorityLabel(z.priority)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: z.mode === 'ia' ? '#1d4ed8' : '#1e293b',
                            color: z.mode === 'ia' ? '#dbeafe' : '#cbd5e1',
                          }}
                        >
                          {z.mode === 'ia' ? 'IA' : 'Manual'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className="btn-ghost" disabled={busy} onClick={() => selectZone(z)}>
                            Editar
                          </button>
                          <button type="button" className="btn-ghost" disabled={busy} onClick={() => loadHistory(z.id)}>
                            Histórico
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!zones.length && (
                    <tr>
                      <td colSpan={8} style={{ padding: 24, color: '#94a3b8' }}>
                        Nenhum bairro. Cadastre à direita ou importe depois via API.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => load()}>
              Atualizar lista
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setBulk((b) => ({ ...b, open: !b.open }))}>
              Aplicar taxa em massa
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={doExport}>
              Exportar JSON
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                selectZone(null);
              }}
            >
              Novo bairro
            </button>
          </div>
          {bulk.open && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 12, border: '1px solid rgba(251,191,36,0.35)' }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Alteração em massa (zonas ativas por padrão)</div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, color: '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={bulk.active_only}
                  onChange={(e) => setBulk((b) => ({ ...b, active_only: e.target.checked }))}
                />
                Somente bairros ativos
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  className="input"
                  placeholder="Somar na taxa (R$)"
                  value={bulk.add_delivery_fee}
                  onChange={(e) => setBulk((b) => ({ ...b, add_delivery_fee: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Multiplicar taxa (ex.: 1.08)"
                  value={bulk.multiply_delivery_fee}
                  onChange={(e) => setBulk((b) => ({ ...b, multiply_delivery_fee: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Definir taxa fixa (R$)"
                  value={bulk.set_delivery_fee}
                  onChange={(e) => setBulk((b) => ({ ...b, set_delivery_fee: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Definir tempo médio (min)"
                  value={bulk.set_avg_minutes}
                  onChange={(e) => setBulk((b) => ({ ...b, set_avg_minutes: e.target.value }))}
                />
              </div>
              <input
                className="input"
                style={{ marginTop: 10 }}
                placeholder="Motivo (auditoria)"
                value={bulk.reason}
                onChange={(e) => setBulk((b) => ({ ...b, reason: e.target.value }))}
              />
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn" disabled={busy} onClick={runBulk}>
                  Executar em massa
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Cadastrar / editar bairro</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>{editingId ? `ID #${editingId}` : 'Novo cadastro'}</div>

          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Bairro</span>
              <input className="input" value={editor.name} onChange={(e) => setEditor((x) => ({ ...x, name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Taxa de entrega (R$)</span>
              <input className="input" value={editor.delivery_fee} onChange={(e) => setEditor((x) => ({ ...x, delivery_fee: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Tempo médio (min)</span>
              <input className="input" type="number" min={5} value={editor.avg_minutes} onChange={(e) => setEditor((x) => ({ ...x, avg_minutes: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Pedido mínimo (R$)</span>
              <input
                className="input"
                value={editor.min_order_amount}
                onChange={(e) => setEditor((x) => ({ ...x, min_order_amount: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#e5e7eb' }}>
              <input type="checkbox" checked={editor.active} onChange={(e) => setEditor((x) => ({ ...x, active: e.target.checked }))} />
              Ativo (desmarque para suspender temporariamente)
            </label>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Prioridade logística</span>
              <select className="input" value={editor.priority} onChange={(e) => setEditor((x) => ({ ...x, priority: e.target.value }))}>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Modo</span>
              <select className="input" value={editor.mode} onChange={(e) => setEditor((x) => ({ ...x, mode: e.target.value }))}>
                <option value="manual">Manual</option>
                <option value="ia">Assistido por IA</option>
              </select>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Observação operacional</span>
              <textarea className="input" style={{ minHeight: 72 }} value={editor.notes} onChange={(e) => setEditor((x) => ({ ...x, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" className="btn" disabled={busy} onClick={saveZone}>
              Salvar bairro
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                if (editingId) {
                  const z = zones.find((x) => x.id === editingId);
                  if (z) selectZone(z);
                } else setEditor({ ...emptyEditor });
              }}
            >
              Restaurar formulário
            </button>
            {editingId && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => loadAi(editingId)}>
                Pedir sugestão (IA)
              </button>
            )}
          </div>

          {suggestion && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 14,
                border: '1px solid rgba(59,130,246,0.45)',
                borderLeft: '4px solid #3b82f6',
                background: 'rgba(15,23,42,0.75)',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Sugestão da IA</div>
              <div style={{ color: '#e2e8f0', fontSize: 14 }}>
                Taxa sugerida: <b>{brl(suggestion.suggested_delivery_fee)}</b> (era {brl(suggestion.baseline?.delivery_fee)}). Tempo:{' '}
                <b>{suggestion.suggested_avg_minutes} min</b> (era {suggestion.baseline?.avg_minutes}).
              </div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>{suggestion.rationale}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button type="button" className="btn" disabled={busy} onClick={applySuggestion}>
                  Aplicar no formulário
                </button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => setSuggestion(null)}>
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Resumo logístico</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="entrega-summary">
            <div style={{ padding: 16, borderRadius: 14, background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Bairros ativos</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>{summary.activeCount}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>de {summary.totalZones} cadastrados</div>
            </div>
            <div style={{ padding: 16, borderRadius: 14, background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Taxa média (ativos)</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>{brl(summary.avgDeliveryFee)}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 14, background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Tempo médio geral</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>{summary.avgMinutesOverall} min</div>
            </div>
          </div>
        </div>
      )}

      {history && (
        <div className="glass-card" style={{ padding: 20, border: '1px solid rgba(148,163,184,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800 }}>Histórico — zona #{history.id}</div>
            <button type="button" className="btn-ghost" onClick={() => setHistory(null)}>
              Fechar
            </button>
          </div>
          <div style={{ maxHeight: 280, overflow: 'auto', marginTop: 12 }}>
            {(history.rows || []).map((h) => (
              <div
                key={h.id}
                style={{
                  padding: 10,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 13,
                  color: '#cbd5e1',
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{h.changed_at}</div>
                {h.reason && <div style={{ marginTop: 4 }}>{h.reason}</div>}
                <pre style={{ margin: '8px 0 0', fontSize: 11, color: '#64748b', whiteSpace: 'pre-wrap' }}>{h.payload_json}</pre>
              </div>
            ))}
            {!history.rows?.length && <div style={{ color: '#94a3b8' }}>Sem registros.</div>}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1100px) {
          .entrega-grid { grid-template-columns: 1fr !important; }
          .entrega-toolbar { grid-template-columns: 1fr !important; }
          .entrega-summary { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
