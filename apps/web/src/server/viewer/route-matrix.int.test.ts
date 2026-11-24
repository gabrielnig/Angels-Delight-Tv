import { uuidv7, type Actor } from '@ad/shared';
import {
  createHarness,
  integrationEnabled,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { guestCookieName, newGuestId, signGuest } from '../guest/guest-cookie';
import { networkSubject } from '../guest/challenge';
import { createViewerApi, type ViewerApi, type ViewerRuntime } from './api';

/**
 * The route authorization matrix for guest access (M40, SECURITY.md section 3). Rows are the routes, columns are
 * who asks. Public GETs answer a guest. Personal routes stay 401 for anyone without an account, with a real guest
 * cookie, with a forged one, and with a cookie from another key.
 */
const ORIGIN = 'https://app.test';
const SECRET = new Uint8Array(32).fill(9);

type Who = 'anonymous' | 'guest' | 'forged' | 'foreign-key' | 'viewer' | 'kids-locked';

describe.skipIf(!integrationEnabled())('route authorization matrix (guests)', () => {
  let h: ViewerHarness;
  let api: ViewerApi;
  let user: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let adultVideo: Awaited<ReturnType<typeof seedVideo>>;
  let kidVideo: Awaited<ReturnType<typeof seedVideo>>;
  let actor: Actor | null = null;
  let kidsLock = false;
  let siteDefault: 'general' | 'kids' = 'general';
  const spent: string[] = [];

  const id = newGuestId();
  const cookieFor: Record<Who, string | undefined> = {
    anonymous: undefined,
    guest: `ad_guest=${signGuest(SECRET, id)}`,
    forged: `ad_guest=${id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
    'foreign-key': `ad_guest=${signGuest(new Uint8Array(32).fill(1), id)}`,
    viewer: undefined,
    'kids-locked': undefined,
  };

  async function call(
    who: Who,
    handler: (r: Request, p?: Record<string, string>) => Promise<Response>,
    path: string,
    init: RequestInit = {},
    params?: Record<string, string>,
  ) {
    actor = who === 'viewer' || who === 'kids-locked' ? user.actor : null;
    kidsLock = who === 'kids-locked';
    const headers = new Headers(init.headers);
    if (cookieFor[who]) headers.set('cookie', cookieFor[who]!);
    if (init.method && init.method !== 'GET' && !headers.has('origin'))
      headers.set('origin', ORIGIN);
    return handler(new Request(`${ORIGIN}${path}`, { ...init, headers }), params);
  }

  beforeAll(async () => {
    h = await createHarness({
      rateLimit: async (bucket, subject) => {
        spent.push(`${bucket}:${subject}`);
        return { allowed: true, retryAfterSeconds: 0 };
      },
    });
    user = await h.makeUser();
    adultVideo = await seedVideo(h.db.setup, { title: 'Matrix adults', kidsSafe: false });
    kidVideo = await seedVideo(h.db.setup, { title: 'Matrix children', kidsSafe: true });
    const runtime: ViewerRuntime = {
      ctx: h.ctx,
      appOrigin: ORIGIN,
      secureCookies: false,
      profileSecret: SECRET,
      resolveActor: async () => actor,
      lock: {
        read: async () =>
          kidsLock ? { sessionId: 's1', profileId: user.kidsProfileId, kidsLocked: true } : null,
        set: async () => undefined,
        clear: async () => undefined,
      },
      guestAudience: async () => ({ kids: siteDefault === 'kids' }),
      clientIp: () => '203.0.113.9',
    };
    api = createViewerApi(runtime);
  });
  afterAll(async () => {
    await h?.drop();
  });

  const publicRows: Array<
    [
      string,
      () => string,
      (a: ViewerApi) => (r: Request, p?: Record<string, string>) => Promise<Response>,
    ]
  > = [
    ['GET /api/home', () => `/api/home?profileId=${user.profileId}`, (a) => a.home],
    ['GET /api/browse', () => `/api/browse?profileId=${user.profileId}`, (a) => a.browse],
    [
      'GET /api/browse/categories',
      () => `/api/browse/categories?profileId=${user.profileId}`,
      (a) => a.categories,
    ],
    ['GET /api/search', () => `/api/search?profileId=${user.profileId}&q=matrix`, (a) => a.search],
    [
      'GET /api/search/suggest',
      () => `/api/search/suggest?profileId=${user.profileId}&q=matrix`,
      (a) => a.suggest,
    ],
    ['GET /api/titles/batch', () => `/api/titles/batch?ids=${kidVideo.id}`, (a) => a.titlesBatch],
  ];

  describe.each(['anonymous', 'guest', 'forged', 'foreign-key'] as Who[])(
    'public GETs as %s',
    (who) => {
      it.each(publicRows)('%s answers 200', async (_name, path, pick) => {
        const res = await call(who, pick(api), path());
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toMatch(/private/);
      });

      it('GET /api/titles/[id] answers 200 with no personal state', async () => {
        const res = await call(
          who,
          api.title,
          `/api/titles/${kidVideo.id}?profileId=${user.profileId}`,
          {},
          { id: kidVideo.id },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.progress).toBeNull();
        expect(body.card.inMyList).toBe(false);
      });
    },
  );

  describe.each(['anonymous', 'guest', 'forged', 'foreign-key'] as Who[])(
    'personal routes as %s stay 401',
    (who) => {
      it('GET /api/progress, /api/my-list, /api/profiles, /api/search/recent', async () => {
        const q = `profileId=${user.profileId}`;
        expect((await call(who, api.progress.get, `/api/progress?${q}`)).status).toBe(401);
        expect((await call(who, api.myList.list, `/api/my-list?${q}`)).status).toBe(401);
        expect((await call(who, api.profiles.list, '/api/profiles')).status).toBe(401);
        expect((await call(who, api.recentSearches.list, `/api/search/recent?${q}`)).status).toBe(
          401,
        );
      });

      it('writes: progress, watch progress, my list, profile create, exit kids', async () => {
        const body = JSON.stringify({
          profileId: user.profileId,
          videoId: kidVideo.id,
          positionMs: 1000,
          target: { kind: 'video', id: kidVideo.id },
          name: 'x',
          avatarId: 'moon',
          password: 'x',
        });
        const post = { method: 'POST', body };
        expect((await call(who, api.progress.save, '/api/progress', post)).status).toBe(401);
        expect((await call(who, api.progress.import, '/api/progress/import', post)).status).toBe(
          401,
        );
        expect(
          (
            await call(who, api.watchProgress, '/api/watch/progress', {
              method: 'POST',
              body: JSON.stringify({
                profileId: user.profileId,
                videoId: kidVideo.id,
                positionSeconds: 3,
              }),
            })
          ).status,
        ).toBe(401);
        expect((await call(who, api.myList.add, '/api/my-list', post)).status).toBe(401);
        expect((await call(who, api.profiles.create, '/api/profiles', post)).status).toBe(401);
        expect(
          (await call(who, api.profiles.exitKids, '/api/profiles/exit-kids', post)).status,
        ).toBe(401);
      });
    },
  );

  it('public GET routes answer 405 to a write method, signed in or not', async () => {
    for (const who of ['anonymous', 'viewer'] as Who[]) {
      for (const [, path, pick] of publicRows) {
        const res = await call(who, pick(api), path(), { method: 'POST', body: '{}' });
        expect(res.status, `${who} ${path()}`).toBe(405);
      }
    }
  });

  it('a signed in viewer still gets the personal path', async () => {
    const res = await call('viewer', api.home, `/api/home?profileId=${user.profileId}`);
    expect(res.status).toBe(200);
    const mine = await call(
      'viewer',
      api.progress.get,
      `/api/progress?profileId=${user.profileId}`,
    );
    expect(mine.status).toBe(200);
  });

  it('a signed in viewer without a valid profile id is refused as before, never given the guest path', async () => {
    const res = await call('viewer', api.home, `/api/home?profileId=${uuidv7()}`);
    expect(res.status).toBe(404);
    expect((await call('viewer', api.home, '/api/home')).status).toBe(422);
  });

  it('a kids-locked session still gets only kid titles from browse and home', async () => {
    const res = await call(
      'kids-locked',
      api.browse,
      `/api/browse?profileId=${user.kidsProfileId}`,
    );
    expect(res.status).toBe(200);
    const titles = (await res.json()).items.map((i: { title: string }) => i.title);
    expect(titles).toContain('Matrix children');
    expect(titles).not.toContain('Matrix adults');
    // Naming the grown up profile is still refused by the kids lock.
    expect(
      (await call('kids-locked', api.browse, `/api/browse?profileId=${user.profileId}`)).status,
    ).toBe(403);
  });

  it('general guests see adult titles, Kids mode guests never do, from every public GET', async () => {
    siteDefault = 'general';
    const all = await (await call('anonymous', api.browse, '/api/browse')).json();
    expect(all.items.map((i: { title: string }) => i.title)).toContain('Matrix adults');
    siteDefault = 'kids';
    try {
      const kidsBrowse = await (await call('anonymous', api.browse, '/api/browse')).json();
      expect(kidsBrowse.items.map((i: { title: string }) => i.title)).not.toContain(
        'Matrix adults',
      );
      const search = await (await call('anonymous', api.search, '/api/search?q=matrix')).json();
      expect(JSON.stringify(search)).not.toContain('Matrix adults');
      const home = await (await call('anonymous', api.home, '/api/home')).json();
      expect(JSON.stringify(home)).not.toContain('Matrix adults');
      const suggest = await (
        await call('anonymous', api.suggest, '/api/search/suggest?q=matrix')
      ).json();
      expect(JSON.stringify(suggest)).not.toContain('Matrix adults');
      const title = await call(
        'anonymous',
        api.title,
        `/api/titles/${adultVideo.id}`,
        {},
        { id: adultVideo.id },
      );
      expect(title.status).toBe(404);
      const batch = await (
        await call(
          'anonymous',
          api.titlesBatch,
          `/api/titles/batch?ids=${adultVideo.id},${kidVideo.id}`,
        )
      ).json();
      expect(batch.items.map((i: { id: string }) => i.id)).toEqual([kidVideo.id]);
    } finally {
      siteDefault = 'general';
    }
  });

  it('batch lookups are capped at 20 ids and only take UUIDs', async () => {
    const many = Array.from({ length: 21 }, () => uuidv7()).join(',');
    expect((await call('anonymous', api.titlesBatch, `/api/titles/batch?ids=${many}`)).status).toBe(
      422,
    );
    const mixed = await call(
      'anonymous',
      api.titlesBatch,
      `/api/titles/batch?ids=${kidVideo.id},nope,${uuidv7()}`,
    );
    expect(mixed.status).toBe(200);
    expect((await mixed.json()).items.map((i: { id: string }) => i.id)).toEqual([kidVideo.id]);
    expect((await call('anonymous', api.titlesBatch, '/api/titles/batch')).status).toBe(422);
  });

  it('spends the guest limits on the address, and on the guest id only when the cookie verifies', async () => {
    const net = networkSubject(SECRET, '203.0.113.9', 'guest-public');
    expect(net).not.toContain('203.0.113');
    spent.length = 0;
    await call('anonymous', api.browse, '/api/browse');
    expect(spent).toEqual([`api:guest-ip:${net}`]);
    spent.length = 0;
    await call('guest', api.search, '/api/search?q=matrix');
    expect(spent).toEqual([
      `api:guest-ip:${net}`,
      `api:guest:${id}`,
      `search:guest-ip:${net}`,
      `search:guest:${id}`,
    ]);
    spent.length = 0;
    await call('forged', api.browse, '/api/browse');
    expect(spent).toEqual([`api:guest-ip:${net}`]);
  });

  it('a guest cookie never turns into an account: personal reads of a profile id stay 401', async () => {
    const res = await call(
      'guest',
      api.progress.get,
      `/api/progress?profileId=${user.profileId}&videoId=${kidVideo.id}`,
    );
    expect(res.status).toBe(401);
    expect(guestCookieName(false)).toBe('ad_guest');
  });
});
