# WebSockets

## `/ws/ops`

Broadcast de `buildOperationalSnapshot` para o painel (JSON `{ type: 'ops_snapshot', payload }`).

- Variáveis: `OPS_WS_DISABLED=1` desliga; `OPS_WS_BROADCAST_MS` intervalo em ms (mín. 2000).
- O servidor HTTP é criado com `http.createServer(app)` em `server.js` para partilhar a porta com `ws`.

Outros canais (KDS granular, posição GPS) podem seguir o mesmo padrão noutro path.
