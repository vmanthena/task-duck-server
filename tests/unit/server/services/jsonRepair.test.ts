import { describe, it, expect } from 'vitest';
import { repairJSON } from '../../../../server/src/services/jsonRepair.js';

describe('jsonRepair', () => {
  describe('Strategy 1: direct parse', () => {
    it('parses valid JSON', () => {
      const result = repairJSON('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('handles whitespace around valid JSON', () => {
      const result = repairJSON('  \n {"a": 1} \n  ');
      expect(result).toEqual({ a: 1 });
    });

    it('parses nested valid JSON', () => {
      const result = repairJSON('{"a":{"b":[1,2,3]}}');
      expect(result).toEqual({ a: { b: [1, 2, 3] } });
    });
  });

  describe('Strategy 2: strip markdown fences', () => {
    it('strips ```json fences', () => {
      const result = repairJSON('```json\n{"verdict": "match"}\n```');
      expect(result).toEqual({ verdict: 'match' });
    });

    it('strips ``` fences without language', () => {
      const result = repairJSON('```\n{"x": 1}\n```');
      expect(result).toEqual({ x: 1 });
    });

    it('extracts JSON from preamble text', () => {
      const result = repairJSON('Here is the result:\n{"key": "val"}');
      expect(result).toEqual({ key: 'val' });
    });

    it('handles text before and after JSON', () => {
      const result = repairJSON('Some text\n{"a": "b"}\nMore text');
      expect(result).toEqual({ a: 'b' });
    });
  });

  describe('Strategy 3: truncated JSON recovery', () => {
    it('closes unclosed braces', () => {
      const result = repairJSON('{"verdict":"match","confidence":0.9');
      expect(result).toEqual({ verdict: 'match', confidence: 0.9 });
    });

    it('closes unclosed brackets', () => {
      const result = repairJSON('{"items":["a","b"');
      expect(result).toEqual({ items: ['a', 'b'] });
    });

    it('removes trailing incomplete string value', () => {
      const result = repairJSON('{"verdict":"match","summary":"Partial text');
      expect(result).not.toBeNull();
      expect(result!.verdict).toBe('match');
    });

    it('removes trailing incomplete key', () => {
      const result = repairJSON('{"verdict":"match","summ');
      expect(result).not.toBeNull();
      expect(result!.verdict).toBe('match');
    });

    it('removes trailing comma', () => {
      const result = repairJSON('{"verdict":"match",');
      expect(result).toEqual({ verdict: 'match' });
    });

    it('handles nested truncated structures', () => {
      const result = repairJSON('{"a":{"b":["x","y');
      expect(result).not.toBeNull();
    });
  });

  describe('Strategy 4: returns null for unfixable', () => {
    it('returns null for text with no braces', () => {
      expect(repairJSON('This is just plain text')).toBeNull();
    });

    it('returns null for deeply broken input', () => {
      expect(repairJSON('no json here at all!!!')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(repairJSON('')).toBeNull();
    });
  });
});
