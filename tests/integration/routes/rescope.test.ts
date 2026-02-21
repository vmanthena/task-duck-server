import { describe, it, expect, afterEach } from 'vitest';
import { getApp, getAuthToken, authHeader, resetApp } from '../../helpers/supertest-app.js';

describe('POST /api/rescope', () => {
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
      .post('/api/rescope')
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required fields', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/rescope')
      .set(authHeader(t))
      .send({ provider: 'mock' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing fields');
  });

  it('returns 400 for unknown provider', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/rescope')
      .set(authHeader(t))
      .send({ provider: 'nonexistent', original: 'task', rewrite: 'task' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Unknown provider');
  });

  it('returns 200 with mock provider', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/rescope')
      .set(authHeader(t))
      .send({
        provider: 'mock',
        original: 'Build login page',
        rewrite: 'Build login page with auth and refactoring',
        dod: 'Tests pass',
        driftSummary: 'Added refactoring',
        justification: 'Needed for clean code',
      });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.provider).toBe('mock');
  });

  it('result has corrected_rewrite and corrected_dod', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/rescope')
      .set(authHeader(t))
      .send({
        provider: 'mock',
        original: 'task',
        rewrite: 'task',
      });
    expect(res.body.result.corrected_rewrite).toBeDefined();
    expect(res.body.result.corrected_dod).toBeDefined();
    expect(res.body.result.changes_made).toBeInstanceOf(Array);
  });

  it('result has suggested_story_points', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/rescope')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(res.body.result.suggested_story_points).toBeDefined();
  });

  it('handles optional story points', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/rescope')
      .set(authHeader(t))
      .send({
        provider: 'mock',
        original: 'task',
        rewrite: 'task',
        storyPoints: 5,
      });
    expect(res.status).toBe(200);
  });

  it('result has duck_quote', async () => {
    const t = await getToken();
    const res = await getApp()
      .post('/api/rescope')
      .set(authHeader(t))
      .send({ provider: 'mock', original: 'task', rewrite: 'task' });
    expect(typeof res.body.result.duck_quote).toBe('string');
  });
});
