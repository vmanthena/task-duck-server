import { describe, it, expect, afterEach } from 'vitest';
import { getApp, resetApp } from '../helpers/supertest-app.js';

describe('E2E: full flow', () => {
  afterEach(() => {
    resetApp();
  });

  it('login → get token', async () => {
    const res = await getApp()
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.expiresIn).toBeGreaterThan(0);
  });

  it('login → get providers → includes mock', async () => {
    const loginRes = await getApp()
      .post('/api/auth/login')
      .send({});
    const token = loginRes.body.token;

    const provRes = await getApp()
      .get('/api/providers')
      .set({ Authorization: `Bearer ${token}` });
    expect(provRes.status).toBe(200);
    const ids = provRes.body.providers.map((p: { id: string }) => p.id);
    expect(ids).toContain('mock');
  });

  it('login → verify with mock → get match verdict', async () => {
    const loginRes = await getApp()
      .post('/api/auth/login')
      .send({});
    const token = loginRes.body.token;

    const verifyRes = await getApp()
      .post('/api/verify')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        provider: 'mock',
        original: 'Add user authentication',
        rewrite: 'Add user authentication',
      });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.result.verdict).toBe('match');
    expect(verifyRes.body.result.confidence).toBeGreaterThan(0);
  });

  it('login → verify → rescope corrected output', async () => {
    const loginRes = await getApp()
      .post('/api/auth/login')
      .send({});
    const token = loginRes.body.token;

    const rescopeRes = await getApp()
      .post('/api/rescope')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        provider: 'mock',
        original: 'Build login page',
        rewrite: 'Build login page with extra refactoring',
        dod: 'Tests pass',
        driftSummary: 'Added refactoring that was not in scope',
        justification: 'Code was too messy to leave',
      });
    expect(rescopeRes.status).toBe(200);
    expect(rescopeRes.body.result.corrected_rewrite).toBeDefined();
    expect(rescopeRes.body.result.changes_made.length).toBeGreaterThan(0);
  });

  it('story points flow', async () => {
    const loginRes = await getApp()
      .post('/api/auth/login')
      .send({});
    const token = loginRes.body.token;

    const verifyRes = await getApp()
      .post('/api/verify')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        provider: 'mock',
        original: 'task',
        rewrite: 'task',
        storyPoints: 5,
      });
    expect(verifyRes.status).toBe(200);
  });

  it('token persists across requests', async () => {
    const loginRes = await getApp()
      .post('/api/auth/login')
      .send({});
    const token = loginRes.body.token;

    // First request
    const res1 = await getApp()
      .get('/api/providers')
      .set({ Authorization: `Bearer ${token}` });
    expect(res1.status).toBe(200);

    // Second request with same token
    const res2 = await getApp()
      .post('/api/verify')
      .set({ Authorization: `Bearer ${token}` })
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(res2.status).toBe(200);
  });

  it('expired token is rejected', async () => {
    // Create a manually tampered token
    const res = await getApp()
      .get('/api/providers')
      .set({ Authorization: 'Bearer invalid.token' });
    expect(res.status).toBe(401);
  });

  it('health check does not require auth', async () => {
    const res = await getApp().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
