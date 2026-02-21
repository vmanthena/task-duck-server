import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing llmService
vi.mock('../../../../server/src/config.js', () => ({
  ANTHROPIC_API_KEY: 'sk-ant-test-key-123',
  OPENAI_API_KEY: 'sk-openai-test-123',
  GEMINI_API_KEY: 'gemini-test-key',
  ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
  GEMINI_MODEL: 'gemini-2.0-flash-lite',
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'qwen2.5:7b',
  ollamaAvailable: false,
  LOG_LEVEL: 'error',
}));

// Mock shared logger
vi.mock('../../../../shared/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { providers, getProviderKey, hasAnyApiKey } from '../../../../server/src/services/llmService.js';

describe('llmService', () => {
  describe('providers object', () => {
    it('has all 5 providers', () => {
      expect(Object.keys(providers)).toEqual(['anthropic', 'openai', 'gemini', 'ollama', 'mock']);
    });

    it('each provider is a function', () => {
      for (const fn of Object.values(providers)) {
        expect(typeof fn).toBe('function');
      }
    });
  });

  describe('getProviderKey', () => {
    it('returns anthropic key', () => {
      expect(getProviderKey('anthropic')).toBe('sk-ant-test-key-123');
    });

    it('returns openai key', () => {
      expect(getProviderKey('openai')).toBe('sk-openai-test-123');
    });

    it('returns gemini key', () => {
      expect(getProviderKey('gemini')).toBe('gemini-test-key');
    });

    it('returns "mock" for mock provider', () => {
      expect(getProviderKey('mock')).toBe('mock');
    });

    it('returns empty string for unknown provider', () => {
      expect(getProviderKey('unknown')).toBe('');
    });
  });

  describe('hasAnyApiKey', () => {
    it('returns true when API keys are configured', () => {
      expect(hasAnyApiKey()).toBe(true);
    });
  });

  describe('callMock provider', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns verify response for non-rescope prompts', async () => {
      const promise = providers.mock('Task Verifier', 'user prompt');
      // Advance timer past delay
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      const parsed = JSON.parse(result);
      expect(parsed.verdict).toBe('match');
      expect(parsed.confidence).toBe(0.92);
      expect(parsed.duck_quote).toBeDefined();
    });

    it('returns rescope response when systemPrompt contains "Scope Re-evaluator"', async () => {
      const promise = providers.mock('Task Scope Re-evaluator', 'user prompt');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      const parsed = JSON.parse(result);
      expect(parsed.corrected_rewrite).toBeDefined();
      expect(parsed.corrected_dod).toBeDefined();
      expect(parsed.changes_made).toBeInstanceOf(Array);
      expect(parsed.suggested_story_points).toBe(3);
    });
  });

  describe('callAnthropic', () => {
    it('sends correct URL and headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: '{"verdict":"match"}' }] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await providers.anthropic('system', 'user');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(opts.headers['x-api-key']).toBe('sk-ant-test-key-123');
      expect(opts.headers['anthropic-version']).toBe('2023-06-01');
      const body = JSON.parse(opts.body);
      expect(body.model).toBe('claude-sonnet-4-20250514');
      expect(body.system).toBe('system');

      vi.unstubAllGlobals();
    });

    it('uses model override when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'response' }] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await providers.anthropic('sys', 'usr', 'claude-haiku-4-5-20251001');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('claude-haiku-4-5-20251001');

      vi.unstubAllGlobals();
    });
  });

  describe('callOpenAI', () => {
    it('sends correct URL and headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{}' } }] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await providers.openai('system', 'user');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(opts.headers['Authorization']).toBe('Bearer sk-openai-test-123');
      const body = JSON.parse(opts.body);
      expect(body.model).toBe('gpt-4o');
      expect(body.response_format).toEqual({ type: 'json_object' });

      vi.unstubAllGlobals();
    });
  });

  describe('callGemini', () => {
    it('sends correct URL with API key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await providers.gemini('system', 'user');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('key=gemini-test-key');
      expect(url).toContain('gemini-2.0-flash-lite');

      vi.unstubAllGlobals();
    });
  });

  describe('fetchWithRetry (tested through providers)', () => {
    it('retries on 429 status', async () => {
      vi.useFakeTimers();
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate limited' })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: [{ text: '{}' }] }),
        });
      vi.stubGlobal('fetch', mockFetch);

      const promise = providers.anthropic('sys', 'usr');
      // Advance past retry delay
      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);

      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('throws on non-retryable error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"error":{"message":"Invalid API key"}}',
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(providers.anthropic('sys', 'usr')).rejects.toThrow('Anthropic (401)');

      vi.unstubAllGlobals();
    });
  });
});
