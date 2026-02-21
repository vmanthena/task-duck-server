import { vi } from 'vitest';

export function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  });
}

export function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  const fn = vi.fn();
  responses.forEach((r, i) => {
    const status = r.status ?? 200;
    fn.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
      json: async () => (typeof r.body === 'string' ? JSON.parse(r.body) : r.body),
    });
  });
  return fn;
}
