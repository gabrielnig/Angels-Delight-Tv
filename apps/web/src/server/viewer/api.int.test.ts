import {
  createHarness,
  integrationEnabled,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { uuidv7, type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerApi, type ViewerRuntime } from './api';

const ORIGIN = 'https://app.test';

describe.skipIf(!integrationEnabled())('viewer api', () => {
  let h: ViewerHarness;
  let api: ReturnType<typeof createViewerApi>;
  let me: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let other: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let video: Awaited<ReturnType<typeof seedVideo>>;
  let signedIn: Actor | null;
  let limited = false;

  const req = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.method && init.method !== 'GET' && !headers.has('origin'))
      headers.set('origin', ORIGIN);
    if (init.cookie) headers.set('cookie', init.cookie);
    return new Request(`${ORIGIN}${path}`, { ...init, headers });
  };
  const post = (path: string, body: unknown, extra: RequestInit & { cookie?: string } = {}) =>
    req(path, { method: 'POST', body: JSON.stringify(body), ...extra });

  beforeAll(async () => {
    h = await createHarness({
      rateLimit: async () => ({ allowed: !limited, retryAfterSeconds: 42 }),
    });
    me = await h.makeUser();
    other = await h.makeUser();
    video = await seedVideo(h.db.setup, { kidsSafe: true, title: 'Rivers of Africa' });
    const runtime: ViewerRuntime = {
      ctx: h.ctx,
      appOrigin: ORIGIN,
      secureCookies: false,
      profileSecret: new Uint8Array(32).fill(9),
      resolveActor: async () => signedIn,
      lock: { read: async () => null, set: async () => undefined, clear: async () => undefined },
    };
    api = createViewerApi(runtime);
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('answers 401 with no session on a personal route and sets no-store', async () => {
    signedIn = null;
    // Home, browse and search are public GETs since M40. Progress stays personal.
    const res = await api.progress.get(req(`/api/progress?profileId=${me.profileId}`));
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect((await res.json()).error.code).toBe('unauthorized');
  });

  it('serves home, browse and search for the owner', async () => {
    signedIn = me.actor;
    const q = `profileId=${me.profileId}`;
    expect((await api.home(req(`/api/home?${q}`))).status).toBe(200);
    const browse = await (await api.browse(req(`/api/browse?${q}`))).json();
    expect(browse.items.map((i: { title: string }) => i.title)).toContain('Rivers of Africa');
    const found = await (await api.search(req(`/api/search?${q}&q=rivers`))).json();
    expect(found.total).toBe(1);
  });

  it('revalidates catalog reads with an ETag and answers 304 when nothing changed (M04-S05)', async () => {
    signedIn = me.actor;
    const q = `profileId=${me.profileId}`;
    for (const path of [`/api/home?${q}`, `/api/browse?${q}`, `/api/browse/categories?${q}`]) {
      const handler = path.startsWith('/api/home')
        ? api.home
        : path.includes('categories')
          ? api.categories
          : api.browse;
      const first = await handler(req(path));
      const tag = first.headers.get('etag');
      expect(tag, path).toMatch(/^"/);
      expect(first.headers.get('cache-control')).toBe('private, no-cache');
      const again = await handler(req(path, { headers: { 'if-none-match': tag! } }));
      expect(again.status, path).toBe(304);
    }
  });

  it('hides another account profile as not found on every read', async () => {
    signedIn = me.actor;
    const q = `profileId=${other.profileId}`;
    for (const [fn, path] of [
      [api.home, `/api/home?${q}`],
      [api.browse, `/api/browse?${q}`],
      [api.categories, `/api/browse/categories?${q}`],
      [api.search, `/api/search?${q}&q=rivers`],
      [api.recentSearches.list, `/api/search/recent?${q}`],
      [api.myList.list, `/api/my-list?${q}`],
      [api.progress.get, `/api/progress?${q}`],
    ] as const) {
      expect((await fn(req(path))).status, path).toBe(404);
    }
    const save = await api.progress.save(
      post('/api/progress', { profileId: other.profileId, videoId: video.id, positionMs: 30000 }),
    );
    expect(save.status).toBe(404);
  });

  it('rejects bad input with field errors', async () => {
    signedIn = me.actor;
    const res = await api.browse(req(`/api/browse?profileId=${me.profileId}&sort=oldest`));
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields.sort).toBeDefined();
    const bad = await api.progress.save(post('/api/progress', { profileId: me.profileId }));
    expect(bad.status).toBe(422);
    const notJson = await api.progress.save(
      req('/api/progress', { method: 'POST', body: '{nope' }),
    );
    expect(notJson.status).toBe(422);
  });

  describe('POST /api/progress/import (M40-S17)', () => {
    const item = () => ({
      videoId: video.id,
      positionMs: 30000,
      finished: false,
      updatedAt: Date.now() - 1000,
    });

    it('imports into the signed in profile and reports the counts', async () => {
      signedIn = me.actor;
      const res = await api.progress.import(
        post('/api/progress/import', { profileId: me.profileId, items: [item()] }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.imported + body.skipped).toBe(1);
    });

    it('hides another account profile, refuses cross-origin and bad input', async () => {
      signedIn = me.actor;
      expect(
        (
          await api.progress.import(
            post('/api/progress/import', { profileId: other.profileId, items: [item()] }),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await api.progress.import(
            post(
              '/api/progress/import',
              { profileId: me.profileId, items: [item()] },
              { headers: { origin: 'https://evil.test' } },
            ),
          )
        ).status,
      ).toBe(403);
      expect(
        (await api.progress.import(post('/api/progress/import', { profileId: me.profileId })))
          .status,
      ).toBe(422);
      const tooMany = Array.from({ length: 101 }, item);
      expect(
        (
          await api.progress.import(
            post('/api/progress/import', { profileId: me.profileId, items: tooMany }),
          )
        ).status,
      ).toBe(422);
    });

    it('is 401 without a session', async () => {
      signedIn = null;
      expect(
        (
          await api.progress.import(
            post('/api/progress/import', { profileId: me.profileId, items: [item()] }),
          )
        ).status,
      ).toBe(401);
    });
  });

  it('refuses cross-origin writes', async () => {
    signedIn = me.actor;
    const res = await api.progress.save(
      post(
        '/api/progress',
        { profileId: me.profileId, videoId: video.id, positionMs: 30000 },
        { headers: { origin: 'https://evil.test' } },
      ),
    );
    expect(res.status).toBe(403);
  });

  it('saves progress from a sendBeacon style text body and lists continue watching', async () => {
    signedIn = me.actor;
    const res = await api.progress.save(
      req('/api/progress', {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ profileId: me.profileId, videoId: video.id, positionMs: 30000 }),
      }),
    );
    expect(res.status).toBe(200);
    const list = await (
      await api.progress.get(req(`/api/progress?profileId=${me.profileId}`))
    ).json();
    expect(list.items).toHaveLength(1);
  });

  it('maps rate limits to 429 with Retry-After', async () => {
    signedIn = me.actor;
    limited = true;
    const res = await api.progress.save(
      post('/api/progress', { profileId: me.profileId, videoId: video.id, positionMs: 40000 }),
    );
    limited = false;
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
  });

  it('adds and removes My List entries', async () => {
    signedIn = me.actor;
    const target = { kind: 'video', id: video.id };
    expect(
      (await api.myList.add(post('/api/my-list', { profileId: me.profileId, target }))).status,
    ).toBe(201);
    const list = await (
      await api.myList.list(req(`/api/my-list?profileId=${me.profileId}`))
    ).json();
    expect(list.items).toHaveLength(1);
    const del = await api.myList.remove(
      req('/api/my-list', {
        method: 'DELETE',
        body: JSON.stringify({ profileId: me.profileId, target }),
      }),
    );
    expect(del.status).toBe(200);
  });

  it('validates My List filter and sort, and accepts the documented values', async () => {
    signedIn = me.actor;
    const base = `/api/my-list?profileId=${me.profileId}`;
    expect((await api.myList.list(req(`${base}&filter=bogus`))).status).toBe(422);
    expect((await api.myList.list(req(`${base}&sort=sideways`))).status).toBe(422);
    expect((await api.myList.list(req(`${base}&filter=not_started&sort=za`))).status).toBe(200);
  });

  it('title detail takes an id and 404s on junk', async () => {
    signedIn = me.actor;
    const q = `profileId=${me.profileId}`;
    const ok = await api.title(req(`/api/titles/${video.id}?${q}`), { id: video.id });
    expect(ok.status).toBe(200);
    expect((await api.title(req(`/api/titles/${uuidv7()}?${q}`), { id: uuidv7() })).status).toBe(
      404,
    );
    expect((await api.title(req(`/api/titles/nope?${q}`), { id: 'nope' })).status).toBe(404);
  });

  it('selecting a kids profile sets a signed cookie that closes the management routes', async () => {
    signedIn = me.actor;
    const sel = await api.profiles.select(post(`/api/profiles/${me.kidsProfileId}/select`, {}), {
      id: me.kidsProfileId,
    });
    expect(sel.status).toBe(200);
    const cookie = sel.headers.get('set-cookie')!.split(';')[0]!;
    expect(sel.headers.get('set-cookie')).toContain('HttpOnly');

    const blocked = await api.profiles.create(
      post('/api/profiles', { name: 'New', avatarId: 'sun' }, { cookie }),
    );
    expect(blocked.status).toBe(403);

    const forged = `ad_profile=${me.kidsProfileId}.AAAA`;
    const nope = await api.profiles.create(
      post('/api/profiles', { name: 'Sneaky', avatarId: 'sun' }, { cookie: forged }),
    );
    expect(nope.status).toBe(201);

    const foreign = await api.profiles.select(post(`/api/profiles/${other.profileId}/select`, {}), {
      id: other.profileId,
    });
    expect(foreign.status).toBe(404);
  });

  it('exit kids needs the password and clears the cookie', async () => {
    signedIn = me.actor;
    const wrong = await api.profiles.exitKids(post('/api/profiles/exit-kids', { password: 'bad' }));
    expect(wrong.status).toBe(403);
    const ok = await api.profiles.exitKids(
      post('/api/profiles/exit-kids', { password: 'correct horse battery staple' }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
