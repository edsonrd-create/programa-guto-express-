# Guto Express V53 Test Pack

Backend Node + Express + SQLite e **painel operacional** em React (estrutura modular).

## Estrutura

- `backend/` — API REST, módulos por domínio (`orders`, `kds`, `dispatch`, `integrations`, `customers`, `drivers`, `auth` stub, `menu` stub, `routing`, `ai`, `ops`).
- `frontend/` — painel com **menu = rotas**, um módulo por área operacional (`src/modules/...`), serviços HTTP em `src/services/`.
- `docs/ARQUITETURA.md` — mapa menu ↔ rotas ↔ API.
- `docs/BACKEND.md` — rotas e envs do servidor.
- `docs/INTEGRACOES.md` — webhooks e seed.
- `docs/TESTE-RAPIDO.md` — checklist manual.
- `docs/EQUIPE-DESENVOLVIMENTO.md` — guia completo da equipa (onboarding, CI, backlog P0/P1/P2).

Na **raiz**: `package.json` com atalhos `npm run dev:backend`, `npm run dev:frontend`, `npm run seed:integrations`, `npm run test:ci`, `npm run test:http-smoke` (API a correr), `npm run ci` (testes backend + build frontend) — requer `npm install` em `backend/` e `frontend/`.

## Backend

```bash
cd backend
npm install
npm run dev
```

Abra `http://127.0.0.1:3210/health`

**Testes reais / produção:** defina `ADMIN_API_KEY` no `backend/.env` e a **mesma** chave em `VITE_ADMIN_API_KEY` no `frontend/.env` (o painel envia automaticamente em cada pedido HTTP e no WebSocket `/ws/ops`). Sem chave em desenvolvimento a API continua aberta; em `NODE_ENV=production` a chave é obrigatória. Com `NODE_ENV=production`, defina também `CORS_ORIGINS` com a(s) origem(ns) do painel (ex.: `https://pdvgutoexpress.com.br` e `https://www.pdvgutoexpress.com.br` se usar `www`) — várias separadas por vírgula; sem isso, pedidos de browser noutro host ficam sem CORS e o `/ws/ops` só valida origem quando a lista existe. Para gerar uma chave: `npm run gen:admin-key` na raiz. Backup do SQLite: `npm run backup:db` ou `BACKUP-DB.cmd` (Windows); detalhes em `docs/DEPLOY.md`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Abra **`http://127.0.0.1:5173/`** (Vite — é aqui que está o painel). A porta `3210` é só a API (`/health`), não mostra a interface React.

Em dev, pode **omitir** `VITE_API_URL`: o Vite faz **proxy** para a API em `3210` (ou `VITE_PROXY_API`). Para build de produção, defina `VITE_API_URL` com a URL pública da API. **WebSocket** `ws://…/ws/ops` (proxy em dev); `VITE_OPS_WS=0` desliga o WS.

Backend: `OPS_WS_DISABLED=1` ou `OPS_WS_BROADCAST_MS` — ver `backend/.env.example` e `docs/ARQUITETURA.md`.

## Legado

`apps/admin-web/` foi descontinuado em favor de `frontend/` (ver `apps/admin-web/README.md`).
