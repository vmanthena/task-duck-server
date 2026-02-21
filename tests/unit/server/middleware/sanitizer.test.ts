import { describe, it, expect } from 'vitest';
import { sanitizerMiddleware } from '../../../../server/src/middleware/sanitizer.js';
import { mockRequest, mockResponse, mockNext } from '../../../fixtures/requests.js';
import { LIMITS } from '../../../../shared/constants.js';

describe('middleware/sanitizer', () => {
  it('passes through GET requests without modifying body', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'GET', body: { name: '<script>alert(1)</script>' } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(next.called).toBe(true);
    // GET body not sanitized
    expect(req.body.name).toContain('<script>');
  });

  it('strips < and > from POST body strings', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: { name: '<b>bold</b>' } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.name).toBe('bbold/b');
  });

  it('strips javascript: from POST body strings', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: { url: 'javascript:alert(1)' } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.url).not.toContain('javascript:');
  });

  it('strips on*= event handlers from POST body strings', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: { html: 'img onerror =bad' } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.html).not.toMatch(/onerror\s*=/i);
  });

  it('strips data: URIs from POST body strings', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: { src: 'data:text/html,<h1>hi</h1>' } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.src).not.toContain('data:');
  });

  it('truncates strings to LIMITS.stringMaxLen', () => {
    const next = mockNext();
    const longStr = 'a'.repeat(LIMITS.stringMaxLen + 500);
    const req = mockRequest({ method: 'POST', body: { text: longStr } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.text.length).toBeLessThanOrEqual(LIMITS.stringMaxLen);
  });

  it('preserves numbers in POST body', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: { count: 42 } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.count).toBe(42);
  });

  it('preserves booleans in POST body', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: { active: true } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.active).toBe(true);
  });

  it('drops non-string/number/boolean values', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: { nested: { a: 1 }, arr: [1, 2] } });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(req.body.nested).toBeUndefined();
    expect(req.body.arr).toBeUndefined();
  });

  it('calls next()', () => {
    const next = mockNext();
    sanitizerMiddleware(mockRequest({ method: 'POST', body: { x: 'y' } }), mockResponse(), next);
    expect(next.called).toBe(true);
  });

  it('handles null body gracefully', () => {
    const next = mockNext();
    const req = mockRequest({ method: 'POST', body: null });
    sanitizerMiddleware(req, mockResponse(), next);
    expect(next.called).toBe(true);
  });
});
