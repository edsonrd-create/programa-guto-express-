import React from 'react';
import { ordersService } from '../../../services/orders.service.js';
import { routingService } from '../../../services/routing.service.js';
import { searchAddressByText } from '../../../lib/googleMapsPlaces.js';
import { useMapsBrowserKey } from '../../../hooks/useMapsBrowserKey.js';
import { RoutingRouteMap } from '../../expedicao/components/RoutingRouteMap.jsx';

/** Colombo/PR — referência IBGE (sede municipal), alinhada ao backend storeGeo. */
const FALLBACK_STORE_MAP = {
  label: 'Loja — Colombo/PR (referência)',
  lat: -25.3648956,
  lng: -49.1771888,
};

const STATUS_OPTIONS = ['novo', 'em_preparo', 'pronto', 'aguardando_motoboy', 'despachado', 'entregue'];

function errMsg(e) {
  return e?.body?.message || e?.message || 'Erro';
}

export default function PedidosPage() {
  const mapsBrowserKey = useMapsBrowserKey();
  const [orders, setOrders] = React.useState([]);
  const [detail, setDetail] = React.useState(null);
  const [statusPick, setStatusPick] = React.useState('novo');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [delLat, setDelLat] = React.useState('');
  const [delLng, setDelLng] = React.useState('');
  const [delNeigh, setDelNeigh] = React.useState('');
  const [delAddr, setDelAddr] = React.useState('');
  const [geoBusy, setGeoBusy] = React.useState(false);
  const [placesBusy, setPlacesBusy] = React.useState(false);
  const [mapStore, setMapStore] = React.useState(null);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      setOrders(await ordersService.list());
    } catch (e) {
      setErr(errMsg(e));
    }
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [load]);

  React.useEffect(() => {
    if (!detail) {
      setMapStore(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cfg = await routingService.getConfig();
        if (!cancelled && cfg?.store?.lat != null && cfg?.store?.lng != null) setMapStore(cfg.store);
        else if (!cancelled) setMapStore(FALLBACK_STORE_MAP);
      } catch {
        if (!cancelled) setMapStore(FALLBACK_STORE_MAP);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail?.id]);

  async function openDetail(id) {
    setErr('');
    setBusy(true);
    try {
      const d = await ordersService.getById(id);
      setDetail(d);
      setStatusPick(d.status || 'novo');
      setDelLat(d.delivery_lat != null ? String(d.delivery_lat) : '');
      setDelLng(d.delivery_lng != null ? String(d.delivery_lng) : '');
      setDelNeigh(d.delivery_neighborhood || '');
      setDelAddr(d.delivery_address || '');
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function applyStatus() {
    if (!detail) return;
    setBusy(true);
    setErr('');
    try {
      await ordersService.setStatus(detail.id, statusPick);
      await load();
      await openDetail(detail.id);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function saveDelivery() {
    if (!detail) return;
    setBusy(true);
    setErr('');
    try {
      await ordersService.saveDelivery(detail.id, {
        delivery_lat: Number(delLat),
        delivery_lng: Number(delLng),
        delivery_neighborhood: delNeigh || null,
        delivery_address: delAddr || null,
      });
      await load();
      await openDetail(detail.id);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  async function geocodeFromAddress() {
    const q = delAddr.trim();
    if (q.length < 5) {
      setErr('Digite um endereço (rua, número, cidade) para geocodificar.');
      return;
    }
    setGeoBusy(true);
    setErr('');
    try {
      const r = await routingService.geocode(q);
      const list = r.results || [];
      if (!list.length) {
        setErr('Nenhum resultado para esse endereço.');
        return;
      }
      const first = list[0];
      if (first.lat != null && first.lng != null) {
        setDelLat(String(first.lat));
        setDelLng(String(first.lng));
      }
      if (first.neighborhood) setDelNeigh(first.neighborhood);
      if (first.formattedAddress) setDelAddr(first.formattedAddress);
    } catch (e) {
      setErr(errMsg(e));
    }
    setGeoBusy(false);
  }

  async function geocodeFromPlaces() {
    const q = delAddr.trim();
    if (q.length < 5) {
      setErr('Digite um endereço para buscar no mapa (Places).');
      return;
    }
    if (!mapsBrowserKey) {
      setErr('Configure a chave do mapa em Configurações ou VITE_GOOGLE_MAPS_API_KEY.');
      return;
    }
    setPlacesBusy(true);
    setErr('');
    try {
      const hit = await searchAddressByText(q);
      if (!hit || hit.lat == null || hit.lng == null) {
        setErr('Places não retornou localização para esse texto.');
        return;
      }
      setDelLat(String(hit.lat));
      setDelLng(String(hit.lng));
      if (hit.neighborhood) setDelNeigh(hit.neighborhood);
      if (hit.formattedAddress) setDelAddr(hit.formattedAddress);
    } catch (e) {
      setErr(errMsg(e));
    }
    setPlacesBusy(false);
  }

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Pedidos</div>
          <div style={{ color: '#94a3b8' }}>Módulo pedidos · serviço ordersService</div>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          Atualizar
        </button>
      </div>
      {err && <div className="err">{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 380px' : '1fr', gap: 18, alignItems: 'start' }}>
        <div className="glass-card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Entrega</th>
                <th>Status</th>
                <th>Total</th>
                <th>Criado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  style={{ cursor: 'pointer', background: detail?.id === o.id ? 'rgba(37,99,235,0.15)' : undefined }}
                  onClick={() => openDetail(o.id)}
                >
                  <td style={{ color: '#93c5fd', fontWeight: 700 }}>{o.id}</td>
                  <td>
                    {o.client_name || '—'}
                    {o.client_phone && <div style={{ fontSize: 11, color: '#94a3b8' }}>{o.client_phone}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>
                    {o.delivery_neighborhood || '—'}
                    {o.estimated_delivery_minutes != null && (
                      <div style={{ color: '#93c5fd' }}>~{o.estimated_delivery_minutes} min</div>
                    )}
                  </td>
                  <td>{o.status}</td>
                  <td>R$ {Number(o.total_amount || 0).toFixed(2)}</td>
                  <td style={{ color: '#94a3b8', fontSize: 12 }}>{o.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>Nenhum pedido ainda.</div>}
        </div>

        {detail && (
          <div className="glass-card" style={{ padding: 16, position: 'sticky', top: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Pedido #{detail.id}</div>
              <button type="button" className="btn-ghost" onClick={() => setDetail(null)}>
                Fechar
              </button>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
              Status atual: <b style={{ color: '#e2e8f0' }}>{detail.status}</b>
              <br />
              Subtotal R$ {Number(detail.subtotal ?? 0).toFixed(2)} · Taxa R${' '}
              {Number(detail.delivery_fee ?? 0).toFixed(2)} · Total R$ {Number(detail.total_amount || 0).toFixed(2)}
              {detail.delivery_neighborhood && (
                <>
                  <br />
                  Bairro: <b style={{ color: '#e2e8f0' }}>{detail.delivery_neighborhood}</b>
                  {detail.estimated_delivery_minutes != null && (
                    <span style={{ color: '#93c5fd' }}> · Prazo estimado ~{detail.estimated_delivery_minutes} min</span>
                  )}
                </>
              )}
            </div>
            {detail.min_order_hint && !detail.min_order_hint.satisfied && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid rgba(251,191,36,0.5)',
                  background: 'rgba(120,53,15,0.25)',
                  fontSize: 13,
                  color: '#fcd34d',
                }}
              >
                Abaixo do pedido mínimo do bairro <b>{detail.min_order_hint.zone_name}</b> (mín. R${' '}
                {Number(detail.min_order_hint.min_order_amount).toFixed(2)}). Faltam R${' '}
                {Number(detail.min_order_hint.gap).toFixed(2)} em itens. Não é possível ir para &quot;em preparo&quot; ou
                &quot;pronto&quot; até atingir o mínimo.
              </div>
            )}

            <div style={{ fontWeight: 700, marginBottom: 6 }}>Itens</div>
            <ul style={{ margin: '0 0 12px 0', paddingLeft: 18, color: '#cbd5e1', fontSize: 13 }}>
              {(detail.items || []).map((it) => (
                <li key={it.id}>
                  {it.item_name_snapshot} × {it.quantity} @ R$ {Number(it.unit_price).toFixed(2)}
                  {it.notes && <span style={{ color: '#94a3b8' }}> — {it.notes}</span>}
                </li>
              ))}
            </ul>

            <div style={{ fontWeight: 700, marginBottom: 6 }}>Histórico</div>
            <ul style={{ margin: '0 0 12px 0', paddingLeft: 18, color: '#94a3b8', fontSize: 12 }}>
              {(detail.history || []).map((h) => (
                <li key={h.id}>
                  {h.status} {h.description ? `(${h.description})` : ''} — {h.created_at}
                </li>
              ))}
            </ul>

            <div style={{ fontWeight: 700, marginBottom: 6 }}>Destino (roteirização)</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              <b style={{ color: '#94a3b8' }}>Servidor</b>: geocoding via API se houver chave no backend.{' '}
              <b style={{ color: '#94a3b8' }}>Navegador</b>: busca textual com Places API (nova) e{' '}
              <code style={{ color: '#cbd5e1' }}>Configurações → Mapa</code> ou{' '}
              <code style={{ color: '#cbd5e1' }}>VITE_GOOGLE_MAPS_API_KEY</code>; com App Check, use também as
              variáveis <code style={{ color: '#cbd5e1' }}>VITE_GOOGLE_MAPS_APP_CHECK</code> / Firebase.
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              <input
                className="select"
                placeholder="Endereço completo (rua, nº, cidade)"
                value={delAddr}
                onChange={(e) => setDelAddr(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={busy || geoBusy}
                onClick={geocodeFromAddress}
                style={{ width: '100%' }}
              >
                {geoBusy ? 'Geocodificando…' : 'Preencher pelo servidor (Geocoding)'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy || placesBusy || !mapsBrowserKey}
                onClick={geocodeFromPlaces}
                style={{ width: '100%' }}
                title={
                  mapsBrowserKey
                    ? 'Place.searchByText no mapa (Places API New)'
                    : 'Configure a chave em Configurações'
                }
              >
                {placesBusy ? 'Buscando no mapa…' : 'Buscar com Places (mapa)'}
              </button>
              <input className="select" placeholder="Latitude" value={delLat} onChange={(e) => setDelLat(e.target.value)} />
              <input className="select" placeholder="Longitude" value={delLng} onChange={(e) => setDelLng(e.target.value)} />
              <input className="select" placeholder="Bairro (opcional)" value={delNeigh} onChange={(e) => setDelNeigh(e.target.value)} />
              <button type="button" className="btn-ghost" disabled={busy} onClick={saveDelivery} style={{ width: '100%' }}>
                Salvar destino
              </button>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 6 }}>Mapa da entrega</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              Preenche com latitude/longitude válidas e confira a chave Maps em <strong>Configurações</strong> (ou{' '}
              <code style={{ color: '#cbd5e1' }}>VITE_GOOGLE_MAPS_API_KEY</code>).
            </div>
            {(() => {
              const la = Number(delLat);
              const ln = Number(delLng);
              const ok = Number.isFinite(la) && Number.isFinite(ln);
              if (!ok) {
                return (
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                    Informe lat/lng (ou use geocodificação acima) para o mapa aparecer.
                  </div>
                );
              }
              const st = mapStore || FALLBACK_STORE_MAP;
              return (
                <div style={{ marginBottom: 16 }}>
                  <RoutingRouteMap
                    apiKey={mapsBrowserKey}
                    store={st}
                    stops={[{ orderId: detail.id, lat: la, lng: ln }]}
                    height={280}
                  />
                </div>
              );
            })()}

            <div style={{ fontWeight: 700, marginBottom: 6 }}>Alterar status</div>
            <select className="select" value={statusPick} onChange={(e) => setStatusPick(e.target.value)} style={{ marginBottom: 8 }}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" className="btn" disabled={busy} onClick={applyStatus} style={{ width: '100%' }}>
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
