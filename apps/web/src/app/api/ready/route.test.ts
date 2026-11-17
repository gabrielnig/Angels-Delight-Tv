import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/runtime/services', () => ({
  getServices: () => {
    throw new Error('DATABASE_URL missing');
  },
}));

const { GET } = await import('./route');

describe('GET /api/ready', () => {
  it('answers 503 with no detail when the app cannot be configured', async () => {
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: false, checks: {} });
  });
});
