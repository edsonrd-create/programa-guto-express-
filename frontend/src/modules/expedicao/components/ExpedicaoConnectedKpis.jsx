export default function ExpedicaoConnectedKpis({ kpis }) {
  const items = [
    { label: 'Pedidos prontos', value: kpis.readyCount, sub: 'Aguardando expedição' },
    { label: 'Prontos urgentes', value: kpis.urgentCount, sub: '≥ 20 min parados' },
    { label: 'Agrupamentos no plano', value: kpis.groupSuggestions, sub: 'Rotas com 2+ paradas' },
    { label: 'Motoboys na fila', value: kpis.queueCount, sub: 'Disponíveis p/ despacho' },
    { label: 'Tempo médio parado', value: `${kpis.avgWaitMin} min`, sub: 'Fila prontos' },
    { label: 'Despachos hoje', value: kpis.dispatchToday, sub: 'Entregas atribuídas (dia)' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 14,
        marginBottom: 20,
      }}
      className="expedicao-kpis"
    >
      {items.map((k) => (
        <div
          key={k.label}
          style={{
            backgroundColor: 'rgba(17,24,39,0.95)',
            border: '1px solid #1f2937',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 13 }}>{k.label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10, color: '#f8fafc' }}>{k.value}</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{k.sub}</div>
        </div>
      ))}
      <style>{`
        @media (max-width: 1300px) {
          .expedicao-kpis { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 800px) {
          .expedicao-kpis { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
