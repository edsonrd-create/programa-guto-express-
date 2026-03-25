/**
 * Configuração OpenAI (ChatGPT) baseada em variáveis de ambiente.
 *
 * Ativa se `OPENAI_API_KEY` existir e `OPENAI_ENABLED` nao for '0'/'false'/'off'.
 */
export function getOpenAiConfig() {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  const flag = (process.env.OPENAI_ENABLED || '').trim().toLowerCase();
  const forcedOff = flag === '0' || flag === 'false' || flag === 'off';
  const enabled = Boolean(apiKey) && !forcedOff;

  return {
    enabled,
    apiKey: enabled ? apiKey : '',
    model: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 75_000) || 75_000
  };
}

