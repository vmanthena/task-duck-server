import crypto from 'crypto';
import { JWT_SECRET, SESSION_HOURS, PASSWORD_VERIFIER } from '../config.js';

// Nonce store
interface NonceData {
  timestamp: string;
  created: number;
  used: boolean;
}

const nonceStore = new Map<string, NonceData>();
const NONCE_TTL_MS = 60000; // 60s for bcrypt

// Cleanup expired nonces every 60s
setInterval(() => {
  const now = Date.now();
  for (const [n, d] of nonceStore) {
    if (now - d.created > NONCE_TTL_MS * 2) nonceStore.delete(n);
  }
}, 60000);

export function createNonce(): { nonce: string; timestamp: string } {
  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = String(Date.now());
  nonceStore.set(nonce, { timestamp, created: Date.now(), used: false });
  return { nonce, timestamp };
}

export function verifyProof(proof: string | undefined, timestamp: string | undefined): boolean {
  if (!proof || !timestamp || !PASSWORD_VERIFIER) return false;
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Date.now() - ts > NONCE_TTL_MS) return false;

  let matchedNonce: string | null = null;
  for (const [nonce, data] of nonceStore) {
    if (data.timestamp === timestamp && !data.used) { matchedNonce = nonce; break; }
  }
  if (!matchedNonce) return false;

  const nd = nonceStore.get(matchedNonce)!;
  if (Date.now() - nd.created > NONCE_TTL_MS) { nonceStore.delete(matchedNonce); return false; }

  const expected = crypto.createHash('sha256').update(PASSWORD_VERIFIER + matchedNonce + timestamp).digest('hex');
  if (proof.length !== expected.length) return false;
  let valid: boolean;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
  if (valid) nd.used = true;
  return valid;
}

export function createToken(): string {
  const p = { iat: Date.now(), exp: Date.now() + SESSION_HOURS * 3600000, jti: crypto.randomBytes(8).toString('hex') };
  const d = Buffer.from(JSON.stringify(p)).toString('base64url');
  const s = crypto.createHmac('sha256', JWT_SECRET).update(d).digest('base64url');
  return `${d}.${s}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [d, s] = token.split('.');
  if (!d || !s) return false;
  try {
    const exp = crypto.createHmac('sha256', JWT_SECRET).update(d).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) return false;
    return JSON.parse(Buffer.from(d, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}
