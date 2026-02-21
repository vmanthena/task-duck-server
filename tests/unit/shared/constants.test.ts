import { describe, it, expect } from 'vitest';
import { VERSION, API_PATHS, AUTH, LIMITS, SCORE_THRESHOLDS, BCRYPT, RETRY, TIMERS, STORAGE_KEYS } from '../../../shared/constants.js';

describe('shared/constants', () => {
  it('VERSION is a semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('API_PATHS all start with /api/', () => {
    for (const path of Object.values(API_PATHS)) {
      expect(path).toMatch(/^\/api\//);
    }
  });

  it('AUTH has expected lockout values', () => {
    expect(AUTH.maxAttempts).toBe(3);
    expect(AUTH.lockoutMs).toBe(20 * 60 * 1000);
    expect(AUTH.nonceTtlMs).toBe(60_000);
  });

  it('LIMITS has expected size values', () => {
    expect(LIMITS.bodyMaxKb).toBe(50);
    expect(LIMITS.stringMaxLen).toBe(10_000);
    expect(LIMITS.llmMaxTokens).toBe(16_384);
  });

  it('SCORE_THRESHOLDS has expected boundaries', () => {
    expect(SCORE_THRESHOLDS.excellent).toBe(80);
    expect(SCORE_THRESHOLDS.acceptable).toBe(50);
    expect(SCORE_THRESHOLDS.extraPenalty).toBe(10);
  });

  it('BCRYPT cost range is valid', () => {
    expect(BCRYPT.minCost).toBeGreaterThanOrEqual(10);
    expect(BCRYPT.maxCost).toBeGreaterThanOrEqual(BCRYPT.minCost);
  });

  it('STORAGE_KEYS all start with "td"', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key).toMatch(/^td/);
    }
  });
});
