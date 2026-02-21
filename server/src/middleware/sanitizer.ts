import type { RequestHandler } from 'express';
import { LIMITS } from '../../../shared/constants.js';

function sanitize(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '')
    .substring(0, LIMITS.stringMaxLen);
}

function sanitizeBody(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj;
  const c: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') c[k] = sanitize(v);
    else if (typeof v === 'number' || typeof v === 'boolean') c[k] = v;
  }
  return c;
}

export const sanitizerMiddleware: RequestHandler = (req, _res, next) => {
  if (req.method === 'POST' && req.body) {
    req.body = sanitizeBody(req.body as Record<string, unknown>);
  }
  next();
};
