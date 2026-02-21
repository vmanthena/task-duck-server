// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { $, esc, formatTime, scoreColor, scoreClass } from '../../../client/src/utils.js';

describe('client/utils', () => {
  describe('formatTime', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('formats 61 seconds as 01:01', () => {
      expect(formatTime(61)).toBe('01:01');
    });

    it('formats 3600 seconds as 60:00', () => {
      expect(formatTime(3600)).toBe('60:00');
    });

    it('formats 59 seconds as 00:59', () => {
      expect(formatTime(59)).toBe('00:59');
    });

    it('formats 600 seconds as 10:00', () => {
      expect(formatTime(600)).toBe('10:00');
    });

    it('pads single-digit minutes and seconds', () => {
      expect(formatTime(65)).toBe('01:05');
    });
  });

  describe('scoreColor', () => {
    it('returns green for score >= 80', () => {
      expect(scoreColor(80)).toBe('var(--green)');
      expect(scoreColor(100)).toBe('var(--green)');
    });

    it('returns orange for score >= 50 and < 80', () => {
      expect(scoreColor(50)).toBe('var(--orange)');
      expect(scoreColor(79)).toBe('var(--orange)');
    });

    it('returns red for score < 50', () => {
      expect(scoreColor(49)).toBe('var(--red)');
      expect(scoreColor(0)).toBe('var(--red)');
    });
  });

  describe('scoreClass', () => {
    it('returns score--excellent for score >= 80', () => {
      expect(scoreClass(80)).toBe('score--excellent');
      expect(scoreClass(100)).toBe('score--excellent');
    });

    it('returns score--ok for score >= 50 and < 80', () => {
      expect(scoreClass(50)).toBe('score--ok');
      expect(scoreClass(79)).toBe('score--ok');
    });

    it('returns score--poor for score < 50', () => {
      expect(scoreClass(49)).toBe('score--poor');
      expect(scoreClass(0)).toBe('score--poor');
    });
  });

  describe('esc', () => {
    it('escapes HTML special characters', () => {
      expect(esc('<script>alert("xss")</script>')).toContain('&lt;');
      expect(esc('<script>alert("xss")</script>')).toContain('&gt;');
    });

    it('escapes ampersands', () => {
      expect(esc('a & b')).toContain('&amp;');
    });

    it('passes through safe strings unchanged', () => {
      expect(esc('hello world')).toBe('hello world');
    });
  });

  describe('$', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="testEl">Hello</div>';
    });

    it('returns element by id', () => {
      const el = $('testEl');
      expect(el).toBeDefined();
      expect(el.textContent).toBe('Hello');
    });
  });
});
