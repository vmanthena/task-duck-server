import { describe, it, expect } from 'vitest';
import { securityHeaders } from '../../../../server/src/middleware/security.js';
import { mockRequest, mockResponse, mockNext } from '../../../fixtures/requests.js';

describe('middleware/security', () => {
  it('sets X-Content-Type-Options', () => {
    const res = mockResponse();
    securityHeaders(mockRequest(), res, mockNext());
    expect(res._headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options', () => {
    const res = mockResponse();
    securityHeaders(mockRequest(), res, mockNext());
    expect(res._headers['x-frame-options']).toBe('DENY');
  });

  it('sets X-XSS-Protection', () => {
    const res = mockResponse();
    securityHeaders(mockRequest(), res, mockNext());
    expect(res._headers['x-xss-protection']).toBe('1; mode=block');
  });

  it('sets Referrer-Policy', () => {
    const res = mockResponse();
    securityHeaders(mockRequest(), res, mockNext());
    expect(res._headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy', () => {
    const res = mockResponse();
    securityHeaders(mockRequest(), res, mockNext());
    expect(res._headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('sets Content-Security-Policy', () => {
    const res = mockResponse();
    securityHeaders(mockRequest(), res, mockNext());
    const csp = res._headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('sets Strict-Transport-Security', () => {
    const res = mockResponse();
    securityHeaders(mockRequest(), res, mockNext());
    expect(res._headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('calls next()', () => {
    const next = mockNext();
    securityHeaders(mockRequest(), mockResponse(), next);
    expect(next.called).toBe(true);
  });
});
