import type { RequestHandler } from 'express';
import { verifyToken } from '../services/authService.js';

export const requireAuth: RequestHandler = (req, res, next) => {
  const t = req.headers.authorization?.replace('Bearer ', '');
  if (!verifyToken(t)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};
