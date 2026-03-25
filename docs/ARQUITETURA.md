# Arquitetura Guto Express V53

## Frontend (`frontend/`)

Plataforma operacional em React com **rotas reais** (`react-router-dom`). Cada item do menu lateral corresponde a um **módulo** sob `src/modules/<nome>/`:

| Menu            | Rota            | Pasta do módulo      | API principal                          |
|-----------------|-----------------|----------------------|----------------------------------------|
| Dashboard       | `/`             | `modules/dashboard`  | `WS /ws/ops` (preferencial) ou `GET /ops/snapshot` |
| Command Center  | `/command-center` | `modules/command-center` | `WS /ws/ops` ou `GET /ops/snapshot`            |
| Live Ops        | `/live-ops`     | `modules/live-ops`   | `WS /ws/ops` ou `GET /ops/snapshot` (KDS)      |
| Autopilot       | `/autopilot`    | `modules/autopilot`  | `GET /ai/autopilot`                    |
| Atendimento     | `/atendimento`  | `modules/atendimento`| `POST /clients`, `POST /orders`        |
| Pedidos         | `/pedidos`      | `modules/pedidos`    | `/orders`                              |
| KDS             | `/kds`          | `modules/kds`        | `/kds`                                 |
| Expedição       | `/expedicao`    | `modules/expedicao`  | `/dispatch`, `/drivers/queue`, `/routing/plan` |
| Motoboys        | `/motoboys`     | `modules/motoboys`   | `/drivers`                             |
| Integrações     | `/integracoes`  | `modules/integracoes`| `/integrations`, webhooks, revisão, `GET /integrations/webhook-jobs` |

- **`src/services/`** — chamadas HTTP por domínio (`orders.service.js`, `dispatch.service.js`, …).
- **`src/contexts/OpsSnapshotContext.jsx`** — `OpsSnapshotProvider`: **uma** ligação WebSocket (ou polling HTTP) para todas as rotas; `useOpsSnapshot()` lê o mesmo estado.
- **`src/hooks/useOpsSnapshot.js`** — reexport do hook do contexto.
- **`useAutopilot`** — continua só HTTP (`/ai/autopilot`).
- **`src/app/`** — `App.jsx` (rotas) e `navigation.js` (itens do menu = contrato único).
- **`src/layouts/`** — casca (`MainLayout` + `Outlet`).
- **`src/components/`** — peças reutilizáveis (sidebar, status da API).

## Backend (`backend/src/`)

| Pasta / módulo   | Papel |
|------------------|--------|
| `modules/orders` | Pedidos, itens, status, entrega (lat/lng) |
| `modules/kds`    | Cozinha (kitchen) |
| `modules/dispatch` | Expedição / entregas (delivery) |
| `modules/routing` | Roteirização |
| `modules/integrations` | Canais, webhooks, fila de revisão |
| `modules/customers` | Clientes (`/clients`) |
| `modules/drivers` | Motoboys e fila (`/drivers`, `/drivers/queue`) |
| `modules/auth` | Stub `GET /auth/status` (evolução futura) |
| `modules/menu` | Stub `GET /menu/items` (cardápio futuro) |
| `modules/ai` | Autopilot, insights, chat |
| `modules/ops` | Snapshot operacional |
| `sockets/opsSocket.js` | WebSocket `/ws/ops` (broadcast snapshot; ver `sockets/README.md`) |
| `config/` | Variáveis e validação (quando existir) |
| `db.js` | SQLite (ver também `database/README.md`) |

## Legado

A pasta `apps/admin-web/` foi substituída por `frontend/`; não use mais o antigo caminho para novas features.
