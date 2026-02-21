import { Router } from 'express';
import { VERSION } from '../../../shared/constants.js';

const router = Router();

router.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: VERSION });
});

export default router;
