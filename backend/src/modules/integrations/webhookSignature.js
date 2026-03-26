import crypto from 'crypto';

/** Header enviado pelo parceiro: HMAC-SHA256 do corpo bruto (mesmos bytes do JSON recebido). */
export const WEBHOOK_SIGNATURE_HEADER = 'x-guto-webhook-signature';

/**
 * Formato do header: `sha256=` + 64 caracteres hexadecimais (minúsculos ou maiúsculos).
 * Se `webhook_secret` da integração estiver vazio, a verificação é ignorada.
 *
 * @param {string|null|undefined} secret
 * @param {Buffer|undefined} rawBody buffer do body exatamente como recebido (express.json verify)
 * @param {string|string[]|undefined} headerValue req.headers[WEBHOOK_SIGNATURE_HEADER]
 * @returns {{ ok: boolean, skipped?: boolean }}
 */
export function verifyWebhookSignature(secret, rawBody, headerValue) {
  const s = secret != null ? String(secret).trim() : '';
  if (!s) return { ok: true, skipped: true };
  if (!rawBody || !Buffer.isBuffer(rawBody)) return { ok: false };
  const hv = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const raw = hv != null ? String(hv).trim() : '';
  if (!raw) return { ok: false };

  const hex = raw.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return { ok: false };

  const expectedHex = crypto.createHmac('sha256', s).update(rawBody).digest('hex');
  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(hex, 'hex');
  if (a.length !== b.length) return { ok: false };
  return { ok: crypto.timingSafeEqual(a, b) };
}
