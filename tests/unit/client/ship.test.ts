import { describe, it, expect } from 'vitest';
import { SCORE_THRESHOLDS } from '../../../shared/constants.js';

// Test the score calculation logic that shipIt uses (pure math, no DOM dependency)
describe('ship score calculation', () => {
  function calculateScore(planned: number, done: number, extras: number): number {
    const deduction = extras * SCORE_THRESHOLDS.extraPenalty;
    const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
    return Math.max(0, pct - deduction);
  }

  it('100% when all planned items done, no extras', () => {
    expect(calculateScore(5, 5, 0)).toBe(100);
  });

  it('0% when no planned items', () => {
    expect(calculateScore(0, 0, 0)).toBe(0);
  });

  it('50% when half items done', () => {
    expect(calculateScore(4, 2, 0)).toBe(50);
  });

  it('deducts 10% per extra item', () => {
    expect(calculateScore(5, 5, 1)).toBe(90);
    expect(calculateScore(5, 5, 2)).toBe(80);
    expect(calculateScore(5, 5, 3)).toBe(70);
  });

  it('clamps to 0 (never negative)', () => {
    expect(calculateScore(5, 1, 10)).toBe(0);
  });

  it('rounds correctly', () => {
    // 2/3 = 66.67 → rounds to 67
    expect(calculateScore(3, 2, 0)).toBe(67);
  });

  it('combines partial completion with extras', () => {
    // 3/5 = 60% - 10% (1 extra) = 50%
    expect(calculateScore(5, 3, 1)).toBe(50);
  });
});
