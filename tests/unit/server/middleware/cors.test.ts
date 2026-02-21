import { describe, it, expect } from 'vitest';
import { corsMiddleware } from '../../../../server/src/middleware/cors.js';
import { mockRequest, mockResponse, mockNext } from '../../../fixtures/requests.js';

describe('middleware/cors', () => {
  it('passes through when no origin header', () => {
    const next = mockNext();
    corsMiddleware(mockRequest({ path: '/api/test', headers: {} }), mockResponse(), next);
    expect(next.called).toBe(true);
  });

  it('passes through for non-API paths', () => {
    const next = mockNext();
    corsMiddleware(
      mockRequest({ path: '/index.html', headers: { origin: 'http://evil.com', host: 'example.com' } }),
      mockResponse(),
      next,
    );
    expect(next.called).toBe(true);
  });

  it('allows same-origin API requests', () => {
    const next = mockNext();
    corsMiddleware(
      mockRequest({ path: '/api/health', headers: { origin: 'http://localhost:8080', host: 'localhost:8080' } }),
      mockResponse(),
      next,
    );
    expect(next.called).toBe(true);
  });

  it('blocks cross-origin API requests with 403', () => {
    const res = mockResponse();
    const next = mockNext();
    corsMiddleware(
      mockRequest({ path: '/api/health', headers: { origin: 'http://evil.com', host: 'localhost:8080' } }),
      res,
      next,
    );
    expect(res._status).toBe(403);
    expect((res._json as Record<string, unknown>).error).toContain('Cross-origin');
    expect(next.called).toBe(false);
  });

  it('lets through requests with unparseable origin (bad URL)', () => {
    const next = mockNext();
    corsMiddleware(
      mockRequest({ path: '/api/health', headers: { origin: 'not-a-url', host: 'localhost:8080' } }),
      mockResponse(),
      next,
    );
    expect(next.called).toBe(true);
  });

  it('passes through non-API path even with cross-origin', () => {
    const next = mockNext();
    corsMiddleware(
      mockRequest({ path: '/styles.css', headers: { origin: 'http://other.com', host: 'localhost:8080' } }),
      mockResponse(),
      next,
    );
    expect(next.called).toBe(true);
  });
});
