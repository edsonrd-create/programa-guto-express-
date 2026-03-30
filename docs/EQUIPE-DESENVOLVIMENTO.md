# Guia da equipa de desenvolvimento — Guto Express V53

Documento único para onboarding, dia‑a‑dia e fecho dos **últimos detalhes** do sistema. Complementa `README.md`, `docs/ARQUITETURA.md`, `docs/BACKEND.md`, `docs/INTEGRACOES.md`, `docs/DEPLOY.md` e `docs/TESTE-RAPIDO.md`.

---

## 1. Produto e stack

| Camada | Tecnologia | Pasta |
|--------|------------|--------|
| API + WebSocket | Node.js 20+, Express, `better-sqlite3`, `ws` | `backend/` |
| Painel | React 19, Vite, React Router | `frontend/` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |
| Dados locais | SQLite (`*.sqlite`; não versionar) | gerado em runtime |

**Importante:** o painel **não** é servido por defeito em `http://127.0.0.1:3210/`. A API escuta nessa porta; o painel em desenvolvimento corre no **Vite** (`http://127.0.0.1:5173/`). Em produção, o `frontend/dist` pode ser servido por nginx/CDN ou, num passo futuro, por estático no Express.

---

## 2. Onboarding (primeiro dia)

1. **Instalar** Node.js **LTS** (20 ou 22).
2. **Clonar** o repositório e entrar na pasta do projeto.
3. **Instalar dependências:**
   ```bash
   cd backend && npm install && cd ../frontend && npm install && cd .. && npm install
   ```
   O `npm install` na **raiz** é opcional e necessário só para `npm run electron:dev` / `electron` (ver `docs/ELECTRON.md`).
4. **Variáveis:** copiar/criar `backend/.env` a partir de `backend/.env.example` (se existir); no frontend, opcional `frontend/.env` com `VITE_API_URL=http://127.0.0.1:3210`.
5. **Subir tudo em desenvolvimento (duas terminais):**
   - Terminal A: `cd backend && npm run dev`
   - Terminal B: `cd frontend && npm run dev`
6. **Verificar:** `http://127.0.0.1:3210/health` (API) e `http://127.0.0.1:5173/` (painel).
7. **Windows:** pode usar `INSTALAR-E-INICIAR.cmd` (instalação) + `SUBIR-BACKEND.cmd` e `SUBIR-PAINEL.cmd`.

---

## 3. Fluxo de trabalho (Git + CI)

| Passo | Ação |
|--------|------|
| Branch | `feature/<tema>` ou `fix/<tema>` a partir de `main`. |
| Antes do PR | `npm run ci` na **raiz** (após `npm install` em `backend/`, `frontend/` e, se usar desktop, na raiz). |
| PR | Objetivo: CI verde em GitHub Actions. |
| Merge | Preferir squash ou merge commit alinhado à política da equipa. |

**Comandos na raiz** (após instalar dependências nos dois pacotes):

```bash
npm run test:ci    # só backend (smoke + checks)
npm run ci         # backend test:ci + build frontend
```

### Após alterações (antes do merge)

1. `npm run ci` na raiz.
2. Se mudaram envs de produção: `DEPLOY.md` ou `backend/.env.example`.
3. `git push` e workflow **CI** verde no GitHub.
4. Deploy: `DEPLOY.md` (`ADMIN_API_KEY`, `VITE_ADMIN_API_KEY`, `VITE_API_URL`, `CORS_ORIGINS`).
5. Smoke: `npm run smoke:deploy -- https://…/api` (e opcional `SMOKE_PANEL_URL`) — ver `DEPLOY.md` e `TESTE-RAPIDO.md`.

---

## 4. Mapa rápido do código

| Área | Onde mexer | Documentação |
|------|------------|--------------|
| Pedidos, clientes, KDS, expedição | `backend/src/modules/*`, `frontend/src/modules/*` | `ARQUITETURA.md` |
| Webhooks, revisão, jobs async | `backend/src/modules/integrations/*` | `INTEGRACOES.md` |
| Snapshot / WebSocket painel | `backend/src/modules/ops/`, `backend/src/sockets/` | `ARQUITETURA.md`, `sockets/README.md` |
| Validação API (Zod) | `backend/src/validation/httpSchemas.js` | este guia |
| Chamadas HTTP no painel | `frontend/src/services/*.js` | — |
| Deploy produção | checklist | `DEPLOY.md` |

---

## 5. Ambiente local — proxy Vite

Com o **proxy** em `vite.config.js`, o painel em `5173` pode chamar a API em `3210` pelo **mesmo host** (evita CORS durante o dev). Se API estiver outra porta (ex. `3220`), ajuste `VITE_PROXY_API` ou o `target` no proxy.

---

## 6. Backlog sugerido — últimos detalhes (prioridades)

Use isto como contrato interno até “fecho” do MVP operacional.

### P0 — bloqueia uso correto em equipa

- [x] Documentação principal aponta para `frontend/` (`README.md`); evitar `apps/admin-web` em fluxos novos.
- [ ] **Servir painel em produção** — **recomendado:** nginx com `frontend/dist` estático + `location /api/` (e WebSocket) para Node interno; build com `VITE_API_URL=/api`. Ver `docs/nginx-example.conf` e `DEPLOY.md`. *Alternativa:* servir `dist` via Express (não implementado no repositório).
- [ ] Ajustar **`CORS_ORIGINS`** às origens HTTPS reais do painel (incl. `www` se existir) quando front e API forem domínios diferentes.

### P1 — robustez e segurança

- [ ] Revisar **webhook** (`webhook_secret`, header `x-guto-webhook-signature`) em ambientes de staging.
- [ ] **`TRUST_PROXY`** atrás de nginx; **`METRICS_TOKEN`** / **`OPS_WS_TOKEN`** em produção conforme política.
- [ ] Testes automatizados além de `test:ci` (ex.: integração webhook com SQLite em memória ou ficheiro temp).

### P1 — produto

- [x] **Menu/cardápio:** `GET /menu/items` lê **`menu_items`** (SQLite). Falta: UI/painel ou import para gerir linhas; atendimento pode consumir a lista quando integrado.
- [ ] **Auth:** evoluir `GET /auth/status` para sessão/JWT se o painel for exposto na internet.

### P2 — qualidade de vida

- [ ] ESLint/Prettier partilhado (backend + frontend).
- [ ] Mensagens de erro da API consistentes (`code`, `message`, `issues`).
- [ ] `npm run test:routing` integrado no CI **com servidor ephemeral** (opcional; hoje o script assume API já a correr).

### Checklist “Definition of Done” (por PR)

- [ ] `npm run ci` passa localmente.
- [ ] Sem segredos commitados (`.env` no `.gitignore`).
- [ ] Se mudou contrato API, atualizar `BACKEND.md` ou `ARQUITETURA.md` numa linha.
- [ ] Se mudou env, documentar em `ARQUITETURA.md` ou `backend/.env.example`.

---

## 7. Contactos e decisões

- **Arquitetura alvo:** `docs/ARQUITETURA.md`.
- **Incidentes / deploy:** `docs/DEPLOY.md`.
- **Integrações e seed:** `docs/INTEGRACOES.md`.

---

## 8. Glossário rápido

| Termo | Significado |
|--------|-------------|
| Snapshot | JSON agregado (`GET /ops/snapshot`) para o painel e IA |
| RAW | Payload bruto de integração (`integration_orders_raw`) |
| Review queue | Pedidos que precisam intervenção humana antes virar `orders` |

---

*Última atualização: mantenham este ficheiro como índice vivo do que falta para “fechar” o sistema.*
