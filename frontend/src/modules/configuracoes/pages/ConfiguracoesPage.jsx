import React from 'react';
import { Link } from 'react-router-dom';
import { settingsService } from '../../../services/settings.service.js';
import { apiGet, apiPatch } from '../../../services/apiClient.js';
import ConfiguracoesEntregaTab from '../components/ConfiguracoesEntregaTab.jsx';
import { getMapsBrowserApiKey, setMapsBrowserApiKey } from '../../../lib/mapsBrowserKeyStorage.js';
import { routingService } from '../../../services/routing.service.js';
import { deliveryZonesService } from '../../../services/deliveryZones.service.js';
import { integrationsService } from '../../../services/integrations.service.js';
import '../configuracoes-pro.css';

const IA_PROMPT_KEY = 'guto_ia_settings_prompt_v1';

function errMsg(e) {
  const issues = e?.body?.issues;
  if (Array.isArray(issues) && issues.length) return issues.map((i) => `${i.path}: ${i.message}`).join('; ');
  return e?.body?.message || e?.message || 'Erro';
}

export default function ConfiguracoesPage() {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [tab, setTab] = React.useState('geral');

  const [hoursLoading, setHoursLoading] = React.useState(true);
  const [hours, setHours] = React.useState({
    weekly: [],
    exceptions: [],
    holidays: [],
    rules: {
      block_outside_hours: false,
      closed_message:
        'No momento estamos fechados. Retornamos no próximo horário de funcionamento.',
      sync_integrations: false,
      mode: 'manual',
    },
    statusNow: null,
    lastChange: null,
  });

  const [newException, setNewException] = React.useState({
    date: '',
    mode: 'closed',
    open_time: '19:00',
    close_time: '22:30',
    break_label: 'Sem intervalo',
    note: '',
  });
  const [newHoliday, setNewHoliday] = React.useState({
    date: '',
    name: '',
    mode: 'closed',
    open_time: '19:00',
    close_time: '22:30',
    note: '',
  });

  const [mapsBrowserKeyDraft, setMapsBrowserKeyDraft] = React.useState('');
  const [hero, setHero] = React.useState({ totalZones: 0, activeZones: 0, integrations: 0 });
  const [apiOk, setApiOk] = React.useState(true);
  const [integrationsRows, setIntegrationsRows] = React.useState([]);
  const [iaPrompt, setIaPrompt] = React.useState(() => {
    try {
      return localStorage.getItem(IA_PROMPT_KEY) || '';
    } catch {
      return '';
    }
  });

  const [form, setForm] = React.useState({
    store_label: '',
    store_address: '',
    store_lat: '',
    store_lng: '',
    ops_ws_broadcast_ms: '4000',
    autopilot_enabled: true,
    allow_auto_assign: true,
    allow_auto_dispatch: false,
    routing_google_maps_auto: true,
  });

  const load = React.useCallback(async () => {
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      const res = await settingsService.get();
      const s = res?.settings || {};
      setForm((f) => ({
        ...f,
        store_label: s.store_label ?? '',
        store_address: s.store_address ?? '',
        store_lat: s.store_lat ?? '',
        store_lng: s.store_lng ?? '',
        ops_ws_broadcast_ms: s.ops_ws_broadcast_ms ?? f.ops_ws_broadcast_ms,
        autopilot_enabled: s.autopilot_enabled != null ? String(s.autopilot_enabled) === 'true' : f.autopilot_enabled,
        allow_auto_assign: s.allow_auto_assign != null ? String(s.allow_auto_assign) === 'true' : f.allow_auto_assign,
        allow_auto_dispatch: s.allow_auto_dispatch != null ? String(s.allow_auto_dispatch) === 'true' : f.allow_auto_dispatch,
        routing_google_maps_auto:
          s.routing_google_maps_auto != null ? String(s.routing_google_maps_auto) === 'true' : f.routing_google_maps_auto,
      }));
    } catch (e) {
      setErr(errMsg(e));
    }
    setLoading(false);
  }, []);

  const loadHours = React.useCallback(async () => {
    setHoursLoading(true);
    setErr('');
    setMsg('');
    try {
      const res = await apiGet('/settings/hours');
      setHours({
        weekly: res.weekly || [],
        exceptions: res.exceptions || [],
        holidays: res.holidays || [],
        rules: res.rules || hours.rules,
        statusNow: res.statusNow || null,
        lastChange: res.lastChange || null,
      });
    } catch (e) {
      setErr(errMsg(e));
    }
    setHoursLoading(false);
  }, [hours.rules]);

  React.useEffect(() => {
    load();
    loadHours();
  }, [load]);

  React.useEffect(() => {
    setMapsBrowserKeyDraft(getMapsBrowserApiKey());
  }, []);

  const loadHeroMetrics = React.useCallback(async () => {
    try {
      const [z, rows] = await Promise.all([
        deliveryZonesService.list({}),
        integrationsService.list().catch(() => []),
      ]);
      const s = z.summary || {};
      setHero({
        totalZones: Number(s.totalZones ?? z.zones?.length ?? 0),
        activeZones: Number(s.activeCount ?? 0),
        integrations: Array.isArray(rows) ? rows.filter((r) => r.active).length : 0,
      });
      setIntegrationsRows(Array.isArray(rows) ? rows : []);
      setApiOk(true);
    } catch {
      setApiOk(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHeroMetrics();
  }, [loadHeroMetrics]);

  React.useEffect(() => {
    if (tab === 'integracoes') void loadHeroMetrics();
  }, [tab, loadHeroMetrics]);

  async function testConnection() {
    setErr('');
    try {
      await settingsService.get();
      setApiOk(true);
      setMsg('API /settings respondeu OK.');
    } catch (e) {
      setApiOk(false);
      setErr(errMsg(e));
    }
  }

  async function validateMap() {
    setErr('');
    try {
      const c = await routingService.getConfig();
      const browser = Boolean(String(getMapsBrowserApiKey() || '').trim());
      setMsg(
        `Servidor: rotas Google ${c.google?.routesApiEnrichment ? 'ativo' : 'inativo'} · Geocode ${c.google?.geocodeProxy ? 'ativo' : 'inativo'} · Chave no navegador: ${browser ? 'sim' : 'não'}`,
      );
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  function saveDraftLocal() {
    try {
      localStorage.setItem('guto_config_form_draft', JSON.stringify({ form, tab }));
      setMsg('Rascunho (Geral) salvo neste navegador.');
    } catch {
      setErr('Não foi possível salvar rascunho.');
    }
  }

  function restoreTabDefaults() {
    if (tab === 'geral') {
      setForm((f) => ({
        ...f,
        ops_ws_broadcast_ms: '4000',
        autopilot_enabled: true,
        allow_auto_assign: true,
        allow_auto_dispatch: false,
        routing_google_maps_auto: true,
      }));
    }
    if (tab === 'horarios') resetDefaultWeek();
    if (tab === 'ia') {
      setIaPrompt(
        'Analisar configuração atual da operação, identificar inconsistências e sugerir correções. Alterações exigem confirmação manual.',
      );
    }
    setMsg('Padrões restaurados nesta aba. Confirme com Salvar.');
  }

  async function footerSave() {
    setErr('');
    if (tab === 'geral') {
      const el = document.getElementById('config-pro-form-geral');
      if (el) el.requestSubmit();
      return;
    }
    if (tab === 'horarios') {
      await saveHours('Salvar — painel inferior');
      return;
    }
    if (tab === 'integracoes') {
      await loadHeroMetrics();
      setMsg('Lista de integrações atualizada. Edição completa no módulo Integrações.');
      return;
    }
    if (tab === 'entrega') {
      setMsg('Salve alterações de zonas nos botões da tabela acima (taxas por bairro).');
      return;
    }
    if (tab === 'ia') {
      try {
        localStorage.setItem(IA_PROMPT_KEY, iaPrompt);
        setMsg('Prompt da IA salvo neste navegador. Regras de horário: use a aba Horários + “Salvar regras”.');
      } catch {
        setErr('Não foi possível salvar o prompt.');
      }
      return;
    }
    setMsg('Use o botão Salvar no conteúdo desta aba.');
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await settingsService.patch({
        store_label: form.store_label || undefined,
        store_address: form.store_address || undefined,
        store_lat: form.store_lat === '' ? undefined : Number(form.store_lat),
        store_lng: form.store_lng === '' ? undefined : Number(form.store_lng),
        ops_ws_broadcast_ms: form.ops_ws_broadcast_ms === '' ? undefined : Number(form.ops_ws_broadcast_ms),
        autopilot_enabled: Boolean(form.autopilot_enabled),
        allow_auto_assign: Boolean(form.allow_auto_assign),
        allow_auto_dispatch: Boolean(form.allow_auto_dispatch),
        routing_google_maps_auto: Boolean(form.routing_google_maps_auto),
      });
      setMsg('Configurações salvas no servidor (SQLite).');
      await load();
      await loadHeroMetrics();
    } catch (e2) {
      setErr(errMsg(e2));
    }
    setBusy(false);
  }

  async function saveHours(reason = 'Atualização de horário') {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const weekly = hours.weekly.map((w) => ({
        iso_dow: Number(w.iso_dow),
        active: Boolean(w.active),
        open_time: w.open_time || undefined,
        close_time: w.close_time || undefined,
        break_label: w.break_label || '',
      }));

      await apiPatch('/settings/hours', {
        weekly,
        exceptions: hours.exceptions,
        holidays: hours.holidays,
        rules: hours.rules,
        reason,
      });
      setMsg('Horários e regras salvos no servidor (SQLite).');
      await loadHours();
      await loadHeroMetrics();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  function applyAllDays(open_time, close_time, break_label) {
    setHours((h) => ({
      ...h,
      weekly: (h.weekly || []).map((w) => ({
        ...w,
        active: true,
        open_time,
        close_time,
        break_label: break_label ?? w.break_label,
      })),
    }));
  }

  function resetDefaultWeek() {
    setHours((h) => ({
      ...h,
      weekly: [
        { iso_dow: 1, active: 1, open_time: '18:00', close_time: '23:30', break_label: 'Sem intervalo' },
        { iso_dow: 2, active: 1, open_time: '18:00', close_time: '23:30', break_label: 'Sem intervalo' },
        { iso_dow: 3, active: 1, open_time: '18:00', close_time: '23:30', break_label: 'Sem intervalo' },
        { iso_dow: 4, active: 1, open_time: '18:00', close_time: '23:59', break_label: 'Sem intervalo' },
        { iso_dow: 5, active: 1, open_time: '18:00', close_time: '00:30', break_label: 'Sem intervalo' },
        { iso_dow: 6, active: 1, open_time: '18:00', close_time: '00:30', break_label: 'Sem intervalo' },
        { iso_dow: 7, active: 0, open_time: '18:00', close_time: '23:00', break_label: 'Sem intervalo' },
      ],
    }));
  }

  const dayName = (dow) =>
    ({
      1: 'Segunda-feira',
      2: 'Terça-feira',
      3: 'Quarta-feira',
      4: 'Quinta-feira',
      5: 'Sexta-feira',
      6: 'Sábado',
      7: 'Domingo',
    }[Number(dow)] || `Dia ${dow}`);

  return (
    <div className="config-pro fade-up">
      <div className="config-pro-topbar">
        <div className="config-pro-title-wrap">
          <h2>Configurações da operação</h2>
          <p>Painel híbrido com edição manual, apoio de IA e estrutura para integrações e roteirização.</p>
        </div>
        <div className={apiOk ? 'config-pro-status-pill' : 'config-pro-status-pill warn'}>
          <span className="config-pro-dot" />
          {apiOk ? 'API conectada' : 'Falha na API — verifique o backend'}
        </div>
      </div>

      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div style={{ color: '#34d399', marginBottom: 12 }}>{msg}</div>}

      <section className="config-pro-hero">
        <div className="config-pro-card config-pro-hero-main">
          <h3>Visão executiva</h3>
          <p>Controle centralizado da loja, funcionamento, taxa por bairro, mapas e parâmetros operacionais.</p>
          <div className="config-pro-metrics">
            <div className="config-pro-metric">
              <div className="config-pro-metric-label">Zonas / bairros cadastrados</div>
              <div className="config-pro-metric-value">{hero.totalZones}</div>
            </div>
            <div className="config-pro-metric">
              <div className="config-pro-metric-label">Zonas ativas</div>
              <div className="config-pro-metric-value">{hero.activeZones}</div>
            </div>
            <div className="config-pro-metric">
              <div className="config-pro-metric-label">Integrações ativas</div>
              <div className="config-pro-metric-value">{hero.integrations}</div>
            </div>
          </div>
        </div>
        <div className="config-pro-card config-pro-hero-side">
          <div className="config-pro-action-box">
            <strong>Modo de horário</strong>
            <p className="config-pro-helper">
              {hours.rules?.mode === 'ia'
                ? 'Assistido por IA — revisão humana disponível.'
                : 'Manual — bloqueio fora do expediente quando ativado.'}
            </p>
          </div>
          <div className="config-pro-action-box">
            <strong>Mapa no painel</strong>
            <p className="config-pro-helper">
              {getMapsBrowserApiKey()
                ? 'Chave do navegador configurada (localStorage ou .env).'
                : 'Defina a chave Maps em “Geral” ou VITE_GOOGLE_MAPS_API_KEY.'}
            </p>
          </div>
          <div className="config-pro-action-box">
            <strong>Roteirização Google</strong>
            <p className="config-pro-helper">
              {form.routing_google_maps_auto
                ? 'Enriquecimento de rotas no servidor permitido (se houver chave).'
                : 'Somente heurística local no plano de rotas.'}
            </p>
          </div>
        </div>
      </section>

      <div className="config-pro-tabs">
        {[
          { id: 'geral', label: 'Geral' },
          { id: 'horarios', label: 'Horário de Funcionamento' },
          { id: 'entrega', label: 'Taxa por Bairro' },
          { id: 'integracoes', label: 'Integrações' },
          { id: 'ia', label: 'Configuração híbrida IA' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`config-pro-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <div className="config-pro-card config-pro-panel">
          {loading ? (
            <div style={{ color: 'var(--cp-muted)' }}>Carregando…</div>
          ) : (
            <form id="config-pro-form-geral" onSubmit={save} style={{ display: 'grid', gap: 14 }}>
              <div className="config-pro-panel-header">
                <div>
                  <h3>Dados gerais da loja</h3>
                  <p className="config-pro-helper">
                    Base principal da operação, localização, mapa e parâmetros de pedidos e entregas.
                  </p>
                </div>
                <span className="config-pro-badge">Módulo principal</span>
              </div>
              <div className="config-pro-section-title">Loja e endereço</div>
              <div className="config-pro-grid-2">
                <div className="config-pro-field">
                  <label>Nome da loja (rótulo interno)</label>
                  <input
                    className="config-pro-input"
                    value={form.store_label}
                    onChange={(e) => setForm((f) => ({ ...f, store_label: e.target.value }))}
                  />
                </div>
                <div className="config-pro-field">
                  <label>Endereço padrão (origem / roteirização)</label>
                  <input
                    className="config-pro-input"
                    value={form.store_address}
                    onChange={(e) => setForm((f) => ({ ...f, store_address: e.target.value }))}
                  />
                  <small className="config-pro-helper">Usado como referência de origem e mapa.</small>
                </div>
              </div>
              <div className="config-pro-grid-2">
                <div className="config-pro-field">
                  <label>Latitude</label>
                  <input
                    className="config-pro-input"
                    placeholder="-25.365000"
                    value={form.store_lat}
                    onChange={(e) => setForm((f) => ({ ...f, store_lat: e.target.value }))}
                  />
                </div>
                <div className="config-pro-field">
                  <label>Longitude</label>
                  <input
                    className="config-pro-input"
                    placeholder="-49.180000"
                    value={form.store_lng ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, store_lng: e.target.value }))}
                  />
                </div>
              </div>

              <div className="config-pro-section-title">Mapa no navegador (Google)</div>
              <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
                Chave da <strong>Maps JavaScript API</strong> usada só neste navegador (<code>localStorage</code>).
                Não é enviada ao servidor. Se não preencher, usa <code>VITE_GOOGLE_MAPS_API_KEY</code> do build, se
                existir.
              </div>
              <input
                className="input"
                type="password"
                autoComplete="off"
                placeholder="Cole a chave (API key) aqui"
                value={mapsBrowserKeyDraft}
                onChange={(e) => setMapsBrowserKeyDraft(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setMapsBrowserApiKey(mapsBrowserKeyDraft);
                    setErr('');
                    setMsg('Chave do mapa salva neste navegador. Recarregue a página se o mapa já estiver aberto.');
                  }}
                >
                  Salvar chave local
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setMapsBrowserApiKey('');
                    setMapsBrowserKeyDraft(getMapsBrowserApiKey());
                    setErr('');
                    setMsg('Chave local removida. Passando a usar só a do .env, se houver.');
                  }}
                >
                  Remover chave local
                </button>
              </div>

              <div className="config-pro-field">
                <label>Origem HTTP atual (restrição de referrer no Google Cloud)</label>
                <input
                  className="config-pro-input"
                  readOnly
                  value={typeof window !== 'undefined' ? window.location.origin : ''}
                />
              </div>

              <div className="config-pro-section-title">Operação</div>
              <input
                className="input"
                placeholder="Broadcast WS em ms (ops_ws_broadcast_ms, min 2000)"
                value={form.ops_ws_broadcast_ms}
                onChange={(e) => setForm((f) => ({ ...f, ops_ws_broadcast_ms: e.target.value }))}
              />
              <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
                O intervalo do WebSocket <code>/ws/ops</code> é lido do SQLite após cada ciclo (fallback: variável{' '}
                <code>OPS_WS_BROADCAST_MS</code>).
              </div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={form.autopilot_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, autopilot_enabled: e.target.checked }))}
                />
                Piloto automático (autopilot_enabled) — desligue para modo estritamente manual em /ai/autopilot
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={form.allow_auto_assign}
                  onChange={(e) => setForm((f) => ({ ...f, allow_auto_assign: e.target.checked }))}
                />
                Permitir auto-atribuição (allow_auto_assign)
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={form.allow_auto_dispatch}
                  onChange={(e) => setForm((f) => ({ ...f, allow_auto_dispatch: e.target.checked }))}
                />
                Permitir auto-despacho (allow_auto_dispatch)
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={form.routing_google_maps_auto}
                  onChange={(e) => setForm((f) => ({ ...f, routing_google_maps_auto: e.target.checked }))}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <strong>Google Maps na roteirização automática</strong> — ao planejar rotas no servidor, usar Routes
                  API (distância, tempo, polyline) quando houver chave. Desligue para só heurística local.
                </span>
              </label>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn" disabled={busy}>
                  Salvar
                </button>
                <button type="button" className="btn-ghost" onClick={load} disabled={busy}>
                  Recarregar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'horarios' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Horário semanal</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
              Configure abertura/fechamento por dia, com ativo/inativo e intervalo opcional.
            </div>

            {hoursLoading ? (
              <div style={{ color: '#94a3b8' }}>Carregando horários…</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {(hours.weekly || []).map((w) => {
                  const active = Boolean(w.active) || Number(w.active) === 1;
                  return (
                    <div
                      key={w.iso_dow}
                      style={{
                        padding: 14,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        background: 'rgba(2,6,23,0.55)',
                        display: 'grid',
                        gap: 10,
                        gridTemplateColumns: '160px 120px 1fr 1fr 1fr auto',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{dayName(w.iso_dow)}</div>
                      <div>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: active ? '#14532d' : '#3f1d1d',
                            color: active ? '#86efac' : '#fca5a5',
                          }}
                        >
                          {active ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Abertura</div>
                        <input
                          className="input"
                          type="time"
                          value={w.open_time || '18:00'}
                          disabled={!active}
                          onChange={(e) =>
                            setHours((h) => ({
                              ...h,
                              weekly: h.weekly.map((x) =>
                                x.iso_dow === w.iso_dow ? { ...x, open_time: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Fechamento</div>
                        <input
                          className="input"
                          type="time"
                          value={w.close_time || '23:30'}
                          disabled={!active}
                          onChange={(e) =>
                            setHours((h) => ({
                              ...h,
                              weekly: h.weekly.map((x) =>
                                x.iso_dow === w.iso_dow ? { ...x, close_time: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Intervalo</div>
                        <input
                          className="input"
                          placeholder="Ex.: Sem intervalo"
                          value={w.break_label || ''}
                          onChange={(e) =>
                            setHours((h) => ({
                              ...h,
                              weekly: h.weekly.map((x) =>
                                x.iso_dow === w.iso_dow ? { ...x, break_label: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className={active ? 'btn' : 'btn-ghost'}
                        onClick={() =>
                          setHours((h) => ({
                            ...h,
                            weekly: h.weekly.map((x) =>
                              x.iso_dow === w.iso_dow ? { ...x, active: active ? 0 : 1 } : x,
                            ),
                          }))
                        }
                        title={active ? 'Ativo' : 'Inativo'}
                      >
                        {active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn" disabled={busy} onClick={() => saveHours('Salvar horários')}>
                    Salvar horários
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => applyAllDays('18:00', '23:30', 'Sem intervalo')}
                  >
                    Aplicar em todos os dias
                  </button>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={resetDefaultWeek}>
                    Restaurar padrão
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Resumo operacional</div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>
              Impacto direto em pedidos e integrações.
            </div>

            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 14, background: 'rgba(2,6,23,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Agora</div>
                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, color: hours.statusNow?.openNow ? '#86efac' : '#fca5a5' }}>
                  {hours.statusNow?.openNow ? 'Aberto' : 'Fechado'}
                </div>
                {hours.statusNow?.window && (
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>
                    {hours.statusNow.window.open} às {hours.statusNow.window.close}
                    {hours.statusNow.window.overnight ? ' (vira o dia)' : ''}
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={Boolean(hours.rules.block_outside_hours)}
                  onChange={(e) => setHours((h) => ({ ...h, rules: { ...h.rules, block_outside_hours: e.target.checked } }))}
                />
                Bloquear pedidos automaticamente fora do horário
              </label>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={Boolean(hours.rules.sync_integrations)}
                  onChange={(e) => setHours((h) => ({ ...h, rules: { ...h.rules, sync_integrations: e.target.checked } }))}
                />
                Sincronizar status com integrações
              </label>
              <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
                Com bloqueio por horário ativo: grava <code>store_closed_pending_sync</code> nos logs e enfileira um job na
                outbox (<code>integration_partner_sync_jobs</code>). Worker: <code>INTEGRATION_SYNC_WORKER=1</code>. Entregas:{' '}
                <code>stub</code>, <code>http</code> (URL única), ou <code>channels</code> (
                <code>INTEGRATION_SYNC_IFOOD_URL</code> / <code>INTEGRATION_SYNC_99FOOD_URL</code> + fallback{' '}
                <code>INTEGRATION_SYNC_HTTP_URL</code>). Jobs presos em <code>processing</code> são reenfileirados após{' '}
                <code>INTEGRATION_SYNC_STALE_PROCESSING_SEC</code> (padrão 120s).
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Mensagem fora do horário</div>
                <textarea
                  className="input"
                  style={{ minHeight: 90 }}
                  value={hours.rules.closed_message || ''}
                  onChange={(e) => setHours((h) => ({ ...h, rules: { ...h.rules, closed_message: e.target.value } }))}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Modo de aplicação do horário</div>
                <select
                  className="input"
                  value={hours.rules.mode || 'manual'}
                  onChange={(e) => setHours((h) => ({ ...h, rules: { ...h.rules, mode: e.target.value } }))}
                >
                  <option value="manual">
                    Manual — bloqueia pedidos/integrações fora do horário (quando a opção acima está ativa)
                  </option>
                  <option value="ia">
                    Assistido por IA — não bloqueia por calendário; horário continua visível no painel e no snapshot
                  </option>
                </select>
                <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
                  As duas opções permanecem disponíveis: use Manual para portaria rígida, ou Assistido quando a operação
                  deve seguir mesmo fora da grade (revisão humana / autopilot em /ai/autopilot).
                </div>
              </div>

              <button type="button" className="btn" disabled={busy} onClick={() => saveHours('Salvar regras')}>
                Salvar regras
              </button>

              {hours.lastChange && (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  Última alteração: {String(hours.lastChange.changed_at)} ({String(hours.lastChange.reason || '')})
                </div>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Exceções e feriados</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
              Horários especiais por data específica e feriados.
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Adicionar exceção</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="input" type="date" value={newException.date} onChange={(e) => setNewException((s) => ({ ...s, date: e.target.value }))} />
                <select className="input" value={newException.mode} onChange={(e) => setNewException((s) => ({ ...s, mode: e.target.value }))}>
                  <option value="closed">Fechado</option>
                  <option value="open">Aberto horário especial</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="input" type="time" value={newException.open_time} disabled={newException.mode !== 'open'} onChange={(e) => setNewException((s) => ({ ...s, open_time: e.target.value }))} />
                <input className="input" type="time" value={newException.close_time} disabled={newException.mode !== 'open'} onChange={(e) => setNewException((s) => ({ ...s, close_time: e.target.value }))} />
              </div>
              <input className="input" placeholder="Observação" value={newException.note} onChange={(e) => setNewException((s) => ({ ...s, note: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !newException.date}
                  onClick={() => {
                    setHours((h) => ({ ...h, exceptions: [...(h.exceptions || []).filter((x) => x.date !== newException.date), newException] }));
                    setNewException((s) => ({ ...s, note: '' }));
                  }}
                >
                  Adicionar exceção (local)
                </button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => saveHours('Salvar exceções/feriados')}>
                  Salvar no servidor
                </button>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />

              <div style={{ fontWeight: 800 }}>Adicionar feriado</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="input" type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((s) => ({ ...s, date: e.target.value }))} />
                <input className="input" placeholder="Nome" value={newHoliday.name} onChange={(e) => setNewHoliday((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <select className="input" value={newHoliday.mode} onChange={(e) => setNewHoliday((s) => ({ ...s, mode: e.target.value }))}>
                <option value="closed">Fechado</option>
                <option value="open">Aberto horário especial</option>
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="input" type="time" value={newHoliday.open_time} disabled={newHoliday.mode !== 'open'} onChange={(e) => setNewHoliday((s) => ({ ...s, open_time: e.target.value }))} />
                <input className="input" type="time" value={newHoliday.close_time} disabled={newHoliday.mode !== 'open'} onChange={(e) => setNewHoliday((s) => ({ ...s, close_time: e.target.value }))} />
              </div>
              <input className="input" placeholder="Observação" value={newHoliday.note} onChange={(e) => setNewHoliday((s) => ({ ...s, note: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !newHoliday.date}
                  onClick={() => {
                    setHours((h) => ({ ...h, holidays: [...(h.holidays || []).filter((x) => x.date !== newHoliday.date), newHoliday] }));
                    setNewHoliday((s) => ({ ...s, name: '', note: '' }));
                  }}
                >
                  Adicionar feriado (local)
                </button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => saveHours('Salvar exceções/feriados')}>
                  Salvar no servidor
                </button>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />

              <div style={{ fontWeight: 800 }}>Listas</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Exceções: {(hours.exceptions || []).length} | Feriados: {(hours.holidays || []).length}</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'entrega' && (
        <div className="config-pro-card config-pro-panel">
          <div className="config-pro-panel-header">
            <div>
              <h3>Taxa por bairro</h3>
              <p className="config-pro-helper">
                Taxa de entrega, tempo médio, pedido mínimo e prioridade por zona — espelhado nos pedidos quando o
                bairro bate na tabela.
              </p>
            </div>
            <span className="config-pro-badge">Precificação logística</span>
          </div>
          <ConfiguracoesEntregaTab />
        </div>
      )}

      {tab === 'integracoes' && (
        <div className="config-pro-card config-pro-panel">
          <div className="config-pro-panel-header">
            <div>
              <h3>Integrações</h3>
              <p className="config-pro-helper">
                Espelhamento de pedidos via webhooks e canais cadastrados. Gerenciamento completo na rota dedicada.
              </p>
            </div>
            <span className="config-pro-badge">Omnichannel</span>
          </div>
          <p style={{ marginBottom: 14 }}>
            <Link to="/integracoes" className="btn" style={{ display: 'inline-block' }}>
              Abrir módulo Integrações
            </Link>
          </p>
          <div className="config-pro-integration-grid">
            {(integrationsRows.length ? integrationsRows : [{ id: 'empty', name: 'Nenhum canal', channel: '—', active: 0 }]).map(
              (row) => {
                const on = Boolean(row.active) && row.id !== 'empty';
                return (
                  <div key={row.id} className="config-pro-int-card">
                    <h4>{row.name || row.channel || 'Integração'}</h4>
                    <p>Canal: {row.channel || '—'}</p>
                    <span className={`config-pro-chip ${on ? 'success' : 'warn'}`}>{on ? 'Ativo' : 'Inativo'}</span>
                  </div>
                );
              },
            )}
          </div>
          <div className="config-pro-info-note">
            Estrutura recomendada para espelhamento: pedido, origem, cliente, endereço, itens, pagamento, taxa e
            timeline — alinhada aos webhooks em <code>/integrations/webhook/&lt;canal&gt;</code>.
          </div>
        </div>
      )}

      {tab === 'ia' && (
        <div className="config-pro-card config-pro-panel">
          <div className="config-pro-panel-header">
            <div>
              <h3>Configuração híbrida: manual + IA</h3>
              <p className="config-pro-helper">
                Prompt local para orientar assistentes; modo de horário (manual vs assistido) continua na aba
                Horários.
              </p>
            </div>
            <span className="config-pro-badge">Camada inteligente</span>
          </div>
          <div className="config-pro-grid-2">
            <div className="config-pro-field">
              <label>Modo de horário (visão IA)</label>
              <select
                className="config-pro-select"
                value={hours.rules?.mode || 'manual'}
                onChange={(e) => setHours((h) => ({ ...h, rules: { ...h.rules, mode: e.target.value } }))}
              >
                <option value="manual">Manual — bloqueio fora do expediente quando ativado</option>
                <option value="ia">Assistido por IA — calendário informativo; revisão humana</option>
              </select>
              <small className="config-pro-helper">Persistir com “Salvar regras” na aba Horários ou botão global.</small>
            </div>
            <div className="config-pro-field">
              <label>Piloto automático (referência)</label>
              <p className="config-pro-helper">
                Controle em <strong>Geral</strong>. Autopilot em <Link to="/autopilot">/autopilot</Link>.
              </p>
            </div>
          </div>
          <div className="config-pro-section-title">Prompt operacional (local)</div>
          <textarea
            className="config-pro-textarea"
            value={iaPrompt}
            onChange={(e) => setIaPrompt(e.target.value)}
            placeholder="Instruções para o assistente analisar taxas, horários e inconsistências…"
          />
          <div className="config-pro-section-title">Histórico resumido</div>
          <div className="config-pro-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Módulo</th>
                  <th>Alteração</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hours.lastChange ? (
                  <tr>
                    <td>{String(hours.lastChange.changed_at || '—')}</td>
                    <td>Horários</td>
                    <td>{String(hours.lastChange.reason || '—')}</td>
                    <td>
                      <span className="config-pro-chip success">Registrado</span>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} style={{ color: 'var(--cp-muted)' }}>
                      Nenhum registro recente nesta sessão.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="config-pro-footer">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="config-pro-btn-sec" onClick={() => void testConnection()}>
            Testar conexão
          </button>
          <button type="button" className="config-pro-btn-sec" onClick={() => void validateMap()}>
            Validar mapa
          </button>
          <button type="button" className="config-pro-btn-dan" onClick={restoreTabDefaults}>
            Restaurar padrão (aba)
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="config-pro-btn-sec" onClick={saveDraftLocal}>
            Salvar rascunho
          </button>
          <button type="button" className="config-pro-btn-pri" disabled={busy} onClick={() => void footerSave()}>
            Salvar configurações
          </button>
        </div>
      </div>
    </div>
  );
}

