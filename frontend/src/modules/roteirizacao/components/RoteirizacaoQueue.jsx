import React from 'react';
import { Link } from 'react-router-dom';

function ageMinutes(createdAt) {
  if (!createdAt) return 0;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 60000);
}

function slaClock(isoDate, addMin) {
  if (!addMin || !isoDate) return '—';
  const base = new Date(isoDate).getTime();
  if (Number.isNaN(base)) return '—';
  const t = new Date(base + addMin * 60000);
  return t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function badgeStyle(kind) {
  const m = {
    ifood: { bg: '#451a03', fg: '#fdba74' },
    site: { bg: '#172554', fg: '#93c5fd' },
    whats: { bg: '#14532d', fg: '#86efac' },
    panel: { bg: '#1e293b', fg: '#cbd5e1' },
  };
  return m[kind] || m.panel;
}

export default function RoteirizacaoQueue({
  orders,
  plan,
  busyId,
  onDispatch,
  onGroupHint,
  mode,
}) {
  const ready = (orders || []).filter((o) => o.status === 'pronto');

  function suggestForOrder(orderId) {
    if (!plan?.routes?.length) return 'Execute “Otimizar agora” para gerar sugestões.';
    for (const r of plan.routes) {
      if (r.deliveryOrder?.includes(orderId)) {
        const d = r.suggestedDriver;
        return d ? `Motoboy sugerido: ${d.name} · ${r.id}` : `Incluído em ${r.id} (${r.direction})`;
      }
    }
    return 'Sem rota ativa — otimize ou verifique lat/lng do pedido.';
  }

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Fila de expedição</h2>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>
        Pedidos em <b style={{ color: '#e2e8f0' }}>pronto</b> aguardando despacho (modo {mode === 'manual' ? 'manual' : 'assistido'}
        ).
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {ready.map((o) => {
          const am = Math.round(ageMinutes(o.created_at));
          const urgent = am >= 20;
          const ch = 'panel';
          const b = badgeStyle(ch);
          return (
            <div
              key={o.id}
              style={{
                background: 'rgba(15,23,42,0.85)',
                border: '1px solid #1e293b',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  #{o.id} — {o.client_name || 'Cliente'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '5px 9px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: b.bg,
                      color: b.fg,
                    }}
                  >
                    Painel
                  </span>
                  {urgent && (
                    <span
                      style={{
                        padding: '5px 9px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#7f1d1d',
                        color: '#fca5a5',
                      }}
                    >
                      Urgente
                    </span>
                  )}
                </div>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                Bairro: {o.delivery_neighborhood || '—'}
                <br />
                Endereço: {o.delivery_address || '—'}
                <br />
                Pronto há: {am} min
                <br />
                SLA estimado: {slaClock(o.created_at, o.estimated_delivery_minutes)}
                <br />
                Sugestão: {suggestForOrder(o.id)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === o.id}
                  onClick={() => onDispatch(o.id)}
                >
                  Despachar
                </button>
                <button type="button" className="btn-ghost" onClick={() => onGroupHint(o.id)}>
                  Agrupar
                </button>
                <Link
                  to="/pedidos"
                  className="btn-ghost"
                  style={{ fontSize: 14, textDecoration: 'none', display: 'inline-block' }}
                  title="Abrir Pedidos para alterar status, endereço e destino no mapa"
                >
                  Pedidos
                </Link>
              </div>
            </div>
          );
        })}
        {ready.length === 0 && (
          <div style={{ color: '#94a3b8', padding: 8 }}>Nenhum pedido pronto na fila.</div>
        )}
      </div>
    </div>
  );
}
