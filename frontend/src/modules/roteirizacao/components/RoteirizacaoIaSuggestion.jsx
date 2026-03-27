import React from 'react';
import { buildGroupingSuggestion } from '../../../services/roteirizacao.service.js';

export default function RoteirizacaoIaSuggestion({ plan, rules, onApply, onReject }) {
  const suggestion = plan ? buildGroupingSuggestion(plan) : null;
  const disabled = rules?.mode === 'manual' || !suggestion;

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Sugestão automática</h2>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>Agrupamento por bairro / clusters do plano atual.</div>
      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(59,130,246,0.45)',
          borderLeft: '4px solid #3b82f6',
          background: 'rgba(15,23,42,0.75)',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Reotimização sugerida</h3>
        {suggestion ? (
          <>
            <div style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.55 }}>
              Agrupar pedidos <strong>#{suggestion.orderIds?.join(', #')}</strong>
              {suggestion.driverName && (
                <>
                  {' '}
                  com o motoboy <strong>{suggestion.driverName}</strong>
                </>
              )}
              {suggestion.neighborhood && (
                <>
                  {' '}
                  no bairro <strong>{suggestion.neighborhood}</strong>
                </>
              )}
              . Ganho estimado de operações: <strong>~{suggestion.estimatedMinutesSaved} min</strong>.
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>{suggestion.rationale}</div>
          </>
        ) : (
          <div style={{ color: '#94a3b8' }}>Execute “Otimizar agora” para gerar recomendações.</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn" disabled={disabled} onClick={() => onApply?.(suggestion)}>
          Aplicar sugestão
        </button>
        <button type="button" className="btn-ghost" onClick={() => onReject?.()}>
          Rejeitar
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginTop: 16,
        }}
        className="roteiriza-mini-stat"
      >
        {[
          { label: 'Rotas no plano', value: plan?.routes?.length ?? 0, sub: 'Última otimização' },
          { label: 'Ganho estimado', value: suggestion ? `~${suggestion.estimatedMinutesSaved} min` : '—', sub: 'Operação' },
          { label: 'Modo', value: rules?.mode === 'manual' ? 'Manual' : 'IA', sub: 'Configurado' },
        ].map((x) => (
          <div
            key={x.label}
            style={{
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid #1e293b',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{x.label}</div>
            <strong style={{ display: 'block', fontSize: 20, marginTop: 8 }}>{x.value}</strong>
            <span style={{ color: '#64748b', fontSize: 12 }}>{x.sub}</span>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 800px) {
          .roteiriza-mini-stat { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
