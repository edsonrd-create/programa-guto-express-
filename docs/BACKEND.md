# Backend — referência rápida

## Arranque

```bash
cd backend
npm install
npm run dev
```

Variáveis úteis: ver `backend/.env.example`.

## SQLite

Ficheiro por defeito: `database.sqlite` na pasta onde corres o processo (normalmente `backend/`).

```bash
npm run seed:integrations
```

Recria canais padrão (iFood, Neemo, …) se ainda não existirem. Ver `docs/INTEGRACOES.md`.

## Rotas principais

| Área | Exemplos |
|------|-----------|
| Saúde | `GET /health`, `GET /metrics` |
| Clientes | `GET/POST /clients` |
| Motoristas | `GET/POST /drivers`, `GET /drivers/queue`, `POST /drivers/:id/check-in` |
| Pedidos | `/orders`, `/kds`, `/dispatch` |
| Operação | `GET /ops/snapshot` |
| Tempo real | WebSocket `WS /ws/ops` (JSON `{ type: 'ops_snapshot', payload }`) |
| IA | `GET /ai/autopilot`, `GET /ai/insights`, rotas sob `/ai` (chat) |
| Integrações | `GET/POST /integrations`, `POST /integrations/webhook/:channel`, `GET /integrations/review-queue`, `GET /integrations/webhook-jobs` |
| Stubs | `GET /auth/status`, `GET /menu/items` |
| Roteirização | `GET /routing/config`, `GET /routing/classify`, `GET /routing/geocode?q=`, `POST /routing/plan` |

## Roteirização e Google Maps

Com `GOOGLE_MAPS_API_KEY` no servidor, o `POST /routing/plan` enriquece cada rota com **distância, duração e polyline** (Google **Routes API v2** `computeRoutes`, percurso loja → paradas na ordem do plano → volta à loja). Use `skipGoogleRoutes: true` no body para só heurística local. Rotas com mais de **25** paradas ignoram o Google (limite de intermediários da API).

- Ative no Google Cloud: **Routes API**, **Geocoding API** (para `GET /routing/geocode`, usado pelo painel em Pedidos → “Preencher coordenadas”).
- Recomenda-se **duas chaves** ou restrições distintas: uma para o servidor (IP) e outra para o browser (**Maps JavaScript API**, referrer do painel), exposta como `VITE_GOOGLE_MAPS_API_KEY` no frontend.
- Opcional: `GOOGLE_ROUTES_TRAFFIC=1` usa preferência com tráfego (custo/latência maiores).

## Webhooks assíncronos

Com `WEBHOOK_ASYNC=1`, o POST do webhook responde **202** e processa em worker; o painel lista jobs em **Integrações → Fila async** (`GET /integrations/webhook-jobs`).

Com `WEBHOOK_GEOCODE_DELIVERY=1` e chave Google no servidor, pedidos criados via webhook/review com endereço textual e sem coordenadas recebem **geocoding automático** após o `INSERT` (ver `docs/INTEGRACOES.md`).

## Módulos no código

`src/modules/*` por domínio; `src/sockets/opsSocket.js` para WS; `src/config/*` para env específicos (ex.: OpenAI).
