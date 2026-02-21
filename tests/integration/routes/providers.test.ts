import { describe, it, expect, afterEach } from 'vitest';
import { getApp, getAuthToken, authHeader, resetApp } from '../../helpers/supertest-app.js';

describe('GET /api/providers', () => {
  afterEach(() => {
    resetApp();
  });

  it('returns 401 without auth token', async () => {
    const res = await getApp().get('/api/providers');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid auth token', async () => {
    const token = await getAuthToken();
    const res = await getApp()
      .get('/api/providers')
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.providers).toBeInstanceOf(Array);
  });

  it('includes mock provider when no API keys configured', async () => {
    const token = await getAuthToken();
    const res = await getApp()
      .get('/api/providers')
      .set(authHeader(token));
    // In test env without API keys, mock should be available
    const ids = res.body.providers.map((p: { id: string }) => p.id);
    expect(ids).toContain('mock');
  });

  it('each provider has required fields', async () => {
    const token = await getAuthToken();
    const res = await getApp()
      .get('/api/providers')
      .set(authHeader(token));
    for (const p of res.body.providers) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('model');
      expect(p).toHaveProperty('cost');
    }
  });

  it('mock provider has correct metadata', async () => {
    const token = await getAuthToken();
    const res = await getApp()
      .get('/api/providers')
      .set(authHeader(token));
    const mock = res.body.providers.find((p: { id: string }) => p.id === 'mock');
    if (mock) {
      expect(mock.name).toBe('Mock (Dev)');
      expect(mock.model).toBe('mock-v1');
      expect(mock.cost).toBe('free');
    }
  });
});
