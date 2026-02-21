import type { Request } from 'express';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('auth');

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 20 * 60 * 1000;

export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return forwardedStr?.split(',')[0]?.trim()
    || (req.headers['x-real-ip'] as string | undefined)
    || req.socket.remoteAddress || 'unknown';
}

export function isIPLocked(ip: string): boolean {
  const r = loginAttempts.get(ip);
  if (!r) return false;
  if (r.lockedUntil && Date.now() < r.lockedUntil) return true;
  if (r.lockedUntil && Date.now() >= r.lockedUntil) { loginAttempts.delete(ip); return false; }
  return false;
}

export function recordFail(ip: string): AttemptRecord {
  const r = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  r.count++;
  if (r.count >= MAX_ATTEMPTS) {
    r.lockedUntil = Date.now() + LOCKOUT_MS;
    log.warn(`IP ${ip} locked 20min (${r.count} fails)`);
  }
  loginAttempts.set(ip, r);
  return r;
}

export function clearFails(ip: string): void {
  loginAttempts.delete(ip);
}

export function getLockSeconds(ip: string): number {
  const r = loginAttempts.get(ip);
  return r?.lockedUntil ? Math.max(0, Math.ceil((r.lockedUntil - Date.now()) / 1000)) : 0;
}

// Cleanup expired lockouts every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, d] of loginAttempts) {
    if (d.lockedUntil && now > d.lockedUntil + 60000) loginAttempts.delete(ip);
  }
}, 300000);
