import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

vi.mock(import('../../../../server/src/config.js'), () => ({
  JWT_SECRET: 'test-jwt-secret-key-1234567890',
  SESSION_HOURS: 24,
  PASSWORD_VERIFIER: 'test-password-verifier',
  LOG_LEVEL: 'error',
}));

vi.mock(import('../../../../shared/logger.js'), () => ({
  configureLogger: vi.fn(),
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { createNonce, verifyProof, createToken, verifyToken } from '../../../../server/src/services/authService.js';
import { PASSWORD_VERIFIER } from '../../../../server/src/config.js';

describe('authService', () => {
  beforeEach(() => {
    // shouldAdvanceTime: true keeps Date.now() ticking naturally (unique timestamps)
    // while still controlling setTimeout/setInterval
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('config mock provides PASSWORD_VERIFIER', () => {
    expect(PASSWORD_VERIFIER).toBe('test-password-verifier');
  });

  describe('createNonce', () => {
    it('returns a 64-char hex nonce and timestamp', () => {
      const { nonce, timestamp } = createNonce();
      expect(nonce).toMatch(/^[a-f0-9]{64}$/);
      expect(timestamp).toMatch(/^\d+$/);
    });

    it('returns unique nonces per call', () => {
      const a = createNonce();
      const b = createNonce();
      expect(a.nonce).not.toBe(b.nonce);
    });

    it('timestamp reflects current time', () => {
      const before = Date.now();
      const { timestamp } = createNonce();
      const after = Date.now();
      const ts = parseInt(timestamp);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('verifyProof', () => {
    it('returns false for missing proof', () => {
      expect(verifyProof(undefined, '1234567890123')).toBe(false);
    });

    it('returns false for missing timestamp', () => {
      expect(verifyProof('a'.repeat(64), undefined)).toBe(false);
    });

    it('returns false for expired timestamp', () => {
      const oldTimestamp = String(Date.now() - 61000);
      expect(verifyProof('a'.repeat(64), oldTimestamp)).toBe(false);
    });

    it('returns false for wrong proof', () => {
      const { timestamp } = createNonce();
      const wrongProof = 'b'.repeat(64);
      expect(verifyProof(wrongProof, timestamp)).toBe(false);
    });

    it('returns true for correct proof', () => {
      const { nonce, timestamp } = createNonce();
      const expected = crypto.createHash('sha256')
        .update('test-password-verifier' + nonce + timestamp)
        .digest('hex');
      expect(verifyProof(expected, timestamp)).toBe(true);
    });

    it('returns false when nonce is reused', () => {
      const { nonce, timestamp } = createNonce();
      const proof = crypto.createHash('sha256')
        .update('test-password-verifier' + nonce + timestamp)
        .digest('hex');
      expect(verifyProof(proof, timestamp)).toBe(true);
      expect(verifyProof(proof, timestamp)).toBe(false);
    });
  });

  describe('createToken', () => {
    it('returns payload.signature format', () => {
      const token = createToken();
      const parts = token.split('.');
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('payload contains iat, exp, jti', () => {
      const token = createToken();
      const [payload] = token.split('.');
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      expect(data).toHaveProperty('iat');
      expect(data).toHaveProperty('exp');
      expect(data).toHaveProperty('jti');
    });

    it('exp is in the future', () => {
      const token = createToken();
      const [payload] = token.split('.');
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      expect(data.exp).toBeGreaterThan(Date.now());
    });

    it('generates unique tokens', () => {
      const a = createToken();
      const b = createToken();
      expect(a).not.toBe(b);
    });
  });

  describe('verifyToken', () => {
    it('returns false for undefined', () => {
      expect(verifyToken(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(verifyToken('')).toBe(false);
    });

    it('returns false for tampered token', () => {
      const token = createToken();
      const tampered = token.slice(0, -1) + 'x';
      expect(verifyToken(tampered)).toBe(false);
    });

    it('returns false for expired token', () => {
      const token = createToken();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      expect(verifyToken(token)).toBe(false);
    });

    it('returns true for valid, non-expired token', () => {
      const token = createToken();
      expect(verifyToken(token)).toBe(true);
    });

    it('returns false for token without dot separator', () => {
      expect(verifyToken('nodot')).toBe(false);
    });
  });
});
