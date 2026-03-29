import React from 'react';
import { driversService } from '../../../services/drivers.service.js';
import { settingsService } from '../../../services/settings.service.js';

function errMsg(e) {
  return e?.body?.message || e?.message || 'Erro';
}

export default function MotoboysPage() {
  const [drivers, setDrivers] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [dispatchMode, setDispatchMode] = React.useState('fifo');
  const [locDriverId, setLocDriverId] = React.useState('');
  const [locLat, setLocLat] = React.useState('-25.36490');
  const [locLng, setLocLng] = React.useState('-49.17719');

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const [list, st] = await Promise.all([
        driversService.list(),
        settingsService.get().catch(() => ({ settings: {} })),
      ]);
      setDrivers(list);
      const m = st?.settings?.dispatch_queue_mode;
      setDispatchMode(m === 'nearest' ? 'nearest' : 'fifo');
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function addDriver(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await driversService.create({ name: name.trim(), phone: phone.trim() || null });
      setName('');
      setPhone('');
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function setQueueMode(mode) {
    setBusy(true);
    setErr('');
    try {
      await settingsService.patch({ dispatch_queue_mode: mode });
      setDispatchMode(mode);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function sendTestLocation(e) {
    e.preventDefault();
    const id = Number(locDriverId);
    const lat = Number(locLat);
    const lng = Number(locLng);
    if (!Number.isFinite(id)) {
      setErr('Selecione o motoboy.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await driversService.postLocation(id, { lat, lng });
      await load();
    } catch (err) {
      setErr(errMsg(err));
    }
    setBusy(false);
  }

  async function checkIn(id) {
    setBusy(true);
    setErr('');
    try {
      await driversService.checkIn(id);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Motoboys</div>
      <div style={{ color: '#94a3b8', marginBottom: 16 }}>
        Módulo frota · <code style={{ fontSize: 12 }}>/drivers</code> — fila de despacho pode ser{' '}
        <strong>ordem de check-in (FIFO)</strong> ou <strong>por GPS</strong> (mais próximo do endereço do pedido entre
        quem está na fila).
      </div>
      {err && <div className="err">{err}</div>}

      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Regra da fila de despacho</div>
        <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
          Modo atual:{' '}
          <strong style={{ color: dispatchMode === 'nearest' ? '#6ee7b7' : '#93c5fd' }}>
            {dispatchMode === 'nearest' ? 'GPS (proximidade)' : 'FIFO (manual por ordem de entrada)'}
          </strong>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className={dispatchMode === 'fifo' ? 'btn' : 'btn-ghost'} disabled={busy} onClick={() => setQueueMode('fifo')}>
            Usar FIFO
          </button>
          <button
            type="button"
            className={dispatchMode === 'nearest' ? 'btn' : 'btn-ghost'}
            disabled={busy}
            onClick={() => setQueueMode('nearest')}
          >
            Usar GPS na fila
          </button>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          No modo GPS, motoboys na fila precisam enviar posição (ex.: app chamando POST{' '}
          <code style={{ color: '#cbd5e1' }}>/drivers/:id/location</code>). Se ninguém tiver GPS, o sistema usa FIFO.
        </p>
      </div>

      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Simular GPS (teste)</div>
        <form onSubmit={sendTestLocation} style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
          <select className="select" value={locDriverId} onChange={(e) => setLocDriverId(e.target.value)}>
            <option value="">Motoboy…</option>
            {drivers.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name} (#{d.id})
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Lat" value={locLat} onChange={(e) => setLocLat(e.target.value)} />
            <input className="input" placeholder="Lng" value={locLng} onChange={(e) => setLocLng(e.target.value)} />
          </div>
          <button type="submit" className="btn-ghost" disabled={busy}>
            Gravar localização de teste
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Novo motorista</div>
        <form onSubmit={addDriver} style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
          <input className="input" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Telefone (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button type="submit" className="btn" disabled={busy}>
            Cadastrar
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Lista</div>
        <button type="button" className="btn-ghost" onClick={load}>
          Recarregar
        </button>
      </div>
      <div className="glass-card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Status</th>
              <th>Último GPS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.name}</td>
                <td>{d.phone || '—'}</td>
                <td>{d.status}</td>
                <td style={{ fontSize: 12, color: '#94a3b8' }}>
                  {d.last_lat != null && d.last_lng != null
                    ? `${Number(d.last_lat).toFixed(5)}, ${Number(d.last_lng).toFixed(5)}`
                    : '—'}
                </td>
                <td>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => checkIn(d.id)}>
                    Entrar na fila
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>Nenhum motorista.</div>}
      </div>
    </div>
  );
}
