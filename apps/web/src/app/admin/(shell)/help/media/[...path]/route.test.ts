import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActor = vi.fn();
vi.mock('@/lib/data/admin/session-next', () => ({ getActor: () => getActor() }));
vi.mock('server-only', () => ({}));

const { GET } = await import('./route');
const call = (path: string[]) =>
  GET(new Request('http://x/admin/help/media/' + path.join('/')), {
    params: Promise.resolve({ path }),
  });

beforeEach(() => getActor.mockReset());

describe('GET /admin/help/media', () => {
  it('refuses anyone who is not signed in staff', async () => {
    getActor.mockResolvedValue(null);
    const res = await call(['img', 'S04', 'S04-01-menu-desktop.webp']);
    expect(res.status).toBe(401);
  });

  it('serves a picture to staff with private caching and no sniffing', async () => {
    getActor.mockResolvedValue({ role: 'editor' });
    const res = await call(['img', 'S04', 'S04-01-menu-desktop.webp']);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toMatch(/private/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it('answers 404 for traversal, other folders and missing files', async () => {
    getActor.mockResolvedValue({ role: 'editor' });
    expect((await call(['img', '..', 'en', 'glossary.md'])).status).toBe(404);
    expect((await call(['img', 'S04', 'nothing.webp'])).status).toBe(404);
    expect((await call(['other', 'x'])).status).toBe(404);
  });
});
