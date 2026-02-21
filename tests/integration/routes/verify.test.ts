import { describe, it, expect, afterEach } from 'vitest';
import { getApp, getAuthToken, authHeader, resetApp } from '../../helpers/supertest-app.js';

describe('POST /api/verify', () => {
  let token: string;

  afterEach(() => {
    resetApp();
  });

  async function getToken() {
    if (!token) token = await getAuthToken();
    return token;
  }

  it('returns 401 without auth', async () => {
    const res = await getApp()
      .post('/api/verify')
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required fields', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing fields');
  });

  it('returns 400 for unknown provider', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'nonexistent', original: 'task', rewrite: 'task' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Unknown provider');
  });

  it('returns 400 for unconfigured provider', async () => {
    const t = await getToken();
    // anthropic requires API key which isn't set in test env
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'anthropic', original: 'task', rewrite: 'task' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not configured');
  });

  it('returns 200 with mock provider', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'Build login page', rewrite: 'Build login page with auth' });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.provider).toBe('mock');
  });

  it('result has verdict and confidence', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(res.body.result.verdict).toBeDefined();
    expect(res.body.result.confidence).toBeDefined();
  });

  it('result has summary and duck_quote', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(typeof res.body.result.summary).toBe('string');
    expect(typeof res.body.result.duck_quote).toBe('string');
  });

  it('includes masking report', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(res.body.masking).toBeDefined();
    expect(res.body.masking).toHaveProperty('itemsMasked');
    expect(res.body.masking).toHaveProperty('report');
  });

  it('masks sensitive data in request', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({
        provider: 'mock',
        original: 'Connect to user@example.com',
        rewrite: 'Connect to user@example.com',
      });
    expect(res.status).toBe(200);
    expect(res.body.masking.itemsMasked).toBeGreaterThan(0);
  });

  it('handles optional fields', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({
        provider: 'mock',
        original: 'task',
        rewrite: 'task',
        deliverable: 'a PR',
        notAsked: 'nothing extra',
        definitionOfDone: 'tests pass',
        storyPoints: 3,
      });
    expect(res.status).toBe(200);
  });

  it('returns match verdict from mock', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(res.body.result.verdict).toBe('match');
    expect(res.body.result.confidence).toBeGreaterThan(0);
  });

  it('returns 400 for missing original', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock', rewrite: 'task' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing rewrite', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'task' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing provider', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/verify')
      .set(authHeader(t))
      .send({ original: 'task', rewrite: 'task' });
    expect(res.status).toBe(400);
  });
});
