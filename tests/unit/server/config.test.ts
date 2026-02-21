import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('BCRYPT_COST clamping', () => {
    it('clamps cost below minimum to minCost', async () => {
      vi.stubEnv('BCRYPT_COST', '5');
      // We need to re-import to pick up the new env
      const { BCRYPT_COST } = await import('../../../server/src/config.js');
      const { BCRYPT } = await import('../../../shared/constants.js');
      // BCRYPT_COST should be at least minCost (15)
      expect(BCRYPT_COST).toBeGreaterThanOrEqual(BCRYPT.minCost);
    });
  });

  describe('printDiagnostics', () => {
    it('is a function', async () => {
      const { printDiagnostics } = await import('../../../server/src/config.js');
      expect(typeof printDiagnostics).toBe('function');
    });

    it('runs without throwing', async () => {
      const { printDiagnostics } = await import('../../../server/src/config.js');
      expect(() => printDiagnostics()).not.toThrow();
    });
  });

  describe('probeOllama', () => {
    it('is a function', async () => {
      const { probeOllama } = await import('../../../server/src/config.js');
      expect(typeof probeOllama).toBe('function');
    });

    it('handles fetch failure gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
      const { probeOllama } = await import('../../../server/src/config.js');
      await expect(probeOllama()).resolves.toBeUndefined();
      vi.unstubAllGlobals();
    });

    it('sets ollamaAvailable on success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const mod = await import('../../../server/src/config.js');
      await mod.probeOllama();
      expect(mod.ollamaAvailable).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe('cleanEnv', () => {
    it('strips quotes from env values (tested via PASSWORD_VERIFIER)', async () => {
      vi.stubEnv('PASSWORD_VERIFIER', '"quoted-value"');
      const { PASSWORD_VERIFIER } = await import('../../../server/src/config.js');
      // cleanEnv strips leading/trailing quotes
      expect(PASSWORD_VERIFIER).not.toContain('"');
    });

    it('strips whitespace from env values', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '  sk-ant-test  ');
      const { ANTHROPIC_API_KEY } = await import('../../../server/src/config.js');
      expect(ANTHROPIC_API_KEY).not.toMatch(/^\s/);
      expect(ANTHROPIC_API_KEY).not.toMatch(/\s$/);
    });
  });

  describe('defaults', () => {
    it('SESSION_HOURS defaults to 24', async () => {
      const { SESSION_HOURS } = await import('../../../server/src/config.js');
      expect(SESSION_HOURS).toBe(24);
    });

    it('PORT defaults to 8080', async () => {
      const { PORT } = await import('../../../server/src/config.js');
      expect(PORT).toBe(8080);
    });

    it('JWT_SECRET is generated if not set', async () => {
      const { JWT_SECRET } = await import('../../../server/src/config.js');
      expect(JWT_SECRET.length).toBeGreaterThan(0);
    });
  });
});
