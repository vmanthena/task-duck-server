import { Router } from 'express';
import { BCRYPT_SALT, BCRYPT_COST, PASSWORD_VERIFIER, SESSION_HOURS } from '../config.js';
import { createNonce, verifyProof, createToken } from '../services/authService.js';
import { getClientIP, isIPLocked, getLockSeconds, recordFail, clearFails } from '../middleware/rateLimiter.js';

const router = Router();
const MAX_ATTEMPTS = 3;

router.get('/api/auth/challenge', (req, res) => {
  const ip = getClientIP(req);
  if (isIPLocked(ip)) {
    res.status(429).json({ error: 'Locked', lockedFor: getLockSeconds(ip) });
    return;
  }
  const { nonce, timestamp } = createNonce();
  res.json({ nonce, timestamp, bcryptSalt: BCRYPT_SALT, bcryptCost: BCRYPT_COST });
});

router.post('/api/auth/login', (req, res) => {
  const ip = getClientIP(req);
  if (isIPLocked(ip)) {
    res.status(429).json({ error: 'Locked', lockedFor: getLockSeconds(ip) });
    return;
  }

  const { proof, timestamp } = req.body;
  if (proof && (typeof proof !== 'string' || !/^[a-f0-9]{64}$/.test(proof))) {
    res.status(400).json({ error: 'Bad proof' });
    return;
  }
  if (timestamp && (typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp))) {
    res.status(400).json({ error: 'Bad timestamp' });
    return;
  }

  if (!PASSWORD_VERIFIER) {
    res.json({ token: createToken(), expiresIn: SESSION_HOURS * 3600 });
    return;
  }

  if (!verifyProof(proof, timestamp)) {
    const rec = recordFail(ip);
    const rem = MAX_ATTEMPTS - rec.count;
    setTimeout(() => {
      if (rec.lockedUntil) res.status(429).json({ error: 'Locked', lockedFor: getLockSeconds(ip) });
      else res.status(401).json({ error: 'Invalid credentials', attemptsRemaining: Math.max(0, rem) });
    }, 500);
    return;
  }
  clearFails(ip);
  res.json({ token: createToken(), expiresIn: SESSION_HOURS * 3600 });
});

export default router;
