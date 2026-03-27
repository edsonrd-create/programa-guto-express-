import React from 'react';
import { buildExternalOptimizationPayload } from '../../../services/routeOptimizationAdapter.js';
import { defaultRoutingRules } from '../hooks/useRoteirizacaoLive.js';

export default function RoteirizacaoRulesPanel({ rules, setRules, config, onSave, busy }) {
  const [extNote, setExtNote] = React.useState('');

  async function previewExternal() {
    const store = config?.store || { lat: -25.4284, lng: -49.2733, label: 'Loja' };
    const payload = await buildExternalOptimizationPayload({
      store,
      stops: [],
      vehicles: [],
    });
    setExtNote(JSON.stringify(payload, null, 2));
  }

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Regras operacionais</h2>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>
        Parâmetros persistidos no navegador e aplicados em <code>/routing/plan</code>.
        {config?.routingGoogleMapsAuto === false && (
          <div style={{ marginTop: 10, color: '#fde68a', fontSize: 13 }}>
            O servidor está com <b>Google Maps automático desligado</b> — o enriquecimento de rotas fica sempre off até
            ligar no painel acima ou em Configurações.
          </div>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Janela de agrupamento (min)
          <select
            className="input"
            value={String(rules.groupingWindowMin)}
            onChange={(e) => setRules({ groupingWindowMin: Number(e.target.value) })}
          >
            <option value={3}>3 minutos</option>
            <option value={5}>5 minutos</option>
            <option value={7}>7 minutos</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Limite pedidos / motoboy
          <select
            className="input"
            value={String(rules.maxPerCourier)}
            onChange={(e) => setRules({ maxPerCourier: Number(e.target.value) })}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Prioridade SLA
          <select
            className="input"
            value={rules.slaPriority}
            onChange={(e) => setRules({ slaPriority: e.target.value })}
          >
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Modo de roteirização
          <select
            className="input"
            value={rules.mode}
            onChange={(e) => setRules({ mode: e.target.value })}
          >
            <option value="manual">Manual</option>
            <option value="ia">Assistido por IA</option>
            <option value="ia_approval">IA com aprovação</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Raio máximo (km)
          <input
            className="input"
            value={rules.maxRadiusKm}
            onChange={(e) => setRules({ maxRadiusKm: Number(e.target.value) || 8 })}
          />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Google Routes (servidor)
          <select
            className="input"
            value={rules.skipGoogleRoutes ? 'skip' : 'use'}
            onChange={(e) => setRules({ skipGoogleRoutes: e.target.value === 'skip' })}
          >
            <option value="use">Usar enriquecimento se houver API key</option>
            <option value="skip">Só heurística local</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Bloqueio por atraso crítico
          <select
            className="input"
            value={rules.delayBlock ? 'on' : 'off'}
            onChange={(e) => setRules({ delayBlock: e.target.value === 'on' })}
          >
            <option value="off">Desligado</option>
            <option value="on">Ligado</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          Integração futura
          <select
            className="input"
            value={rules.provider}
            onChange={(e) => setRules({ provider: e.target.value })}
          >
            <option value="internal">Interno</option>
            <option value="google_mapbox_ready">Google / Mapbox preparado</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" className="btn" disabled={busy} onClick={onSave}>
          Salvar regras
        </button>
        <button type="button" className="btn-ghost" onClick={() => setRules(defaultRoutingRules())}>
          Restaurar padrão
        </button>
        <button type="button" className="btn-ghost" onClick={() => void previewExternal()}>
          Payload API externa (preview)
        </button>
      </div>
      {extNote && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: '#020617',
            fontSize: 11,
            color: '#94a3b8',
            overflow: 'auto',
            maxHeight: 160,
          }}
        >
          {extNote}
        </pre>
      )}
    </div>
  );
}
