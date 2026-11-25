import { describe, expect, it, vi } from 'vitest';
import { createOgHandler, type OgDeps } from './og-handler';

const preview = (item: unknown) => async () => item as never;
const DEFAULT = Buffer.from('defaultcard');

function deps(over: Partial<OgDeps> = {}): OgDeps {
  return {
    preview: preview(video),
    siteName: async () => 'ADTV',
    freeLine: () => 'Free to watch',
    options: async () => ({ overlay: true, badge: true, accent: '#123456' }),
    defaultCard: async () => DEFAULT,
    fetchPoster: vi.fn(async () => Buffer.from('poster')),
    render: vi.fn(async () => Buffer.from('jpegbytes')),
    ...over,
  };
}
const video = {
  type: 'video',
  item: { title: 'Rivers', slug: 'rivers', thumbnail: { src: 'https://m.test/p.jpg' } },
};
const call = (h: ReturnType<typeof createOgHandler>, url = 'https://e.test/og/title/rivers?v=abc') =>
  h(new Request(url), 'video', 'rivers');

describe('share image route (M45-S03, L15b)', () => {
  it('serves the generated jpeg, immutable for a versioned url', async () => {
    const res = await call(createOgHandler(deps()));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('content-length')).toBe(String('jpegbytes'.length));
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('jpegbytes');
  });

  it('uses a day of caching when the url has no version', async () => {
    const res = await call(createOgHandler(deps()), 'https://e.test/og/title/rivers');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400, stale-while-revalidate=604800');
  });

  it('renders once per version and serves the stored copy after that', async () => {
    const d = deps();
    const h = createOgHandler(d);
    await call(h);
    await call(h);
    expect(d.render).toHaveBeenCalledTimes(1);
    await call(h, 'https://e.test/og/title/rivers?v=def');
    expect(d.render).toHaveBeenCalledTimes(2);
  });

  it('passes the overlay, badge and accent settings and the kind to the renderer', async () => {
    const d = deps({ options: async () => ({ overlay: false, badge: false, accent: '#abcdef' }) });
    await call(createOgHandler(d));
    expect(d.render).toHaveBeenCalledWith(
      expect.objectContaining({ overlay: false, badge: false, accent: '#abcdef', kind: 'video' }),
    );
  });

  it('returns 404 for an unpublished, trashed, unknown or above ceiling title (no preview)', async () => {
    const res = await call(createOgHandler(deps({ preview: preview(null) })));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).not.toBe('image/jpeg');
  });

  it('returns 404 for a redirect or a title of the other kind', async () => {
    const redirect = createOgHandler(deps({ preview: preview({ type: 'redirect', to: '/title/x' }) }));
    expect((await call(redirect)).status).toBe(404);
    const wrong = createOgHandler(deps({ preview: preview({ type: 'series', item: {} }) }));
    expect((await call(wrong)).status).toBe(404);
  });

  it('answers the generic platform card, never the title or poster, for a kids only title (R26)', async () => {
    const d = deps({ indexable: async () => false });
    const res = await call(createOgHandler(d));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(DEFAULT);
    expect(d.render).not.toHaveBeenCalled();
    expect(d.fetchPoster).not.toHaveBeenCalled();
  });

  it('treats a failed kids only lookup as kids only', async () => {
    const d = deps({
      indexable: async () => {
        throw new Error('db down');
      },
    });
    const res = await call(createOgHandler(d));
    expect(Buffer.from(await res.arrayBuffer())).toEqual(DEFAULT);
    expect(d.render).not.toHaveBeenCalled();
  });

  it('answers the default card with 200 bytes and a short cache when generation fails (no redirect)', async () => {
    const res = await call(
      createOgHandler(
        deps({
          render: async () => {
            throw new Error('satori failed');
          },
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(DEFAULT);
  });

  it('answers the default card when there is no poster and does not render', async () => {
    const d = deps({ preview: preview({ type: 'video', item: { title: 'No poster', slug: 'np' } }) });
    const res = await call(createOgHandler(d));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(DEFAULT);
    expect(d.render).not.toHaveBeenCalled();
  });

  it('draws without the poster when it cannot be fetched, rather than failing', async () => {
    const d = deps({ fetchPoster: async () => null });
    const res = await call(createOgHandler(d));
    expect(res.status).toBe(200);
    expect(d.render).toHaveBeenCalledWith(expect.objectContaining({ poster: null, title: 'Rivers' }));
    // A card drawn without its poster is not stored as the final one.
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });

  it('404 when even the default card cannot be made', async () => {
    const res = await call(
      createOgHandler(
        deps({
          indexable: async () => false,
          defaultCard: async () => {
            throw new Error('no default');
          },
        }),
      ),
    );
    expect(res.status).toBe(404);
  });
});
