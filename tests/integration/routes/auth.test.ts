import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApp, resetApp } from '../../helpers/supertest-app.js';
import { clearFails } from '../../../server/src/middleware/rateLimiter.js';

describe('auth routes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    clearFails('127.0.0.1');
    clearFails('::ffff:127.0.0.1');
    clearFails('::1');
  });

  afterEach(() => {
    vi.useRealTimers();
    resetApp();
  });

  describe('GET /api/auth/challenge', () => {
    it('returns nonce and timestamp', async () => {
      const res = await getApp().get('/api/auth/challenge');
      expect(res.status).toBe(200);
      expect(res.body.nonce).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.timestamp).toMatch(/^\d+$/);
    });

    it('returns bcrypt salt and cost', async () => {
      const res = await getApp().get('/api/auth/challenge');
      expect(res.body).toHaveProperty('bcryptSalt');
      expect(res.body).toHaveProperty('bcryptCost');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns token with open auth (no PASSWORD_VERIFIER)', async () => {
      const res = await getApp()
        .post('/api/auth/login')
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.expiresIn).toBeGreaterThan(0);
    });

    it('returns 400 for bad proof format', async () => {
      const res = await getApp()
        .post('/api/auth/login')
        .send({ proof: 'not-hex-64' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Bad proof');
    });

    it('returns 400 for bad timestamp format', async () => {
      const res = await getApp()
        .post('/api/auth/login')
        .send({ timestamp: 'not-a-timestamp' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Bad timestamp');
    });

    it('token is a valid JWT format (payload.signature)', async () => {
      const res = await getApp()
        .post('/api/auth/login')
        .send({});
      const parts = res.body.token.split('.');
      expect(parts.length).toBe(2);
    });
  });
});
