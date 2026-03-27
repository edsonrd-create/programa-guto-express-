import React from 'react';
import { settingsService } from '../../../services/settings.service.js';

/**
 * Interruptor global (SQLite): permite enriquecimento automático das rotas com Google Routes no servidor.
 */
export default function RoteirizacaoGoogleAutoPanel({ config, loadBaseline, onMsg, onErr }) {
  const [busy, setBusy] = React.useState(false);
  const autoOn = config?.routingGoogleMapsAuto !== false;
  const hasServerKey = Boolean(config?.google?.geocodeProxy);
  const enrichActive = Boolean(config?.google?.routesApiEnrichment);

  async function setRoutingGoogleAuto(enabled) {
    setBusy(true);
    onErr?.('');
    try {
      await settingsService.patch({ routing_google_maps_auto: Boolean(enabled) });
      await loadBaseline?.();
      onMsg?.(enabled ? 'Google Maps na roteirização automática: ligado.' : 'Modo só heurística no servidor (Google rotas desligado).');
    } catch (e) {
      onErr?.(e?.body?.message || e?.message || 'Falha ao salvar');
    }
    setBusy(false);
  }

  return (
    <div
      className="glass-card"
      style={{
        padding: 16,
        marginBottom: 16,
        border: enrichActive ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(148,163,184,0.25)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#f1f5f9' }}>Google Maps · roteirização automática</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, maxWidth: 720, lineHeight: 1.45 }}>
            Quando <b style={{ color: '#e2e8f0' }}>ligado</b>, cada <code style={{ color: '#93c5fd' }}>POST /routing/plan</code>{' '}
            pode enriquecer distância, tempo e polyline via <b>Google Routes</b> no servidor (se houver chave). Também
            afeta o indicador “enrich” em Expedição. Geocode no servidor permanece disponível para pedidos.
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
            Servidor com chave Google:{' '}
            <b style={{ color: hasServerKey ? '#86efac' : '#fca5a5' }}>{hasServerKey ? 'sim' : 'não'}</b>
            {' · '}
            Enriquecimento de rotas agora:{' '}
            <b style={{ color: enrichActive ? '#86efac' : '#fde047' }}>{enrichActive ? 'ativo' : 'inativo'}</b>
            {!hasServerKey && (
              <span style={{ display: 'block', marginTop: 4 }}>
                Configure <code>GOOGLE_MAPS_API_KEY</code> no backend (ou chave espelhada carregada pelo{' '}
                <code>loadEnv</code>).
              </span>
            )}
            {hasServerKey && !autoOn && (
              <span style={{ display: 'block', marginTop: 4, color: '#fde68a' }}>
                Interruptor desligado: o plano usa só heurística local até você ligar de novo.
              </span>
            )}
          </div>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: busy ? 'wait' : 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{ fontWeight: 700, color: autoOn ? '#86efac' : '#94a3b8' }}>{autoOn ? 'Ligado' : 'Desligado'}</span>
          <input
            type="checkbox"
            checked={autoOn}
            disabled={busy}
            style={{ width: 22, height: 22, accentColor: '#22c55e' }}
            onChange={(e) => void setRoutingGoogleAuto(e.target.checked)}
          />
        </label>
      </div>
    </div>
  );
}
