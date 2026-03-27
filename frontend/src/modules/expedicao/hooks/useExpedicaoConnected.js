import React from 'react';
import { ordersService } from '../../../services/orders.service.js';
import { dispatchService } from '../../../services/dispatch.service.js';
import { driversService } from '../../../services/drivers.service.js';
import { routingService } from '../../../services/routing.service.js';

const MODE_KEY = 'guto_expedicao_mode_v1';

function ageMinutes(createdAt) {
  if (!createdAt) return 0;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 60000);
}

function slaClock(iso, addMin) {
  if (!addMin || !iso) return '—';
  const base = new Date(iso).getTime();
  if (Number.isNaN(base)) return '—';
  return new Date(base + addMin * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function todayIsoDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function useExpedicaoConnected() {
  const [orders, setOrders] = React.useState([]);
  const [deliveries, setDeliveries] = React.useState([]);
  const [queue, setQueue] = React.useState([]);
  const [drivers, setDrivers] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [plan, setPlan] = React.useState(null);
  const [busy, setBusy] = React.useState(0);
  const [planBusy, setPlanBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [mode, setModeState] = React.useState(() => {
    try {
      return localStorage.getItem(MODE_KEY) || 'ia';
    } catch {
      return 'ia';
    }
  });
  const [skipGoogleRoutes, setSkipGoogleRoutes] = React.useState(false);
  const [planParams, setPlanParams] = React.useState({
    maxOrdersPerRoute: 4,
    maxRouteMinutes: 40,
    clusterKm: 2,
    soloWaitMinutes: 5,
    avgSpeedKmh: 24,
    minutesPerStop: 3,
    maxDetourRatio: 1.35,
    priorityAgeMinutes: 25,
  });

  const setMode = React.useCallback((m) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* */
    }
  }, []);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const [o, d, del, q, dr, cfg] = await Promise.all([
        ordersService.list(),
        dispatchService.listDeliveries(),
        dispatchService.listDispatchOrders(),
        driversService.queue(),
        driversService.list(),
        routingService.getConfig(),
      ]);
      setOrders(o);
      setDeliveries(d);
      setQueue(q);
      setDrivers(dr);
      setConfig(cfg);
      setPlanParams((p) => ({
        ...p,
        maxOrdersPerRoute: cfg.defaults?.maxOrdersPerRoute ?? p.maxOrdersPerRoute,
        maxRouteMinutes: cfg.defaults?.maxRouteMinutes ?? p.maxRouteMinutes,
        clusterKm: cfg.defaults?.clusterKm ?? p.clusterKm,
        soloWaitMinutes: cfg.defaults?.soloWaitMinutes ?? p.soloWaitMinutes,
        avgSpeedKmh: cfg.defaults?.avgSpeedKmh ?? p.avgSpeedKmh,
        minutesPerStop: cfg.defaults?.minutesPerStop ?? p.minutesPerStop,
        maxDetourRatio: cfg.defaults?.maxDetourRatio ?? p.maxDetourRatio,
        priorityAgeMinutes: cfg.defaults?.priorityAgeMinutes ?? p.priorityAgeMinutes,
      }));
      return { list: del };
    } catch (e) {
      setErr(e?.body?.message || e?.message || 'Falha ao carregar');
      return null;
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const id = setInterval(() => void load(), 12000);
    return () => clearInterval(id);
  }, [load]);

  const runPlan = React.useCallback(async () => {
    setPlanBusy(true);
    setErr('');
    try {
      const p = await routingService.plan({ ...planParams, skipGoogleRoutes });
      setPlan(p);
    } catch (e) {
      setErr(e?.body?.message || e?.message || 'Falha no planejamento');
      setPlan(null);
    }
    setPlanBusy(false);
  }, [planParams, skipGoogleRoutes]);

  const ready = React.useMemo(
    () => (orders || []).filter((x) => x.status === 'pronto'),
    [orders],
  );

  const deliveriesToday = React.useMemo(() => {
    const day = todayIsoDate();
    return (deliveries || []).filter((x) => String(x.assigned_at || x.created_at || '').slice(0, 10) === day);
  }, [deliveries]);

  const kpis = React.useMemo(() => {
    const ages = ready.map((o) => ageMinutes(o.created_at));
    const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const urgent = ready.filter((o) => ageMinutes(o.created_at) >= 20).length;
    const routes = plan?.routes || [];
    const groupHints = routes.filter((r) => (r.stops || []).length >= 2).length;
    return {
      readyCount: ready.length,
      urgentCount: urgent,
      groupSuggestions: groupHints,
      queueCount: queue.length,
      avgWaitMin: avgAge,
      dispatchToday: deliveriesToday.length,
    };
  }, [ready, plan, queue, deliveriesToday]);

  function routeForOrder(orderId) {
    const id = Number(orderId);
    return (plan?.routes || []).find((r) => (r.deliveryOrder || []).some((x) => Number(x) === id));
  }

  function priorityLabel(o) {
    const am = Math.round(ageMinutes(o.created_at));
    if (am >= 20) return { key: 'high', label: 'Alta' };
    if (am >= 10) return { key: 'medium', label: 'Média' };
    return { key: 'low', label: 'Baixa' };
  }

  return {
    orders,
    ready,
    deliveries,
    queue,
    drivers,
    config,
    plan,
    setPlan,
    busy,
    setBusy,
    planBusy,
    err,
    setErr,
    load,
    runPlan,
    mode,
    setMode,
    skipGoogleRoutes,
    setSkipGoogleRoutes,
    planParams,
    setPlanParams,
    kpis,
    ageMinutes,
    slaClock,
    routeForOrder,
    priorityLabel,
  };
}

export { ageMinutes, slaClock };
