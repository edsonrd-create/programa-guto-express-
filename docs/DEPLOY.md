# Deploy e CI

## CI (GitHub Actions)

O workflow `.github/workflows/ci.yml` corre em push e pull request para `main`/`master`:

- **Estado:** ver [Actions no GitHub](https://github.com/edsonrd-create/programa-guto-express-/actions); o último push à `main` deve mostrar **Success** (jobs Backend Node 20/22 + Frontend build).
- **backend**: `npm ci` + `npm run test:ci` + `npm run test:node` (unit + integração) + smoke `GET /health` e CORS (`scripts/smoke-http.mjs`, Node 22)
- **frontend**: `npm ci` + `npm run build` + segundo build com `ELECTRON_BUILD=1` (valida `base: './'` para janela Electron; ver `docs/ELECTRON.md`)

Nota: o GitHub pode avisar que *actions* internas usam Node 20 no runner — não afeta os jobs da aplicação; a matriz continua a testar Node 20 e 22 no código.

Localmente (aprox.):

```bash
cd backend && npm ci && npm run test:ci && npm run test:node
cd ../frontend && npm ci && npm run build
# Opcional — alinhar ao CI (Electron / dist relativo):
ELECTRON_BUILD=1 npm run build
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
| `CORS_ORIGINS` | Recom. em prod. com painel noutro host | Origens exatas separadas por vírgula |
| `GLOBAL_RATE_LIMIT_MAX` | Opcional | Limite global por IP; ver `backend/src/lib/globalRateLimit.js` |
| `GLOBAL_RATE_LIMIT_WINDOW_MS` | Opcional | Janela em ms (predef.: `60000`) |

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

### 7. Limite de pedidos e proxy

- Com `GLOBAL_RATE_LIMIT_MAX` > 0, use **`TRUST_PROXY=1`** (ou hops corretos) para o limite por IP refletir o cliente real atrás do nginx.
- A API envia cabeçalhos defensivos (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`); o nginx pode acrescentar HSTS e políticas adicionais.

---

## Validação pós-deploy (manual)

Use o domínio real do painel (ex.: **https://pdvgutoexpress.com.br**). Anote a **versão esperada** do backend: campo `version` em `backend/package.json` do commit que deployou.

### 1. API — `GET /health`

Consoante o proxy:

| Cenário | URL típica |
|--------|------------|
| Node exposto na raiz do mesmo host | `https://pdvgutoexpress.com.br/health` |
| API atrás de prefixo `/api` (recomendado no exemplo nginx) | `https://pdvgutoexpress.com.br/api/health` |
| API noutro subdomínio | `https://api.seudominio.com/health` |

**O que verificar:** JSON com `"ok": true`, `"service": "guto-express-backend"`, `"version": "…"` (deve coincidir com o `package.json` deployado), `"node": "v…"`.

No servidor ou no teu PC (com a API acessível):

```bash
curl -fsS "https://pdvgutoexpress.com.br/api/health"
# ou, se a API estiver na raiz:
# curl -fsS "https://pdvgutoexpress.com.br/health"
```

No repositório, com o backend local a correr noutra base:

```bash
cd backend && SMOKE_BASE_URL="https://pdvgutoexpress.com.br/api" npm run test:http-smoke
```

**Smoke automatizado pós-deploy (health + `/auth/status` + painel opcional):**

```bash
# Na raiz (recomendado)
npm run smoke:deploy -- https://pdvgutoexpress.com.br/api

# Ou dentro de backend/
npm run smoke:deploy -- https://pdvgutoexpress.com.br/api

# Variáveis (útil em CI ou scripts)
SMOKE_BASE_URL="https://pdvgutoexpress.com.br/api" \
SMOKE_PANEL_URL="https://pdvgutoexpress.com.br" \
SMOKE_EXPECT_VERSION="0.2.1" \
npm run smoke:deploy --prefix backend
```

Com proxy a remover cabeçalhos de segurança, use `SMOKE_SKIP_SECURITY_HEADERS=1`. Ver `node backend/scripts/deploy-smoke.mjs --help`.

(Ajuste `SMOKE_BASE_URL` se o path for diferente. Se o endpoint só responder em HTTPS com certificado válido, o comando tem de correr numa máquina com DNS/firewall que alcance o site.)

### 2. Painel — sessão operacional

1. Abrir **https://pdvgutoexpress.com.br** (e **https://www.pdvgutoexpress.com.br** se usarem `www` — deve redirecionar ou servir o mesmo app).
2. Confirmar que o build carrega sem erro de consola crítico (F12 → Consola / Rede).
3. Com **`VITE_ADMIN_API_KEY`** igual ao `ADMIN_API_KEY` do servidor: o painel deve conseguir chamadas autenticadas (ex.: menu, pedidos). Se a chave estiver errada ou em falta, verás **401** nas rotas protegidas e o aviso de autenticação na UI (conforme implementado).

### 3. Fluxo mínimo de negócio (teste)

1. **Pedidos:** criar um **pedido de teste** (cliente fictício, endereço válido se a loja exigir).
2. **Expedição / despacho:** abrir **Expedição** (ou equivalente no menu), confirmar que o pedido aparece e que é possível avançar estado / atribuir motoboy conforme o vosso fluxo.
3. **Tempo real:** confirmar que o **WebSocket** `/ws/ops` liga (sem erros permanentes na rede); com o mesmo host e `VITE_API_URL=/api`, o browser usa `wss://` no mesmo domínio.

**Como testar `/health` no browser:** abre **um separador novo** e cola o URL completo (ex.: `https://pdvgutoexpress.com.br/api/health`). Não uses **iframe** nem **abra o link** a partir da página de erro do Chrome (`chrome-error://…`): o browser bloqueia esse carregamento entre origens. A API envia `X-Frame-Options: DENY` — o JSON da API não é feito para ser embutido em frames. Em alternativa usa `curl` no terminal ou a tela **Teste rápido** do painel (pedido via `fetch`, não iframe).

### 4. Se algo falhar

| Sintoma | Onde olhar |
|--------|------------|
| `/health` 404 | Path do proxy (`/api` vs raiz); `proxy_pass` no nginx. |
| Consola: *Unsafe attempt to load URL … /api/health from frame … chrome-error* | Abrir `/health` num separador direto ou `curl`; corrigir primeiro falha de DNS/SSL/site em baixo se a página principal não carregar. |
| Painel em branco ou API 401 | `VITE_ADMIN_API_KEY` no **build** igual a `ADMIN_API_KEY`; voltar a fazer `npm run build` e publicar `dist`. |
| CORS ou WS recusado | `CORS_ORIGINS` com origem **exata** (com/sem `www`, `https`); nginx a enviar `Upgrade` para `/ws/ops`. |
| Versão antiga em `/health` | Processo Node antigo a correr; reiniciar serviço (systemd/NSSM) após deploy. |

---

## PaaS

- Backend precisa de **volume persistente** (SQLite).
- Confirmar suporte a **WebSocket** no plano.
