# Teste rápido

## URLs (importante)

| O quê | URL |
|-------|-----|
| **Painel React (interface)** | `http://127.0.0.1:5173/` |
| API JSON | `http://127.0.0.1:3210/health` |

A porta **3210** não mostra o painel — use sempre **5173** com o Vite a correr.

## Chave de API (testes reais)

Se o backend tiver `ADMIN_API_KEY`, o painel precisa da mesma chave em `frontend/.env` como `VITE_ADMIN_API_KEY`.

Na **raiz do repositório**:

```bash
npm run gen:admin-key
```

Copie as duas linhas geradas para `backend/.env` e `frontend/.env`, guarde e reinicie backend + Vite.

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
npm run smoke:deploy -- https://SEU_DOMINIO/api
```

Opcional: `SMOKE_PANEL_URL=https://SEU_DOMINIO` (verifica HTML com `#root`). Detalhes em `docs/DEPLOY.md`.
