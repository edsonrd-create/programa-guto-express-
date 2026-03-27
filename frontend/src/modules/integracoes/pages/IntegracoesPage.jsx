import React from 'react';
import { getApiPublicBase } from '../../../services/apiClient.js';
import {
  integrationsService,
  postWebhookSimulator,
  webhookUrlForChannel,
} from '../../../services/integrations.service.js';
import '../integracoes-hub.css';

function normalizeChannelKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function defaultWebhookSampleText() {
  return JSON.stringify(
    {
      externalOrderId: `test-${Date.now()}`,
      customer: { name: 'Cliente Teste', phone: '11999990001' },
      items: [{ name: 'Pizza grande', quantity: 1, price: 59.9 }],
      total: 59.9,
    },
    null,
    2,
  );
}

function errMsg(e) {
  return e?.body?.message || e?.message || 'Erro';
}

function CanaisPanel() {
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', channel: '', token: '', webhook_secret: '' });
  const [editingId, setEditingId] = React.useState(null);
  const [edit, setEdit] = React.useState({ name: '', token: '', webhook_secret: '' });
  const [whChannel, setWhChannel] = React.useState('ifood');
  const [whBody, setWhBody] = React.useState(() => defaultWebhookSampleText());
  const [whOut, setWhOut] = React.useState('');

  const load = React.useCallback(async () => {
    setErr('');
    try {
      setRows(await integrationsService.list());
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function startEdit(r) {
    setEditingId(r.id);
    setEdit({ name: r.name, token: r.token || '', webhook_secret: r.webhook_secret || '' });
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    setErr('');
    try {
      await integrationsService.patch(editingId, {
        name: edit.name.trim(),
        token: edit.token || null,
        webhook_secret: edit.webhook_secret || null,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function toggleActive(row) {
    setBusy(true);
    setErr('');
    try {
      await integrationsService.patch(row.id, { active: !row.active });
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function submitNew(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.channel.trim()) {
      setErr('Nome e canal são obrigatórios.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await integrationsService.create({
        name: form.name.trim(),
        channel: form.channel.trim().toLowerCase().replace(/\s+/g, '_'),
        token: form.token || null,
        webhook_secret: form.webhook_secret || null,
        active: true,
        auto_accept: true,
      });
      setForm({ name: '', channel: '', token: '', webhook_secret: '' });
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function runWebhookTest() {
    setWhOut('');
    setErr('');
    const chKey = normalizeChannelKey(whChannel);
    const match = rows.find((r) => normalizeChannelKey(r.channel) === chKey);
    if (!match) {
      setErr(
        `Não há integração com o canal "${whChannel}". Cadastre uma linha com o mesmo nome de canal (ex.: ifood) ou ajuste o campo "Canal" acima.`,
      );
      return;
    }
    if (!match.active) {
      setErr('Esta integração está inativa. Use "Ativar" na tabela antes de testar o webhook.');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(whBody);
    } catch {
      setErr('JSON inválido no corpo do webhook.');
      return;
    }
    parsed.externalOrderId = `test-${Date.now()}`;
    setBusy(true);
    try {
      const { status, statusText, text } = await postWebhookSimulator(chKey, parsed, {
        webhookSecret: match.webhook_secret || null,
      });
      setWhOut(`${status} ${statusText}\n${text}`);
      if (status === 401) {
        setErr(
          'Assinatura rejeitada: com "Segredo webhook" preenchido, o servidor exige o header HMAC (o simulador envia automaticamente se o canal bater com a linha cadastrada).',
        );
      }
    } catch (e) {
      setWhOut(String(e.message));
    }
    setBusy(false);
  }

  return (
    <div>
      <div style={{ color: '#94a3b8', marginBottom: 16, fontSize: 13 }}>
        Webhooks: <code style={{ color: '#cbd5e1' }}>POST …/integrations/webhook/&lt;canal&gt;</code>
        <br />
        Base API: <code style={{ color: '#93c5fd' }}>{getApiPublicBase()}</code>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Simular webhook (teste)</div>
        <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          O campo <b>Canal</b> deve ser <b>idêntico</b> ao cadastrado (ex.: <code>ifood</code>). Com{' '}
          <b>segredo webhook</b>, o teste assina o JSON automaticamente. Se o backend usar{' '}
          <code>WEBHOOK_ASYNC=1</code>, ligue o worker ou veja a aba &quot;Fila async&quot;.
        </div>
        <div style={{ marginBottom: 10 }}>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => setWhBody(defaultWebhookSampleText())}>
            Novo JSON de exemplo
          </button>
        </div>
        <div style={{ display: 'grid', gap: 10, maxWidth: 720 }}>
          <input
            className="input"
            style={{ maxWidth: '100%' }}
            placeholder="Canal (ex.: ifood)"
            value={whChannel}
            onChange={(e) => setWhChannel(e.target.value)}
          />
          <textarea
            className="textarea"
            style={{ maxWidth: '100%', minHeight: 160, fontFamily: 'monospace', fontSize: 12 }}
            value={whBody}
            onChange={(e) => setWhBody(e.target.value)}
          />
          <button type="button" className="btn" disabled={busy} onClick={runWebhookTest}>
            Enviar POST de teste
          </button>
          {whOut && <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', margin: 0 }}>{whOut}</pre>}
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Nova integração</div>
        <form onSubmit={submitNew} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          <input
            className="input"
            placeholder="Nome (ex.: iFood Loja 1)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Canal (ex.: ifood)"
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Token (opcional)"
            value={form.token}
            onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Segredo webhook (opcional)"
            value={form.webhook_secret}
            onChange={(e) => setForm((f) => ({ ...f, webhook_secret: e.target.value }))}
          />
          <button type="submit" className="btn" disabled={busy}>
            Cadastrar
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>Cadastradas</div>
        <button type="button" className="btn-ghost" onClick={load} disabled={busy}>
          Recarregar
        </button>
      </div>
      <div className="glass-card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Canal</th>
              <th>Ativa</th>
              <th>Webhook</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>
                    <code style={{ color: '#93c5fd' }}>{r.channel}</code>
                  </td>
                  <td>{r.active ? 'sim' : 'não'}</td>
                  <td style={{ fontSize: 11, color: '#94a3b8', maxWidth: 200, wordBreak: 'break-all' }}>
                    {webhookUrlForChannel(r.channel)}
                  </td>
                  <td style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => toggleActive(r)}>
                      {r.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => startEdit(r)}>
                      Editar
                    </button>
                  </td>
                </tr>
                {editingId === r.id && (
                  <tr>
                    <td colSpan={6} style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ padding: 16, display: 'grid', gap: 10, maxWidth: 520 }}>
                        <input className="input" value={edit.name} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} />
                        <input
                          className="input"
                          placeholder="Token"
                          value={edit.token}
                          onChange={(e) => setEdit((x) => ({ ...x, token: e.target.value }))}
                        />
                        <input
                          className="input"
                          placeholder="Segredo webhook"
                          value={edit.webhook_secret}
                          onChange={(e) => setEdit((x) => ({ ...x, webhook_secret: e.target.value }))}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn" disabled={busy} onClick={saveEdit}>
                            Salvar
                          </button>
                          <button type="button" className="btn-ghost" disabled={busy} onClick={() => setEditingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>Nenhuma integração cadastrada.</div>}
      </div>
    </div>
  );
}

function RevisaoPanel() {
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(0);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const data = await integrationsService.reviewQueue();
      setRows(data.filter((r) => !r.resolved_at));
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  async function resolve(id) {
    setBusy(id);
    setErr('');
    try {
      await integrationsService.resolveReview(id);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(0);
  }

  return (
    <div>
      {err && <div className="err">{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn-ghost" onClick={load}>
          Atualizar
        </button>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {rows.map((r) => (
          <div key={r.id} className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800 }}>Fila #{r.id}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Pedido externo: {r.external_order_id}</div>
                <div style={{ color: '#fca5a5', marginTop: 6 }}>{r.reason}</div>
              </div>
              <button type="button" className="btn" disabled={busy === r.id} onClick={() => resolve(r.id)}>
                Marcar resolvido
              </button>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', color: '#93c5fd' }}>Payload bruto</summary>
              <pre style={{ fontSize: 11, overflow: 'auto', maxHeight: 200, color: '#cbd5e1' }}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(r.payload_json || '{}'), null, 2);
                  } catch {
                    return r.payload_json;
                  }
                })()}
              </pre>
            </details>
          </div>
        ))}
      </div>
      {rows.length === 0 && <div className="glass-card" style={{ padding: 20, color: '#94a3b8' }}>Nada na fila de revisão.</div>}
    </div>
  );
}

function WebhookJobsPanel() {
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState('');

  const load = React.useCallback(async () => {
    setErr('');
    try {
      setRows(await integrationsService.webhookJobs(100));
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
        Jobs assíncronos quando o backend corre com <code style={{ color: '#cbd5e1' }}>WEBHOOK_ASYNC=1</code>. Sem isso, a tabela pode ficar vazia.
      </div>
      {err && <div className="err">{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn-ghost" onClick={load}>
          Atualizar
        </button>
      </div>
      <div className="glass-card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Canal</th>
              <th>Status</th>
              <th>Tent.</th>
              <th>Criado</th>
              <th>Erro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td>
                  <code style={{ color: '#93c5fd' }}>{j.channel}</code>
                </td>
                <td>{j.status}</td>
                <td>{j.attempts}</td>
                <td style={{ color: '#94a3b8', fontSize: 12 }}>{j.created_at}</td>
                <td style={{ maxWidth: 220, fontSize: 11, color: '#fca5a5', wordBreak: 'break-word' }}>
                  {j.last_error || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>Sem jobs na fila SQLite.</div>}
      </div>
    </div>
  );
}

export default function IntegracoesPage() {
  const [tab, setTab] = React.useState('arquitetura');

  return (
    <div className="hub-int fade-up">
      <div className="hub-int-topbar">
        <div className="hub-int-title">
          <h2>Hub de Integração Completo</h2>
          <p>Modelo unificado para Neemo, Expresso Delivery, iFood e 99Food com espelhamento do pedido e KDS por etapa.</p>
        </div>
        <div className="hub-int-pill">
          <span className="dot" />
          Hub online e pronto para adaptação
        </div>
      </div>

      <section className="hub-int-grid hub-int-hero">
        <div className="hub-int-card hub-int-card-pad">
          <h3>Arquitetura central</h3>
          <p className="hub-int-muted">
            Entrada por webhook/adaptador, normalização para um padrão interno, distribuição para atendimento, KDS,
            expedição, roteirização e devolução de status.
          </p>
          <div className="hub-int-metrics">
            <div className="hub-int-metric">
              <small>Plataformas</small>
              <strong>4</strong>
            </div>
            <div className="hub-int-metric">
              <small>Canal padrão</small>
              <strong>Hub</strong>
            </div>
            <div className="hub-int-metric">
              <small>Etapas KDS</small>
              <strong>3</strong>
            </div>
            <div className="hub-int-metric">
              <small>Status bidirecional</small>
              <strong>Ativo</strong>
            </div>
          </div>
        </div>
        <div className="hub-int-card hub-int-card-pad">
          <h3>Modelo recomendado</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              1. Adaptador por plataforma
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              2. Normalização do pedido
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              3. Fila de eventos
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              4. KDS por estágio
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              5. Expedição / retirada / entrega
            </div>
          </div>
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(59,130,246,.22)', background: 'rgba(59,130,246,.08)', color: '#ccdcff', fontSize: 13, lineHeight: 1.5 }}>
            Para reduzir retrabalho, o sistema trata todas as origens com um único modelo interno de pedido e muda apenas
            adaptadores de entrada e saída.
          </div>
        </div>
      </section>

      <div className="hub-int-tabs">
        {[
          { id: 'arquitetura', label: 'Arquitetura' },
          { id: 'adaptadores', label: 'Adaptadores' },
          { id: 'kds', label: 'KDS por Etapa' },
          { id: 'pedido', label: 'Espelhamento do Pedido' },
          { id: 'status', label: 'Regras de Status' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`hub-int-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className={`hub-int-panel ${tab === 'arquitetura' ? 'active' : ''}`}>
        <div className="hub-int-card hub-int-card-pad">
          <h3>Fluxo do hub</h3>
          <div className="hub-int-flow">
            <div className="hub-int-flow-step">
              <strong>1. Entrada</strong>
              <span className="hub-int-muted">Webhook, polling ou API connector recebe pedido da plataforma.</span>
            </div>
            <div className="hub-int-flow-step">
              <strong>2. Adaptador</strong>
              <span className="hub-int-muted">Converte o payload para um modelo interno consistente.</span>
            </div>
            <div className="hub-int-flow-step">
              <strong>3. Core</strong>
              <span className="hub-int-muted">Salva pedido, vincula cliente, endereço, taxas, observações e origem.</span>
            </div>
            <div className="hub-int-flow-step">
              <strong>4. Distribuição</strong>
              <span className="hub-int-muted">Empurra para atendimento, KDS, expedição, roteirização e financeiro.</span>
            </div>
            <div className="hub-int-flow-step">
              <strong>5. Retorno</strong>
              <span className="hub-int-muted">Replica status atualizado e grava logs de operação.</span>
            </div>
          </div>

          <div className="hub-int-section-title">Endpoints internos do hub (reais no projeto)</div>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Função</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>/integrations/webhook/&lt;canal&gt;</code></td>
                  <td>Recebe eventos/pedidos via webhook</td>
                  <td>Assinatura opcional: <code>x-guto-webhook-signature</code></td>
                </tr>
                <tr>
                  <td><code>/integrations</code></td>
                  <td>CRUD de canais</td>
                  <td>Ativar/desativar e segredo</td>
                </tr>
                <tr>
                  <td><code>/integrations/review-queue</code></td>
                  <td>Fila de revisão</td>
                  <td>Payload incompleto / loja fechada</td>
                </tr>
                <tr>
                  <td><code>/kds</code></td>
                  <td>Fila da cozinha</td>
                  <td>Status: novo → em_preparo → pronto</td>
                </tr>
                <tr>
                  <td><code>/dispatch</code></td>
                  <td>Expedição / despacho</td>
                  <td>Fila FIFO de motoboys</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={`hub-int-panel ${tab === 'adaptadores' ? 'active' : ''}`}>
        <div className="hub-int-card hub-int-card-pad">
          <h3>Adaptadores (canais + testes)</h3>
          <p className="hub-int-muted">
            Cada plataforma tem um canal; o backend normaliza tudo para um único modelo interno. Abaixo está o painel real
            de canais, revisão e jobs.
          </p>
          <div className="tab-bar" style={{ marginTop: 12 }}>
            {/* reaproveita as abas funcionais já existentes */}
            <button type="button" className="tab tab-active">
              Painel
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <CanaisPanel />
            <div style={{ marginTop: 18 }}>
              <RevisaoPanel />
            </div>
            <div style={{ marginTop: 18 }}>
              <WebhookJobsPanel />
            </div>
          </div>
        </div>
      </section>

      <section className={`hub-int-panel ${tab === 'kds' ? 'active' : ''}`}>
        <div className="hub-int-card hub-int-card-pad">
          <h3>KDS por etapa (modelo + telas atuais)</h3>
          <p className="hub-int-muted">
            Hoje o projeto já possui a fila <code>/kds</code> e a expedição <code>/dispatch</code>. Se você quiser KDS em
            lanes (Produção / Pedido Pronto / Pronto pra Entregas), eu implemento em seguida usando esses mesmos status.
          </p>
          <div className="hub-int-section-title">Regras (referência)</div>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  <th>Tela</th>
                  <th>Status</th>
                  <th>Ação</th>
                  <th>Próximo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>KDS</td>
                  <td>em_preparo</td>
                  <td>Marcar pronto</td>
                  <td>Expedição</td>
                </tr>
                <tr>
                  <td>Expedição</td>
                  <td>pronto</td>
                  <td>Despachar</td>
                  <td>aguardando_motoboy</td>
                </tr>
                <tr>
                  <td>Expedição</td>
                  <td>aguardando_motoboy</td>
                  <td>Saiu</td>
                  <td>despachado</td>
                </tr>
                <tr>
                  <td>Expedição</td>
                  <td>despachado</td>
                  <td>Entregue</td>
                  <td>entregue</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={`hub-int-panel ${tab === 'pedido' ? 'active' : ''}`}>
        <div className="hub-int-card hub-int-card-pad">
          <h3>Espelhamento do pedido</h3>
          <p className="hub-int-muted">Campos mínimos para funcionar bem em Pedidos, KDS e Roteirização.</p>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Obrigatório</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>ID externo + interno</td><td>Sim</td><td>Evita duplicidade (UNIQUE por integração)</td></tr>
                <tr><td>Origem / canal</td><td>Sim</td><td><code>integration.channel</code></td></tr>
                <tr><td>Cliente (nome/telefone)</td><td>Sim</td><td>Cria/acha cliente por telefone</td></tr>
                <tr><td>Itens</td><td>Sim</td><td>Subtotal é recalculado pelos itens</td></tr>
                <tr><td>Total</td><td>Sim</td><td>Validação: total &gt; 0</td></tr>
                <tr><td>Endereço</td><td>Delivery</td><td>lat/lng opcional; pode geocodificar no servidor</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={`hub-int-panel ${tab === 'status' ? 'active' : ''}`}>
        <div className="hub-int-card hub-int-card-pad">
          <h3>Mapa de status (operacional)</h3>
          <div className="hub-int-flow">
            <div className="hub-int-flow-step"><strong>NOVO</strong><span className="hub-int-muted">Pedido criado (manual ou integração).</span></div>
            <div className="hub-int-flow-step"><strong>EM_PREPARO</strong><span className="hub-int-muted">Cozinha em produção (KDS).</span></div>
            <div className="hub-int-flow-step"><strong>PRONTO</strong><span className="hub-int-muted">Sai da cozinha; apto a expedição.</span></div>
            <div className="hub-int-flow-step"><strong>DESPACHADO</strong><span className="hub-int-muted">Saiu para entrega.</span></div>
            <div className="hub-int-flow-step"><strong>ENTREGUE</strong><span className="hub-int-muted">Finalizado.</span></div>
          </div>
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(59,130,246,.22)', background: 'rgba(59,130,246,.08)', color: '#ccdcff', fontSize: 13, lineHeight: 1.5 }}>
            Observação: status bidirecional (marketplace ↔ painel) é o próximo passo: criar endpoints de saída por parceiro
            e processar a outbox <code>integration_partner_sync_jobs</code>.
          </div>
        </div>
      </section>

      <div className="hub-int-footer">
        <div className="group">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setTab('adaptadores')}
            title="Abrir painel de canais e simulador de webhook"
          >
            Testar webhook
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setTab('arquitetura')}
            title="Ver endpoints e fluxo do hub"
          >
            Validar adaptadores
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setTab('adaptadores')}
            title="Simular pedido via webhook (painel de canais)"
          >
            Simular pedido
          </button>
        </div>
        <div className="group">
          <button type="button" className="btn-ghost" onClick={() => {}} title="Reservado">
            Salvar rascunho
          </button>
          <button type="button" className="btn" onClick={() => {}} title="Estrutura é dinâmica (backend + telas)">
            Salvar estrutura do hub
          </button>
        </div>
      </div>
    </div>
  );
}
