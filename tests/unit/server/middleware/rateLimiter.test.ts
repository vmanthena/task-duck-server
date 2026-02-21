import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getClientIP, isIPLocked, recordFail, clearFails, getLockSeconds } from '../../../../server/src/middleware/rateLimiter.js';
import { mockRequest } from '../../../fixtures/requests.js';

describe('middleware/rateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure clean state
    clearFails('127.0.0.1');
    clearFails('10.0.0.1');
    clearFails('unknown');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getClientIP', () => {
    it('extracts IP from x-forwarded-for', () => {
      const req = mockRequest({ headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.1' } });
      expect(getClientIP(req)).toBe('10.0.0.1');
    });

    it('extracts IP from x-real-ip', () => {
      const req = mockRequest({ headers: { 'x-real-ip': '10.0.0.2' } });
      expect(getClientIP(req)).toBe('10.0.0.2');
    });

    it('falls back to socket.remoteAddress', () => {
      const req = mockRequest({ headers: {}, socket: { remoteAddress: '10.0.0.3' } });
      expect(getClientIP(req)).toBe('10.0.0.3');
    });

    it('returns "unknown" as last resort', () => {
      const req = mockRequest({ headers: {}, socket: {} });
      expect(getClientIP(req)).toBe('unknown');
    });
  });

  describe('isIPLocked', () => {
    it('returns false for unknown IP', () => {
      expect(isIPLocked('192.168.0.1')).toBe(false);
    });

    it('returns false for IP with no lockout', () => {
      recordFail('10.0.0.1'); // 1 fail, not locked
      expect(isIPLocked('10.0.0.1')).toBe(false);
    });

    it('returns true for locked IP', () => {
      recordFail('10.0.0.1');
      recordFail('10.0.0.1');
      recordFail('10.0.0.1'); // 3 fails → locked
      expect(isIPLocked('10.0.0.1')).toBe(true);
    });

    it('returns false after lockout expires', () => {
      recordFail('10.0.0.1');
      recordFail('10.0.0.1');
      recordFail('10.0.0.1');
      expect(isIPLocked('10.0.0.1')).toBe(true);
      vi.advanceTimersByTime(20 * 60 * 1000 + 1); // 20 min + 1ms
      expect(isIPLocked('10.0.0.1')).toBe(false);
    });
  });

  describe('recordFail', () => {
    it('increments count', () => {
      const r1 = recordFail('127.0.0.1');
      expect(r1.count).toBe(1);
      const r2 = recordFail('127.0.0.1');
      expect(r2.count).toBe(2);
    });

    it('locks at 3 failures', () => {
      recordFail('127.0.0.1');
      recordFail('127.0.0.1');
      const r = recordFail('127.0.0.1');
      expect(r.count).toBe(3);
      expect(r.lockedUntil).not.toBeNull();
    });

    it('does not lock before 3 failures', () => {
      recordFail('127.0.0.1');
      const r = recordFail('127.0.0.1');
      expect(r.lockedUntil).toBeNull();
    });
  });

  describe('clearFails', () => {
    it('removes all records for IP', () => {
      recordFail('127.0.0.1');
      recordFail('127.0.0.1');
      clearFails('127.0.0.1');
      expect(isIPLocked('127.0.0.1')).toBe(false);
      // Fresh start
      const r = recordFail('127.0.0.1');
      expect(r.count).toBe(1);
    });
  });

  describe('getLockSeconds', () => {
    it('returns 0 for unlocked IP', () => {
      expect(getLockSeconds('127.0.0.1')).toBe(0);
    });

    it('returns remaining lock seconds', () => {
      recordFail('127.0.0.1');
      recordFail('127.0.0.1');
      recordFail('127.0.0.1');
      const secs = getLockSeconds('127.0.0.1');
      expect(secs).toBeGreaterThan(0);
      expect(secs).toBeLessThanOrEqual(20 * 60);
    });

    it('returns 0 after lockout expires', () => {
      recordFail('127.0.0.1');
      recordFail('127.0.0.1');
      recordFail('127.0.0.1');
      vi.advanceTimersByTime(20 * 60 * 1000 + 1);
      expect(getLockSeconds('127.0.0.1')).toBe(0);
    });
  });
});
