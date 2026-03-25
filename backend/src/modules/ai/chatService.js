import { buildOperationalSnapshot } from '../ops/snapshotBuilder.js';
import { chatCompletions } from './openaiClient.js';

const SYSTEM_PROMPT = `O teu trabalho e ajudar a operacao de uma pizzaria (Portugal / Brasil).
Respostas em portugues, curtas e acionaveis.
Nao inventes dados: usa apenas o contexto fornecido (JSON).
Se faltar informacao, diz o que falta e sugere o proximo passo.
Nao executas acoes: apenas aconselha.`;

function normalizeUserMessages(body) {
  if (typeof body?.message === 'string') {
    const t = body.message.trim();
    return t ? [{ role: 'user', content: t }] : [];
  }
  const arr = Array.isArray(body?.messages) ? body.messages : [];
  const filtered = arr
    .filter((m) => m && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0);
  return filtered.slice(-20);
}

export async function runOperationalChat(db, body, cfg) {
  const userMessages = normalizeUserMessages(body || {});
  if (!userMessages.length) {
    const err = new Error('Envie "message" (texto) ou "messages" (array)');
    err.statusCode = 400;
    throw err;
  }

  const includeSnapshot = body?.includeSnapshot !== false;
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (includeSnapshot) {
    const snap = buildOperationalSnapshot(db);
    const slim = {
      generatedAt: snap.generatedAt,
      counts: {
        orders: snap.orders?.length ?? 0,
        deliveries: snap.deliveries?.length ?? 0,
        drivers: snap.drivers?.length ?? 0,
        queue: snap.driverQueue?.length ?? 0,
        kds: snap.kds?.length ?? 0
      },
      aiRules: snap.ai
    };
    messages.push({ role: 'system', content: `Contexto operacional (JSON): ${JSON.stringify(slim)}` });
  }

  messages.push(...userMessages);

  const out = await chatCompletions({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model: cfg.model,
    messages,
    maxTokens: 1400,
    timeoutMs: cfg.timeoutMs
  });

  return { reply: out.text, model: out.model, usage: out.usage };
}

