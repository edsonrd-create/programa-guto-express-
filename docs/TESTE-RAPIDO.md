# Teste rápido

## URLs (importante)

| O quê | URL |
|-------|-----|
| **Painel React (interface)** | `http://127.0.0.1:5173/` |
| API JSON | `http://127.0.0.1:3210/health` |

A porta **3210** não mostra o painel — use sempre **5173** com o Vite a correr.

## Login admin (testes reais)

Se o backend tiver `ADMIN_API_KEY`, use a mesma chave para **login runtime** no painel (botão **Entrar**).
Não é obrigatório embutir `VITE_ADMIN_API_KEY` no build de produção.

Na **raiz do repositório**:

```bash
npm run gen:admin-key
```

Copie `ADMIN_API_KEY` para `backend/.env`.
No frontend, para dev local você pode usar fallback estático em `frontend/.env`:

```bash
VITE_ALLOW_STATIC_ADMIN_KEY=1
VITE_ADMIN_API_KEY=<mesmo valor do backend>
```

Em produção, preferir login runtime + JWT e deixar chave estática desativada.

## Backend
1. `cd backend`
2. `npm install`
3. `npm run dev`
4. teste `GET /health`
5. crie cliente, pedido, item, motoboy e despacho

## Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. abra **`http://127.0.0.1:5173/`**

Na raiz: `npm install` (instala `concurrently`) e `npm run dev` sobe **backend + frontend** ao mesmo tempo.

## Backup da base (antes de testes destrutivos ou deploy)

Com o `database.sqlite` já criado pelo backend:

```bash
npm run backup:db
```

No Windows pode usar `BACKUP-DB.cmd` na raiz. Ver `docs/DEPLOY.md` para agendar cópias em produção.

## Smoke automatizado (API em produção ou staging)

Com a API acessível por HTTPS (sem precisar de chave):

```bash
SMOKE_EXPECT_AUTH_MODE=jwt_only SMOKE_EXPECT_JWT_ENABLED=1 npm run smoke:deploy -- https://SEU_DOMINIO/api
```

Opcional: `SMOKE_PANEL_URL=https://SEU_DOMINIO` (verifica HTML com `#root`). Detalhes em `docs/DEPLOY.md`.
