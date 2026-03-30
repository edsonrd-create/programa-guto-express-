import React from 'react';
import { useOpsSnapshot } from '../../../hooks/useOpsSnapshot.js';
import { roteirizacaoService } from '../../../services/roteirizacao.service.js';

const RULES_KEY = 'guto_routing_rules_v1';

export function defaultRoutingRules() {
  return {
    groupingWindowMin: 5,
    maxPerCourier: 3,
    slaPriority: 'high',
    mode: 'ia',
    maxRadiusKm: 8,
    capacityPerRoute: 3,
    delayBlock: true,
    provider: 'google_mapbox_ready',
    skipGoogleRoutes: false,
  };
}

function loadRules() {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) return { ...defaultRoutingRules(), ...JSON.parse(raw) };
  } catch {
    /* */
  }
  return defaultRoutingRules();
}

export function useRoteirizacaoLive() {
  const { data: snap, transport, reload: reloadSnap } = useOpsSnapshot();
  const [orders, setOrders] = React.useState([]);
  const [deliveries, setDeliveries] = React.useState([]);
  const [queue, setQueue] = React.useState([]);
  const [driversR, setDriversR] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [plan, setPlan] = React.useState(null);
  const [busyPlan, setBusyPlan] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [rules, setRulesState] = React.useState(() => loadRules());

  const setRules = React.useCallback((next) => {
    setRulesState((prev) => {
      const v = typeof next === 'function' ? next(prev) : { ...prev, ...next };
      localStorage.setItem(RULES_KEY, JSON.stringify(v));
      return v;
    });
  }, []);

  const rulesToPlanBody = React.useCallback(
    (r) => ({
      maxOrdersPerRoute: Math.min(6, Math.max(1, Number(r.maxPerCourier) || 3)),
      maxRouteMinutes: 40,
      clusterKm: 2,
      soloWaitMinutes: Math.max(2, Number(r.groupingWindowMin) || 5),
      avgSpeedKmh: 24,
      minutesPerStop: 3,
      maxDetourRatio: 1.35,
      priorityAgeMinutes:
        r.slaPriority === 'high' ? 20 : r.slaPriority === 'medium' ? 28 : 36,
      skipGoogleRoutes: Boolean(r.skipGoogleRoutes),
    }),
    [],
  );

  const loadBaseline = React.useCallback(async () => {
    setErr('');
    try {
      const [o, d, q, dr, cfg] = await Promise.all([
        roteirizacaoService.listOrdersWithClients(),
        roteirizacaoService.listDeliveries(),
        roteirizacaoService.queue(),
        roteirizacaoService.listDrivers(),
        roteirizacaoService.getRoutingConfig(),
      ]);
      setOrders(o);
      setDeliveries(d);
      setQueue(q);
      setDriversR(dr);
      setConfig(cfg);
    } catch (e) {
      setErr(e?.message || 'Falha ao carregar dados');
    }
  }, []);

  React.useEffect(() => {
    loadBaseline();
  }, [loadBaseline]);

  React.useEffect(() => {
    const id = setInterval(loadBaseline, 12000);
    return () => clearInterval(id);
  }, [loadBaseline]);

  const runPlan = React.useCallback(async () => {
    setBusyPlan(true);
    setErr('');
    try {
      const body = rulesToPlanBody(rules);
      const p = await roteirizacaoService.plan(body);
      setPlan(p);
    } catch (e) {
      setErr(e?.body?.message || e?.message || 'Falha no planejamento');
      setPlan(null);
    }
    setBusyPlan(false);
  }, [rules, rulesToPlanBody]);

  return {
    snap,
    transport,
    reloadSnap,
    orders,
    deliveries,
    queue,
    drivers: driversR,
    config,
    plan,
    setPlan,
    busyPlan,
    runPlan,
    rules,
    setRules,
    rulesToPlanBody,
    loadBaseline,
    err,
    setErr,
  };
}
