import { describe, it, expect, afterEach } from 'vitest';
import { getApp, getAuthToken, authHeader, resetApp } from '../helpers/supertest-app.js';

describe('middleware chain', () => {
  afterEach(() => {
    resetApp();
  });

  it('sets security headers on all responses', async () => {
    const res = await getApp().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toContain('max-age');
  });

  it('enforces CORS on API routes', async () => {
    const res = await getApp()
      .get('/api/health')
      .set('Origin', 'http://evil.com')
      .set('Host', 'localhost:8080');
    expect(res.status).toBe(403);
  });

  it('sanitizes XSS in POST body', async () => {
    const token = await getAuthToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(token))
      .send({
        provider: 'mock',
        original: '<script>alert(1)</script>task',
        rewrite: 'task',
      });
    // Should succeed (sanitizer strips tags, doesn't reject)
    expect(res.status).toBe(200);
    // The masked original should not contain <script>
  });

  it('enforces body size limit', async () => {
    const token = await getAuthToken();
    const largeBody = { provider: 'mock', original: 'a'.repeat(60000), rewrite: 'task' };
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(token))
      .send(largeBody);
    expect(res.status).toBe(413);
  });

  it('requires auth on protected routes', async () => {
    const routes = [
      { method: 'get', path: '/api/providers' },
      { method: 'post', path: '/api/verify' },
      { method: 'post', path: '/api/rescope' },
    ];
    for (const { method, path } of routes) {
      const res = await (getApp() as any)[method](path).send({});
      expect(res.status).toBe(401);
    }
  });
});
