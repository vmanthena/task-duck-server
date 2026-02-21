import type { RequestHandler } from 'express';

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && req.path.startsWith('/api/')) {
    const host = req.headers.host;
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        res.status(403).json({ error: 'Cross-origin not allowed' });
        return;
      }
    } catch {
      // If we can't parse, let it through (same-origin requests may have odd origins)
    }
  }
  next();
};
