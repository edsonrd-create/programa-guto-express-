import { z } from 'zod';

export function validationErrorResponse(zodError) {
  return {
    ok: false,
    code: 'VALIDATION_ERROR',
    message: 'Payload invalido',
    issues: zodError.issues.map((i) => ({
      path: i.path.length ? i.path.join('.') : '(root)',
      message: i.message,
    })),
  };
}

export const ClientCreateBodySchema = z.object({
  name: z.string().trim().min(1, 'name obrigatorio').max(200),
  phone: z
    .string()
    .trim()
    .min(8, 'phone muito curto')
    .max(32, 'phone muito longo')
    .regex(/^[0-9+\s().\-/]+$/, 'phone com caracteres invalidos'),
});

export const OrderCreateBodySchema = z
  .object({
    client_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    total: z.coerce.number().finite().min(0).optional().default(0),
    delivery_fee: z.coerce.number().finite().min(0).optional().default(0),
    delivery_neighborhood: z.union([z.string().trim().max(120), z.null()]).optional(),
    skip_zone_pricing: z.coerce.boolean().optional().default(false),
  })
  .transform((o) => ({
    client_id: o.client_id === undefined || o.client_id === null ? null : o.client_id,
    total: o.total ?? 0,
    delivery_fee: o.delivery_fee ?? 0,
    delivery_neighborhood:
      o.delivery_neighborhood === undefined || o.delivery_neighborhood === null || o.delivery_neighborhood === ''
        ? null
        : o.delivery_neighborhood,
    skip_zone_pricing: Boolean(o.skip_zone_pricing),
  }));
