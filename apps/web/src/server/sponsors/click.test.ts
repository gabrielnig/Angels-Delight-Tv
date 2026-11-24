import { createMemoryRateLimiter, type SponsorTrack } from '@ad/analytics';
import { describe, expect, it, vi } from 'vitest';
import { createSponsorClickHandler, type SponsorClickDeps } from './click';

const ID = '0198c000-0000-7000-8000-000000000001';
const UA = 'Mozilla/5.0 (Linux; Android 13; Tecno) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const secret = new Uint8Array(32).fill(3);

function setup(over: Partial<SponsorClickDeps> = {}) {
  const tracks: SponsorTrack[] = [];
  const lookups: string[] = [];
  const deps: SponsorClickDeps = {
    lookup: async (id) => {
      lookups.push(id);
      return id === ID ? { destinationUrl: 'https://sponsor.example/landing?utm=x', slots: ['home_banner', 'title_card'] } : null;
    },
    track: async (entry) => {
      tracks.push(entry);
      return true;
    },
    limiter: createMemoryRateLimiter(),
    secret,
    trustedProxyMode: 'none',
    resolveViewer: async () => ({ profileId: null, audience: 'general', subjectId: 'g1' }),
    isAdminPreview: async () => false,
    warn: vi.fn(),
    ...over,
  };
  const handle = createSponsorClickHandler(deps);
  const get = (id = ID, query = '', ua: string | null = UA) =>
    handle(new Request(`https://site.example/s/${id}${query}`, { headers: ua ? { 'user-agent': ua } : {} }), id);
  return { get, tracks, lookups, deps };
}

describe('sponsor click redirect', () => {
  it('redirects 302 to the stored destination and counts a click', async () => {
    const { get, tracks } = setup();
    const res = await get();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://sponsor.example/landing?utm=x');
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({ creativeId: ID, kind: 'clk', slot: 'home_banner', viewerHash: null });
  });

  it('ignores a url in the query string', async () => {
    const { get } = setup();
    const res = await get(ID, '?url=https://evil.example&to=https://evil.example&next=//evil.example');
    expect(res.headers.get('location')).toBe('https://sponsor.example/landing?utm=x');
  });

  it('uses a valid placement hint for the slot and ignores an invalid one', async () => {
    const a = setup();
    await a.get(ID, '?p=title_card');
    expect(a.tracks[0]?.slot).toBe('title_card');
    const b = setup();
    await b.get(ID, '?p=player_before');
    expect(b.tracks[0]?.slot).toBe('home_banner');
    const c = setup();
    await c.get(ID, '?p=nonsense');
    expect(c.tracks[0]?.slot).toBe('home_banner');
  });

  it('404 for unknown creative or a malformed id, with no lookup for a malformed id', async () => {
    const { get, lookups } = setup();
    expect((await get('0198c000-0000-7000-8000-0000000000ff')).status).toBe(404);
    expect((await get('not-a-uuid')).status).toBe(404);
    expect(lookups).not.toContain('not-a-uuid');
  });

  it('404 and no count for kids audience, and no lookup', async () => {
    const { get, tracks, lookups } = setup({ resolveViewer: async () => ({ profileId: 'p', audience: 'kids' }) });
    expect((await get()).status).toBe(404);
    expect(tracks).toHaveLength(0);
    expect(lookups).toHaveLength(0);
  });

  it('fails closed when the audience cannot be determined', async () => {
    const { get, tracks } = setup({ resolveViewer: async () => { throw new Error('auth down'); } });
    expect((await get()).status).toBe(404);
    expect(tracks).toHaveLength(0);
  });

  it('redirects bots without counting', async () => {
    const { get, tracks } = setup();
    const res = await get(ID, '', 'Googlebot/2.1 (+http://www.google.com/bot.html)');
    expect(res.status).toBe(302);
    expect(tracks).toHaveLength(0);
  });

  it('redirects an admin preview without counting', async () => {
    const { get, tracks } = setup({ isAdminPreview: async () => true });
    expect((await get()).status).toBe(302);
    expect(tracks).toHaveLength(0);
  });

  it('404 when the sponsor is not live (lookup finds nothing)', async () => {
    const { get, tracks } = setup({ lookup: async () => null });
    expect((await get()).status).toBe(404);
    expect(tracks).toHaveLength(0);
  });

  it('sets Referrer-Policy no-referrer and Cache-Control no-store on every answer', async () => {
    const { get } = setup();
    for (const res of [await get(), await get('bad')]) {
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('is rate limited per ip', async () => {
    const { get } = setup();
    let limited = 0;
    for (let i = 0; i < 80; i += 1) if ((await get()).status === 429) limited += 1;
    expect(limited).toBeGreaterThan(0);
  });

  it('a recording failure still redirects and logs a warning', async () => {
    const warn = vi.fn();
    const { get } = setup({ track: async () => { throw new Error('db down'); }, warn });
    const res = await get();
    expect(res.status).toBe(302);
    expect(warn).toHaveBeenCalled();
  });

  it('refuses to redirect to a stored destination that is not https', async () => {
    const { get } = setup({ lookup: async () => ({ destinationUrl: 'http://sponsor.example', slots: ['home_banner'] }) });
    expect((await get()).status).toBe(404);
  });
});

describe('staffPreview', () => {
  it('treats a staff session as a preview and anyone else as a real click', async () => {
    const { staffPreview } = await import('./preview');
    expect(await staffPreview(async () => 'editor')).toBe(true);
    expect(await staffPreview(async () => 'admin')).toBe(true);
    expect(await staffPreview(async () => 'viewer')).toBe(false);
    expect(await staffPreview(async () => null)).toBe(false);
  });
  it('counts the click when the session cannot be read (a real viewer)', async () => {
    const { staffPreview } = await import('./preview');
    expect(await staffPreview(async () => { throw new Error('x'); })).toBe(false);
  });
});
