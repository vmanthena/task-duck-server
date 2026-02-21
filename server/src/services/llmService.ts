import { ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_MODEL, GEMINI_MODEL, OLLAMA_BASE_URL, OLLAMA_MODEL, ollamaAvailable } from '../config.js';
import type { LLMCallFn } from '../types.js';
import { createLogger } from '../../../shared/logger.js';
import { LIMITS, RETRY } from '../../../shared/constants.js';

const log = createLogger('llm');

// Retry helper — backs off on 429/529 (overloaded)
async function fetchWithRetry(url: string, opts: RequestInit, retries = RETRY.attempts): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(url, opts);
    if (r.status === 429 || r.status === 529) {
      const wait = Math.min(RETRY.baseMs * Math.pow(2, i), RETRY.maxMs);
      log.warn(`${r.status} — waiting ${wait}ms (attempt ${i + 1}/${retries})`);
      await new Promise(res => setTimeout(res, wait));
      continue;
    }
    return r;
  }
  return fetch(url, opts);
}

function throwProviderError(provider: string, status: number, text: string): never {
  try {
    const d = JSON.parse(text);
    throw new Error(`${provider} (${status}): ${d.error?.message || text.substring(0, 200)}`);
  } catch (e) {
    if ((e as Error).message.startsWith(provider)) throw e;
    throw new Error(`${provider} (${status}): ${text.substring(0, 200)}`);
  }
}

const callAnthropic: LLMCallFn = async (s, u, modelOverride) => {
  const useModel = modelOverride || ANTHROPIC_MODEL;
  const r = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: useModel, max_tokens: LIMITS.llmMaxTokens, system: s, messages: [{ role: 'user', content: u }] })
  });
  if (!r.ok) throwProviderError('Anthropic', r.status, await r.text());
  const d = await r.json();
  return d.content?.[0]?.text || '';
};

const callOpenAI: LLMCallFn = async (s, u, _model) => {
  const r = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: LIMITS.llmMaxTokens, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: s }, { role: 'user', content: u }] })
  });
  if (!r.ok) throwProviderError('OpenAI', r.status, await r.text());
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
};

const callGemini: LLMCallFn = async (s, u, _model) => {
  const model = GEMINI_MODEL;
  const r = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: s }] },
      contents: [{ parts: [{ text: u }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: LIMITS.llmMaxTokens }
    })
  });
  if (!r.ok) throwProviderError('Gemini', r.status, await r.text());
  const d = await r.json();
  if (d.error) throw new Error(`Gemini: ${d.error.message}`);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const callOllama: LLMCallFn = async (s, u, modelOverride) => {
  const useModel = modelOverride || OLLAMA_MODEL;
  const r = await fetchWithRetry(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: useModel, max_tokens: LIMITS.llmMaxTokens, messages: [{ role: 'system', content: s }, { role: 'user', content: u }] })
  });
  if (!r.ok) throwProviderError('Ollama', r.status, await r.text());
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
};

const callMock: LLMCallFn = async (systemPrompt, _userPrompt, _model) => {
  // Simulate realistic delay
  const delay = 500 + Math.random() * 500;
  await new Promise(res => setTimeout(res, delay));

  const isRescope = systemPrompt.includes('Scope Re-evaluator');

  if (isRescope) {
    return JSON.stringify({
      corrected_rewrite: "This is a mock corrected rewrite that strictly matches the original task scope. It removes any additions and restores any missing items.",
      corrected_dod: "All original requirements are implemented, tests pass, no scope additions remain.",
      changes_made: [
        "Removed extra refactoring — not in original ticket",
        "Added back error handling requirement from original",
        "Simplified approach to match original scope"
      ],
      suggested_story_points: 3,
      duck_quote: "Mock duck says: stay in scope! 🦆"
    });
  }

  return JSON.stringify({
    verdict: 'match',
    confidence: 0.92,
    summary: "The rewrite accurately captures the original task's intent and scope.",
    scope_drift: { detected: false, items: [] },
    missing_items: { detected: false, items: [] },
    assumptions: { detected: false, items: [] },
    definition_of_done: { clear: true, suggestion: "Definition of done is specific and testable." },
    spelling_grammar: { issues: [] },
    suggestions: ["Consider adding a specific test case to validate the edge case."],
    duck_quote: "Mock duck approves! Clean match. 🦆"
  });
};

export const providers: Record<string, LLMCallFn> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  gemini: callGemini,
  ollama: callOllama,
  mock: callMock,
};

export function getProviderKey(provider: string): string {
  const keys: Record<string, string> = {
    anthropic: ANTHROPIC_API_KEY,
    openai: OPENAI_API_KEY,
    gemini: GEMINI_API_KEY,
    ollama: ollamaAvailable ? 'ollama' : '',
    mock: 'mock',
  };
  return keys[provider] || '';
}

export function hasAnyApiKey(): boolean {
  return !!(ANTHROPIC_API_KEY || OPENAI_API_KEY || GEMINI_API_KEY || ollamaAvailable);
}
