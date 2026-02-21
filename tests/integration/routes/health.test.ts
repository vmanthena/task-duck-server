import { describe, it, expect } from 'vitest';
import { getApp } from '../../helpers/supertest-app.js';
import { VERSION } from '../../../shared/constants.js';

describe('GET /api/health', () => {
  it('returns 200', async () => {
    const res = await getApp().get('/api/health');
    expect(res.status).toBe(200);
  });

  it('returns status ok and version', async () => {
    const res = await getApp().get('/api/health');
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe(VERSION);
  });
});
