import { WebSocketServer } from 'ws';
import { timingSafeEqualString } from '../lib/timingSafe.js';
import { buildOperationalSnapshot } from '../modules/ops/snapshotBuilder.js';

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
  const broadcastMs = Math.max(2000, Number(process.env.OPS_WS_BROADCAST_MS || 4000) || 4000);
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

  let intervalId = null;

  function stopBroadcast() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
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
      return;
    }
    const msg = JSON.stringify({ type: 'ops_snapshot', payload: snap });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  }

  function ensureBroadcast() {
    if (intervalId || wss.clients.size === 0) return;
    intervalId = setInterval(broadcast, broadcastMs);
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

  console.log(
    `[ws/ops] WebSocket em ws(s)://<host>:<porta>${path} (broadcast ${broadcastMs}ms${
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
