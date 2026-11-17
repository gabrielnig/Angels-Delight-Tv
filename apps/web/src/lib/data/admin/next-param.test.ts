import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: () => undefined }));

const { safeNext } = await import('./session-next');

describe('safeNext', () => {
  it('keeps admin paths', () => {
    expect(safeNext('/admin/videos?status=failed')).toBe('/admin/videos?status=failed');
    expect(safeNext('/admin')).toBe('/admin');
  });
  it('drops anything that could leave the site', () => {
    for (const bad of ['//evil.test', 'https://evil.test', '/other', '/admin//evil.test', '/admin/../x', undefined, 5]) {
      expect(safeNext(bad)).toBe('/admin');
    }
  });
});
