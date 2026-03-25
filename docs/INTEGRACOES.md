# Integrações (delivery) — Guto V53

As **rotas da API** ficam no backend. O que costuma “sumir” após reinstalar/copiar a pasta são os **registros no SQLite** (`backend/database.sqlite`), porque tokens e canais ficam no banco.

## Backup (importante)

Copie com frequência:

- `backend/database.sqlite`
- (opcional) `backend/database.sqlite-wal` e `database.sqlite-shm` se existirem

## Restaurar canais padrão no banco

Na pasta `backend`:

```bash
npm run seed:integrations
```

Isso cria os canais **ifood**, **neemo**, **expresso_delivery**, **99food** (inativos até você ativar e preencher token/segredo).

## Endpoints

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/integrations` | Lista integrações |
| POST | `/integrations` | Cria integração (body: `name`, `channel`, `token`, `webhook_secret`, `active`, `auto_accept`) |
| POST | `/integrations/webhook/:channel` | Webhook de pedido (ex.: `:channel` = `ifood`) |
| GET | `/integrations/orders` | Pedidos brutos recebidos |
| GET | `/integrations/logs` | Logs |
| GET | `/integrations/review-queue` | Fila de revisão (com `external_order_id` e `payload_json`) |
| POST | `/integrations/review-queue/:id/resolve` | Marca item como resolvido (`resolved_at`) |
| GET | `/integrations/webhook-jobs?limit=80` | Fila SQLite de jobs quando `WEBHOOK_ASYNC=1` |

## Integração precisa estar **ativa**

No painel **Integrações**, use **Ativar** (ou `PATCH /integrations/:id` com `active: true`).  
Webhook em canal **inativo** responde **403**.

## URL de webhook (exemplo local)

`POST http://localhost:3210/integrations/webhook/ifood`

Corpo JSON mínimo para aceitar automático:

```json
{
  "externalOrderId": "ext-123",
  "customer": { "name": "Maria", "phone": "11999990000" },
  "items": [{ "name": "Pizza Grande Meia Calabresa", "quantity": 1, "price": 59.9 }],
  "total": 59.9
}
```

Se faltar item/cliente/total válido, o pedido vai para **revisão** (`mode: review`).

## Endereço e roteirização (webhook)

O normalizador lê campos opcionais para `orders.delivery_*`:

- `delivery_address`, `deliveryAddress`, `address`, `shipping_address` ou objeto `delivery: { address, lat, lng, neighborhood }`
- Partes soltas: `delivery_street`, `delivery_number`, `delivery_neighborhood`, `delivery_city`, `delivery_state`
- Coordenadas: `delivery_lat` / `delivery_lng` ou `latitude` / `longitude`

Com **`WEBHOOK_GEOCODE_DELIVERY=1`** e **`GOOGLE_MAPS_API_KEY`** (Geocoding API), após criar o pedido o servidor tenta preencher **lat/lng** quando há texto de endereço ≥ 5 caracteres e faltam coordenadas. A resposta do webhook pode incluir `geocode: { ok: true, ... }` ou `skipped` / `error`.

Exemplo com endereço:

```json
{
  "externalOrderId": "ext-456",
  "customer": { "name": "João", "phone": "11988887777" },
  "items": [{ "name": "Combo", "quantity": 1, "price": 40 }],
  "total": 40,
  "delivery_address": "Rua XV de Novembro, 100, Curitiba, PR"
}
```
