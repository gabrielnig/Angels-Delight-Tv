import { describe, expect, it, vi } from 'vitest';
import { createOgHandler } from './og-handler';

const preview = (item: unknown) => async () => item as never;
const base = {
  siteName: async () => 'ADTV',
  freeLine: () => 'Free to watch',
  defaultImageUrl: async () => 'https://e.test/default.png',
  fetchPoster: async () => Buffer.from('poster'),
  render: vi.fn(async () => Buffer.from('jpegbytes')),
};
const video = {
  type: 'video',
  item: { title: 'Rivers', slug: 'rivers', thumbnail: { src: 'https://m.test/p.jpg' } },
};

describe('share image route (M45-S03)', () => {
  it('serves the generated jpeg with a day of caching', async () => {
    const h = createOgHandler({ ...base, preview: preview(video) });
    const res = await h(new Request('https://e.test/og/title/rivers'), 'video', 'rivers');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=86400, stale-while-revalidate=604800',
    );
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('jpegbytes');
  });

  it('returns 404 for an unpublished or unknown title so drafts never leak', async () => {
    const h = createOgHandler({ ...base, preview: preview(null) });
    expect((await h(new Request('https://e.test/x'), 'video', 'nope')).status).toBe(404);
  });

  it('returns 404 for a redirect or a title of the other kind', async () => {
    const redirect = createOgHandler({
      ...base,
      preview: preview({ type: 'redirect', to: '/title/x' }),
    });
    expect((await redirect(new Request('https://e.test/x'), 'video', 'old')).status).toBe(404);
    const wrong = createOgHandler({ ...base, preview: preview({ type: 'series', item: {} }) });
    expect((await wrong(new Request('https://e.test/x'), 'video', 's')).status).toBe(404);
  });

  it('falls back to the site default image when generation fails', async () => {
    const h = createOgHandler({
      ...base,
      preview: preview(video),
      render: async () => {
        throw new Error('satori failed');
      },
    });
    const res = await h(new Request('https://e.test/og/title/rivers'), 'video', 'rivers');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://e.test/default.png');
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });

  it('redirects to the default without a poster and does not try to render', async () => {
    const render = vi.fn(async () => Buffer.from('x'));
    const h = createOgHandler({
      ...base,
      render,
      preview: preview({ type: 'video', item: { title: 'No poster', slug: 'np' } }),
    });
    const res = await h(new Request('https://e.test/og/title/np'), 'video', 'np');
    expect(res.status).toBe(302);
    expect(render).not.toHaveBeenCalled();
  });

  it('draws without the poster when it cannot be fetched, rather than failing', async () => {
    const render = vi.fn(async () => Buffer.from('jpeg'));
    const h = createOgHandler({
      ...base,
      render,
      fetchPoster: async () => null,
      preview: preview(video),
    });
    const res = await h(new Request('https://e.test/x'), 'video', 'rivers');
    expect(res.status).toBe(200);
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ poster: null, title: 'Rivers' }));
  });
});
