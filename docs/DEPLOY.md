# Deploy e CI

## CI (GitHub Actions)

O workflow `.github/workflows/ci.yml` corre em push e pull request para `main`/`master`:

- **backend**: `npm ci` + `npm run test:ci` (Node 20 e 22)
- **frontend**: `npm ci` + `npm run build` (Node 22)

Localmente (aprox.):

```bash
cd backend && npm ci && npm run test:ci
cd ../frontend && npm ci && npm run build
```

Na raiz:

```bash
npm run test:ci
npm run ci
```

## Deploy (VPS + nginx)

### Backend

- Rodar `backend/src/server.js` como serviço (systemd/NSSM) com `NODE_ENV=production`.
- Persistir `database.sqlite` num volume/pasta estável e fazer backup.
- Se estiver atrás de proxy (nginx), usar `TRUST_PROXY=1`.
- Configurar WebSocket `/ws/ops` com headers de upgrade no proxy.

### Frontend

- `cd frontend && npm ci && npm run build`.
- Servir `frontend/dist` via nginx/CDN.
- Definir `VITE_API_URL` para a URL pública da API.

## PaaS

- Backend precisa de **volume persistente** (SQLite).
- Confirmar suporte a WebSocket.
