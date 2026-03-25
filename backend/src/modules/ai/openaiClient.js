/**
 * Cliente HTTP mínimo para OpenAI Chat Completions (sem SDK extra).
 */
export async function chatCompletions(opts) {
  const {
    baseUrl,
    apiKey,
    model,
    messages,
    maxTokens = 1200,
    timeoutMs = 75_000
  } = opts;

  const url = `${baseUrl}/chat/completions`;

  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(Math.max(5_000, timeoutMs))
      : undefined;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.4
    }),
    signal
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI respondeu nao-JSON (${res.status}): ${raw.slice(0, 300)}`);
  }

  if (!res.ok) {
    const msg = data?.error?.message || raw.slice(0, 500);
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('OpenAI: resposta sem texto');

  return { text: text.trim(), usage: data.usage ?? null, model: data.model ?? model };
}

