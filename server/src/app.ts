import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { securityHeaders } from './middleware/security.js';
import { corsMiddleware } from './middleware/cors.js';
import { sanitizerMiddleware } from './middleware/sanitizer.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import providersRouter from './routes/providers.js';
import verifyRouter from './routes/verify.js';
import rescopeRouter from './routes/rescope.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): express.Express {
  const app = express();

  // Body parser
  app.use(express.json({ limit: '50kb' }));

  // Middleware chain (order matters)
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(sanitizerMiddleware);

  // Static files — serve from dist/public in production, or client dir in dev
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // Routes
  app.use(healthRouter);
  app.use(authRouter);
  app.use(providersRouter);
  app.use(verifyRouter);
  app.use(rescopeRouter);

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
