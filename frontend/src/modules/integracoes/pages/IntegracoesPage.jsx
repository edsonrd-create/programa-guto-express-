import React from 'react';
import { getApiPublicBase } from '../../../services/apiClient.js';
import {
  integrationsService,
  postWebhookSimulator,
  webhookUrlForChannel,
} from '../../../services/integrations.service.js';

const SAMPLE_WEBHOOK = `{
  "externalOrderId": "test-${Date.now()}",
  "customer": { "name": "Cliente Teste", "phone": "11999990001" },
  "items": [{ "name": "Pizza grande", "quantity": 1, "price": 59.9 }],
  "total": 59.9
}`;

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
  const [whBody, setWhBody] = React.useState(SAMPLE_WEBHOOK);
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
    let parsed;
    try {
      parsed = JSON.parse(whBody);
    } catch {
      setErr('JSON inválido no corpo do webhook.');
      return;
    }
    setBusy(true);
    try {
      const { status, statusText, text } = await postWebhookSimulator(whChannel, parsed);
      setWhOut(`${status} ${statusText}\n${text}`);
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
          A integração do canal precisa estar <b>ativa</b>.
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
  const [tab, setTab] = React.useState('canais');

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Integrações</div>
      <div className="tab-bar">
        <button type="button" className={tab === 'canais' ? 'tab tab-active' : 'tab'} onClick={() => setTab('canais')}>
          Canais & webhooks
        </button>
        <button type="button" className={tab === 'revisao' ? 'tab tab-active' : 'tab'} onClick={() => setTab('revisao')}>
          Fila de revisão
        </button>
        <button type="button" className={tab === 'jobs' ? 'tab tab-active' : 'tab'} onClick={() => setTab('jobs')}>
          Fila async (jobs)
        </button>
      </div>
      {tab === 'canais' ? <CanaisPanel /> : tab === 'revisao' ? <RevisaoPanel /> : <WebhookJobsPanel />}
    </div>
  );
}
