import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getWsOpsUrl } from '../services/apiClient.js';
import { fetchOperationalSnapshot } from '../services/ops.service.js';

const OpsSnapshotContext = createContext(null);

/**
 * Uma única ligação WebSocket / polling HTTP para todo o painel (troca de rota não reconecta).
 * @param {{ children: React.ReactNode, httpPollMs?: number }} props
 */
export function OpsSnapshotProvider({ children, httpPollMs = 10000 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [transport, setTransport] = useState('http');

  const applySnap = useCallback((snap) => {
    setData(snap);
    setError('');
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    try {
      setError('');
      const snap = await fetchOperationalSnapshot();
      applySnap(snap);
    } catch (e) {
      setError(e?.message || 'Falha ao carregar /ops/snapshot');
      setLoading(false);
    }
  }, [applySnap]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;
    let backupTimer = null;

    const clearPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const clearBackup = () => {
      if (backupTimer) {
        clearInterval(backupTimer);
        backupTimer = null;
      }
    };

    const startHttpPoll = (every) => {
      clearPoll();
      pollTimer = setInterval(() => {
        if (!cancelled) void reload();
      }, every);
    };

    void reload();

    if (import.meta.env.VITE_OPS_WS === '0') {
      startHttpPoll(httpPollMs);
      return () => {
        cancelled = true;
        clearPoll();
      };
    }

    let ws;
    try {
      ws = new WebSocket(getWsOpsUrl());
    } catch {
      setTransport('http');
      startHttpPoll(httpPollMs);
      return () => {
        cancelled = true;
        clearPoll();
      };
    }

    const useHttpOnly = () => {
      if (cancelled) return;
      setTransport('http');
      clearBackup();
      startHttpPoll(httpPollMs);
    };

    ws.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const j = JSON.parse(ev.data);
        if (j.type === 'ops_snapshot' && j.payload) {
          applySnap(j.payload);
          setTransport('ws');
        }
      } catch {
        /* ignore */
      }
    };

    ws.onopen = () => {
      if (cancelled) return;
      setTransport('ws');
      clearPoll();
      clearBackup();
      backupTimer = setInterval(() => {
        if (!cancelled) void reload();
      }, Math.max(45000, httpPollMs * 4));
    };

    ws.onclose = () => {
      useHttpOnly();
    };

    const connectTimeout = setTimeout(() => {
      if (cancelled || ws.readyState === WebSocket.OPEN) return;
      try {
        ws.close();
      } catch {
        /* */
      }
      useHttpOnly();
    }, 5000);

    ws.addEventListener('open', () => clearTimeout(connectTimeout), { once: true });

    return () => {
      cancelled = true;
      clearTimeout(connectTimeout);
      clearPoll();
      clearBackup();
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        try {
          ws.close();
        } catch {
          /* */
        }
      }
    };
  }, [httpPollMs, reload, applySnap]);

  const value = useMemo(
    () => ({ data, error, loading, reload, transport }),
    [data, error, loading, reload, transport]
  );

  return <OpsSnapshotContext.Provider value={value}>{children}</OpsSnapshotContext.Provider>;
}

export function useOpsSnapshot() {
  const ctx = useContext(OpsSnapshotContext);
  if (!ctx) {
    throw new Error('useOpsSnapshot deve ser usado dentro de <OpsSnapshotProvider>');
  }
  return ctx;
}
