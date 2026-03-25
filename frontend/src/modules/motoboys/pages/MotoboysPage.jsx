import React from 'react';
import { driversService } from '../../../services/drivers.service.js';

function errMsg(e) {
  return e?.body?.message || e?.message || 'Erro';
}

export default function MotoboysPage() {
  const [drivers, setDrivers] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      setDrivers(await driversService.list());
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
      <div style={{ color: '#94a3b8', marginBottom: 16 }}>Módulo frota · /drivers</div>
      {err && <div className="err">{err}</div>}

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
