import supertest from 'supertest';
import { createApp } from '../../server/src/app.js';

let app: ReturnType<typeof createApp> | null = null;

export function getApp() {
  if (!app) app = createApp();
  return supertest(app);
}

export function resetApp() {
  app = null;
}

export async function getAuthToken(): Promise<string> {
  const res = await getApp()
    .post('/api/auth/login')
    .send({});
  return res.body.token;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
