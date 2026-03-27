import React from 'react';

export default function RoteirizacaoCouriersPanel({ drivers, queue, deliveries }) {
  const activeDeliveryByDriver = {};
  for (const d of deliveries || []) {
    if (d.status === 'em_entrega' && d.driver_id) {
      activeDeliveryByDriver[d.driver_id] = (activeDeliveryByDriver[d.driver_id] || 0) + 1;
    }
  }

  const queuedIds = new Set((queue || []).map((q) => q.driver_id));

  const rows = (drivers || []).filter((d) => ['disponivel', 'fila', 'carregando', 'em_entrega', 'retornando'].includes(d.status));

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>Motoboys</div>
      {rows.map((d) => {
        const inQ = queuedIds.has(d.id);
        const active = activeDeliveryByDriver[d.id] || 0;
        let badge = 'Disponível';
        let bg = '#1e3a8a';
        let fg = '#bfdbfe';
        if (d.status === 'em_entrega') {
          badge = 'Em rota';
        } else if (d.status === 'retornando') {
          badge = 'Retornando';
        } else if (inQ) {
          badge = 'Na fila FIFO';
        }
        if (d.status === 'retornando') {
          bg = '#713f12';
          fg = '#fde68a';
        }
        return (
          <div
            key={d.id}
            style={{
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid #1e293b',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 800 }}>{d.name || `Motorista #${d.id}`}</div>
              <span
                style={{
                  padding: '5px 9px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: bg,
                  color: fg,
                }}
              >
                {badge}
              </span>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
              Capacidade sugerida: 3 pedidos
              <br />
              Em rota (entregas ativas): {active}
              <br />
              Score operacional: {Math.min(99, 80 + (inQ ? 8 : 0) - active * 5)}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>Cadastre motoboys e faça check-in.</div>}
    </div>
  );
}
