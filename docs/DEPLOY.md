# Deploy e CI

## CI (GitHub Actions)

O workflow `.github/workflows/ci.yml` corre em push e pull request para `main`/`master`:

- **backend**: `npm ci` + `npm run test:ci` + smoke `GET /health` (Node 22)
- **frontend**: `npm ci` + `npm run build`

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

---

## Checklist de produção (por ordem)

### 1. Variáveis de ambiente (backend)

| Variável | Obrigatório? | Notas |
|----------|----------------|-------|
| `ADMIN_API_KEY` | Sim em produção | Mesmo valor que `VITE_ADMIN_API_KEY` no build do frontend |
| `NODE_ENV` | Recomendado | `production` |
| `TRUST_PROXY` | Se usar nginx/HAProxy à frente | `1` (ou número de hops) |
| `METRICS_TOKEN` | Se expõe `/metrics` | Proteger métricas |
| `OPS_WS_TOKEN` | Opcional | Se não definir, pode reutilizar a mesma string que `ADMIN_API_KEY` no `?token=` do WS (ver código) |
| `PORT` | Opcional | Por defeito `3210` |

### 2. Base de dados

- Ficheiro `database.sqlite` num **volume persistente** (não apagar ao redeploy).
- Backups: na raiz do repo `npm run backup:db` ou `BACKUP-DB.cmd` (Windows). Ficheiros em `backend/data/backups/` (não versionar).
- Agendar (ex.: diário): Linux `cron` com `cd /caminho && npm run backup:db`; Windows **Agendador de tarefas** a apontar para `BACKUP-DB.cmd`.

### 3. Backend (Node)

- **Linux:** exemplo **systemd** em `docs/systemd/guto-backend.service.example` (ajuste caminhos e `User`).
- **Windows:** guia **NSSM** em `docs/NSSM-WINDOWS.md`.
- Em qualquer SO: `cwd` na pasta `backend/`, comando `node src/server.js` (ou `npm start`).
- Garantir que o processo tem permissão de escrita na pasta do SQLite.
- `GET /health` devolve também `version` (package do backend) e `node` (versão do runtime) para confirmar deploy.

### 4. Frontend (estático)

```bash
cd frontend && npm ci && npm run build
```

- `VITE_API_URL` = URL **pública** da API (ex.: `https://api.seudominio.com` ou `https://seudominio.com/api` conforme o proxy).
- `VITE_ADMIN_API_KEY` = **igual** a `ADMIN_API_KEY` do servidor (valor injetado no build; não muda em runtime).

### 5. Proxy reverso (nginx)

- Servir `frontend/dist` como ficheiros estáticos ou outro host.
- Proxy `/api` ou host dedicado para o Node na porta interna.
- WebSocket: `proxy_http_version 1.1`, `Upgrade`, `Connection "upgrade"` para o path `/ws/ops` (ou o path que o painel usar).
- HTTPS com certificado válido (Let's Encrypt).
- Exemplo comentado: **`docs/nginx-example.conf`** (SPA + `/api` + WebSocket). Com tudo no mesmo host, use build com `VITE_API_URL=/api`.

### 6. CORS

- Com front e API no **mesmo domínio** (ex.: `/api`), CORS costuma ser desnecessário no browser.
- Com domínios diferentes (ou para validar `Origin` no WebSocket `/ws/ops`), defina no backend `CORS_ORIGINS` com a origem exata do painel, por exemplo: `https://pdvgutoexpress.com.br` e, se aplicável, `https://www.pdvgutoexpress.com.br` (várias origens separadas por vírgula). Ver `backend/src/lib/corsConfig.js`.

---

## PaaS

- Backend precisa de **volume persistente** (SQLite).
- Confirmar suporte a **WebSocket** no plano.
