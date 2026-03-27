import { WebSocketServer } from 'ws';
import { timingSafeEqualString } from '../lib/timingSafe.js';
import { buildOperationalSnapshot } from '../modules/ops/snapshotBuilder.js';
import { getOpsWsBroadcastMs } from '../modules/settings/runtimeSettings.js';

function tokenFromUpgradeUrl(url) {
  const raw = url || '';
  const q = raw.indexOf('?');
  if (q < 0) return '';
  return new URLSearchParams(raw.slice(q + 1)).get('token') || '';
}

/**
 * Hub WebSocket: envia `ops_snapshot` ao conectar e em broadcast periódico
 * enquanto houver clientes (reduz carga vs. polling em várias abas).
 *
 * @param {import('http').Server} httpServer
 * @param {import('better-sqlite3').Database} db
 * @param {{ path?: string }} [options]
 * @returns {{ close: () => void }}
 */
export function attachOpsSocketHub(httpServer, db, options = {}) {
  if (process.env.OPS_WS_DISABLED === '1') {
    return { close: () => {} };
  }

  const path = options.path || '/ws/ops';
  const opsWsToken = (process.env.OPS_WS_TOKEN || '').trim();

  /** @type {import('ws').ServerOptions} */
  const wsOpts = { server: httpServer, path };
  if (opsWsToken) {
    wsOpts.verifyClient = (info, cb) => {
      const got = tokenFromUpgradeUrl(info.req.url);
      const ok = got.length > 0 && timingSafeEqualString(got, opsWsToken);
      if (ok) cb(true);
      else cb(false, 401, 'Unauthorized');
    };
  }

  const wss = new WebSocketServer(wsOpts);

  wss.on('error', (err) => {
    console.error('[ws/ops]', err?.code || err?.message || err);
  });

  let broadcastTimer = null;

  function stopBroadcast() {
    if (broadcastTimer) {
      clearTimeout(broadcastTimer);
      broadcastTimer = null;
    }
  }

  function broadcast() {
    if (wss.clients.size === 0) {
      stopBroadcast();
      return;
    }
    let snap;
    try {
      snap = buildOperationalSnapshot(db);
    } catch (e) {
      console.error('[ws/ops] snapshot', e);
      scheduleNextBroadcast();
      return;
    }
    const msg = JSON.stringify({ type: 'ops_snapshot', payload: snap });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
    scheduleNextBroadcast();
  }

  function scheduleNextBroadcast() {
    if (wss.clients.size === 0) {
      stopBroadcast();
      return;
    }
    const ms = getOpsWsBroadcastMs(db);
    stopBroadcast();
    broadcastTimer = setTimeout(broadcast, ms);
  }

  function ensureBroadcast() {
    if (broadcastTimer || wss.clients.size === 0) return;
    scheduleNextBroadcast();
  }

  wss.on('connection', (ws) => {
    try {
      const snap = buildOperationalSnapshot(db);
      ws.send(JSON.stringify({ type: 'ops_snapshot', payload: snap }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: e?.message || 'snapshot failed' }));
    }
    ensureBroadcast();

    ws.on('close', () => {
      if (wss.clients.size === 0) stopBroadcast();
    });
  });

  const initialMs = getOpsWsBroadcastMs(db);
  console.log(
    `[ws/ops] WebSocket em ws(s)://<host>:<porta>${path} (broadcast ~${initialMs}ms via settings/env; re-lido a cada ciclo${
      opsWsToken ? '; token obrigatorio (?token=)' : ''
    })`,
  );

  return {
    close: () => {
      stopBroadcast();
      try {
        wss.close();
      } catch {
        /* ignore */
      }
    }
  };
}
