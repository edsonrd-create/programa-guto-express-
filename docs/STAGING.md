# Staging (Docker Compose)

## Subir

No VPS com Docker + Docker Compose:

```bash
git clone https://github.com/edsonrd-create/programa-guto-express-.git
cd programa-guto-express-

docker compose -f docker-compose.staging.yml up -d --build
```

Acesso:

- Painel: `http://<IP_DO_VPS>/`
- API (mesma origem): `http://<IP_DO_VPS>/api/health`
- WS: `ws://<IP_DO_VPS>/ws/ops`

## Variáveis recomendadas (staging/prod)

Edite `docker-compose.staging.yml` e defina:

- `METRICS_TOKEN`
- `OPS_WS_TOKEN`
- `WEBHOOK_ASYNC=1` (se tráfego alto)

## Persistência

SQLite fica no volume `guto_sqlite`.

Backups (exemplo):

```bash
docker exec -it <container_backend> ls -la /app/data
```
