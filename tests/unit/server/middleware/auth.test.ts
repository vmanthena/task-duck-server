import { describe, it, expect, vi } from 'vitest';
import { mockRequest, mockResponse, mockNext } from '../../../fixtures/requests.js';

// Mock the authService before importing the middleware
vi.mock('../../../../server/src/services/authService.js', () => ({
  verifyToken: vi.fn(),
}));

import { requireAuth } from '../../../../server/src/middleware/auth.js';
import { verifyToken } from '../../../../server/src/services/authService.js';

const mockVerifyToken = vi.mocked(verifyToken);

describe('middleware/auth', () => {
  it('returns 401 when no Authorization header', () => {
    mockVerifyToken.mockReturnValue(false);
    const res = mockResponse();
    requireAuth(mockRequest({ headers: {} }), res, mockNext());
    expect(res._status).toBe(401);
    expect((res._json as Record<string, unknown>).error).toBe('Unauthorized');
  });

  it('returns 401 for invalid token', () => {
    mockVerifyToken.mockReturnValue(false);
    const res = mockResponse();
    requireAuth(
      mockRequest({ headers: { authorization: 'Bearer invalid-token' } }),
      res,
      mockNext(),
    );
    expect(res._status).toBe(401);
  });

  it('returns 401 for expired token', () => {
    mockVerifyToken.mockReturnValue(false);
    const res = mockResponse();
    requireAuth(
      mockRequest({ headers: { authorization: 'Bearer expired.token' } }),
      res,
      mockNext(),
    );
    expect(res._status).toBe(401);
  });

  it('calls next() for valid token', () => {
    mockVerifyToken.mockReturnValue(true);
    const next = mockNext();
    requireAuth(
      mockRequest({ headers: { authorization: 'Bearer valid.token' } }),
      mockResponse(),
      next,
    );
    expect(next.called).toBe(true);
  });

  it('strips "Bearer " prefix before verifying', () => {
    mockVerifyToken.mockReturnValue(true);
    requireAuth(
      mockRequest({ headers: { authorization: 'Bearer my-token-here' } }),
      mockResponse(),
      mockNext(),
    );
    expect(mockVerifyToken).toHaveBeenCalledWith('my-token-here');
  });
});
