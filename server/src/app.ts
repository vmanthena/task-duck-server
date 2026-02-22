import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { LIMITS } from '../../shared/constants.js';
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

/** Serve pre-compressed .br / .gz files when available */
function preCompressed(publicDir: string): express.RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const accept = req.headers['accept-encoding'] || '';
    const filePath = path.join(publicDir, req.path);
    // Try brotli first, then gzip
    if (accept.includes('br') && existsSync(filePath + '.br')) {
      req.url += '.br';
      res.set('Content-Encoding', 'br');
      res.set('Vary', 'Accept-Encoding');
      const ext = path.extname(filePath);
      if (ext === '.js') res.set('Content-Type', 'application/javascript');
      else if (ext === '.css') res.set('Content-Type', 'text/css');
      else if (ext === '.html') res.set('Content-Type', 'text/html');
    } else if (accept.includes('gzip') && existsSync(filePath + '.gz')) {
      req.url += '.gz';
      res.set('Content-Encoding', 'gzip');
      res.set('Vary', 'Accept-Encoding');
      const ext = path.extname(filePath);
      if (ext === '.js') res.set('Content-Type', 'application/javascript');
      else if (ext === '.css') res.set('Content-Type', 'text/css');
      else if (ext === '.html') res.set('Content-Type', 'text/html');
    }
    next();
  };
}

export function createApp(): express.Express {
  const app = express();

  // Body parser
  app.use(express.json({ limit: `${LIMITS.bodyMaxKb}kb` }));

  // Compression for dynamic API responses
  app.use(compression());

  // Middleware chain (order matters)
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(sanitizerMiddleware);

  // Static files — serve pre-compressed when available, then fall back
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(preCompressed(publicDir));
  // Hashed assets (main-xxxxx.js/css) get immutable long-cache; everything else gets no-cache
  app.use(express.static(publicDir, {
    setHeaders(res, filePath) {
      if (/-[a-zA-Z0-9]{8,}\.(js|css)/.test(filePath)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      }
    },
  }));

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
