import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, GEMINI_MODEL, ollamaAvailable, OLLAMA_MODEL } from '../config.js';
import { hasAnyApiKey } from '../services/llmService.js';
import type { ProviderInfo } from '../types.js';

const router = Router();

router.get('/api/providers', requireAuth, (_req, res) => {
  const a: ProviderInfo[] = [];
  if (GEMINI_API_KEY) a.push({ id: 'gemini', name: 'Gemini Flash Lite', model: GEMINI_MODEL, cost: 'free' });
  if (OPENAI_API_KEY) a.push({ id: 'openai', name: 'GPT-4o (OpenAI)', model: 'gpt-4o', cost: 'low' });
  if (ANTHROPIC_API_KEY) {
    a.push({ id: 'anthropic', name: 'Claude Haiku', model: 'claude-haiku-4-5-20251001', cost: 'low' });
    a.push({ id: 'anthropic', name: 'Claude Sonnet', model: 'claude-sonnet-4-20250514', cost: 'medium' });
  }
  if (ollamaAvailable) a.push({ id: 'ollama', name: 'Ollama (Local)', model: OLLAMA_MODEL, cost: 'free' });
  if (!hasAnyApiKey()) {
    a.push({ id: 'mock', name: 'Mock (Dev)', model: 'mock-v1', cost: 'free' });
  }
  res.json({ providers: a });
});

export default router;
