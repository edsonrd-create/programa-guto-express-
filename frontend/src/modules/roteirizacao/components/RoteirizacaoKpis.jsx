import React from 'react';

function ageMinutes(createdAt) {
  if (!createdAt) return 0;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 60000);
}

export default function RoteirizacaoKpis({ orders, deliveries, queue, rules }) {
  const prontos = (orders || []).filter((o) => o.status === 'pronto');
  const aguard = (orders || []).filter((o) => o.status === 'aguardando_motoboy');
  const aguardExp = prontos.length + aguard.length;
  const urgentThreshold =
    rules?.slaPriority === 'high' ? 18 : rules?.slaPriority === 'medium' ? 25 : 32;
  const urgentes = prontos.filter((o) => ageMinutes(o.created_at) >= urgentThreshold).length;
  const emRota = (deliveries || []).filter((d) => d.status === 'em_entrega').length;
  const disponiveis = (queue || []).length;
  const motivosAtivos = (deliveries || []).filter(
    (d) => d.status === 'em_entrega' && d.driver_id,
  ).length;
  const atraso = prontos.filter((o) => {
    const am = ageMinutes(o.created_at);
    const eta = o.estimated_delivery_minutes != null ? Number(o.estimated_delivery_minutes) : 45;
    return am > eta * 0.85;
  }).length;
  const mins = prontos
    .map((o) => (o.estimated_delivery_minutes != null ? Number(o.estimated_delivery_minutes) : null))
    .filter((x) => x != null);
  const avgMin = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
  const fees = prontos.map((o) => Number(o.delivery_fee || 0));
  const avgFee = fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : 0;

  const cells = [
    { label: 'Aguardando expedição', value: String(aguardExp), sub: `${urgentes} urgentes (SLA)` },
    { label: 'Em rota', value: String(emRota), sub: `${motivosAtivos} motoboys em entrega` },
    { label: 'Na fila (FIFO)', value: String(disponiveis), sub: 'Prontos para despacho' },
    { label: 'Risco de atraso', value: String(atraso), sub: 'Pedidos prontos críticos' },
    { label: 'Tempo médio (cadastro)', value: avgMin ? `${avgMin} min` : '—', sub: 'Zona / pedido' },
    { label: 'Taxa média (prontos)', value: avgFee ? `R$ ${avgFee.toFixed(2)}` : '—', sub: 'Amostra atual' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          className="glass-card"
          style={{ padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div style={{ color: '#94a3b8', fontSize: 13 }}>{c.label}</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 10 }}>{c.value}</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
