import type { Request, Response, NextFunction } from 'express';

export function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    method: 'GET',
    path: '/',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

export function mockResponse(): Response & { _status: number; _json: unknown; _headers: Record<string, string> } {
  const res = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
    setHeader(name: string, value: string) {
      res._headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return res._headers[name.toLowerCase()];
    },
  };
  return res as unknown as Response & { _status: number; _json: unknown; _headers: Record<string, string> };
}

export function mockNext(): NextFunction & { called: boolean } {
  const fn = (() => {
    fn.called = true;
  }) as NextFunction & { called: boolean };
  fn.called = false;
  return fn;
}
