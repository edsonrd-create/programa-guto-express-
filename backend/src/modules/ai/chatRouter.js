import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { getOpenAiConfig } from '../../config/openaiEnv.js';
import { runOperationalChat } from './chatService.js';

const bearerTokenFromHeader = (h) => {
  const s = String(h || '');
  const m = /^Bearer\s+(.+)$/i.exec(s.trim());
  return m ? m[1] : '';
};

const ChatBodySchema = z
  .object({
    message: z.string().max(8000).optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string().max(8000)
        })
      )
      .optional(),
    includeSnapshot: z.boolean().optional().default(true)
  })
  .refine(
    (d) =>
      (typeof d.message === 'string' && d.message.trim().length > 0) ||
      (Array.isArray(d.messages) && d.messages.length > 0),
    { message: 'Envie "message" ou "messages" (array).' }
  );

export function createChatRouter(db) {
  const r = express.Router();

  r.get('/chat/status', (_req, res) => {
    const cfg = getOpenAiConfig();
    res.json({
      ok: true,
      active: cfg.enabled,
      model: cfg.model,
      hint: cfg.enabled
        ? 'Chat disponivel.'
        : 'Defina OPENAI_API_KEY e nao force OPENAI_ENABLED=0.'
    });
  });

  const limiter = rateLimit({
    windowMs: Number(process.env.AI_CHAT_RATE_WINDOW_MS || 60_000),
    max: Number(process.env.AI_CHAT_RATE_MAX || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: 'RATE_LIMIT',
      message: 'Limite de mensagens IA excedido; aguarde e tente novamente.'
    },
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req);
      const bearer = bearerTokenFromHeader(req.headers.authorization);
      return `${ip}:${bearer.slice(0, 24)}`;
    }
  });

  r.post('/chat', limiter, async (req, res, next) => {
    try {
      const cfg = getOpenAiConfig();
      if (!cfg.enabled) {
        return res.status(503).json({
          ok: false,
          code: 'OPENAI_DISABLED',
          message: 'OpenAI inativo. Defina OPENAI_API_KEY ou remova OPENAI_ENABLED=0.'
        });
      }

      const adminKey = (process.env.ADMIN_API_KEY || '').trim();
      if (adminKey) {
        const provided = bearerTokenFromHeader(req.headers.authorization);
        if (!provided || provided !== adminKey) {
          return res.status(401).json({
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Bearer invalido (ADMIN_API_KEY ativo).'
          });
        }
      }

      const parsed = ChatBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_ERROR',
          issues: parsed.error.flatten()
        });
      }

      const out = await runOperationalChat(db, parsed.data, cfg);
      return res.json({ ok: true, ...out });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

