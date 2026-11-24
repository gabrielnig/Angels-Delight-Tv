import { createHarness, integrationEnabled, seedVideo, type ViewerHarness } from '@ad/viewer/testing';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerApi, type ViewerRuntime } from './api';

const ORIGIN = 'https://app.test';

describe.skipIf(!integrationEnabled())('ratings api', () => {
  let h: ViewerHarness;
  let api: ReturnType<typeof createViewerApi>;
  let me: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let video: Awaited<ReturnType<typeof seedVideo>>;
  let signedIn: Actor | null;
  let lock = { sessionId: 's', profileId: null as string | null, kidsLocked: false };

  const req = (method: string, path: string, body?: unknown, origin: string | null = ORIGIN) => {
    const headers = new Headers();
    if (origin && method !== 'GET') headers.set('origin', origin);
    return new Request(`${ORIGIN}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  beforeAll(async () => {
    h = await createHarness();
    me = await h.makeUser();
    video = await seedVideo(h.db.setup, { kidsSafe: true, maturityRank: 0 });
    const runtime: ViewerRuntime = {
      ctx: h.ctx,
      appOrigin: ORIGIN,
      secureCookies: false,
      profileSecret: new Uint8Array(32).fill(9),
      resolveActor: async () => signedIn,
      lock: { read: async () => lock, set: async () => undefined, clear: async () => undefined },
    };
    api = createViewerApi(runtime);
  });
  afterAll(async () => {
    await h?.drop();
  });

  const body = (value: number | null, profileId = me.profileId) => ({
    profileId,
    target: { kind: 'video', id: video.id },
    value,
  });

  it('PUT sets and clears, GET reads the current value', async () => {
    signedIn = me.actor;
    const set = await api.ratings.set(req('PUT', '/api/ratings', body(2)));
    expect(set.status).toBe(200);
    expect((await set.json()).value).toBe(2);
    const got = await api.ratings.get(
      req('GET', `/api/ratings?profileId=${me.profileId}&kind=video&id=${video.id}`),
    );
    expect((await got.json()).value).toBe(2);
    const cleared = await api.ratings.set(req('PUT', '/api/ratings', body(null)));
    expect((await cleared.json()).value).toBeNull();
  });

  it('rejects bad bodies, a foreign origin and no session', async () => {
    signedIn = me.actor;
    expect((await api.ratings.set(req('PUT', '/api/ratings', body(5)))).status).toBe(422);
    expect((await api.ratings.set(req('PUT', '/api/ratings', { profileId: me.profileId }))).status).toBe(422);
    expect(
      (await api.ratings.set(req('PUT', '/api/ratings', body(1), 'https://evil.test'))).status,
    ).toBe(403);
    signedIn = null;
    expect((await api.ratings.set(req('PUT', '/api/ratings', body(1)))).status).toBe(401);
  });

  it('answers 403 kids_no_rating for a kids profile and kids_gate under the lock', async () => {
    signedIn = me.actor;
    const kids = await api.ratings.set(req('PUT', '/api/ratings', body(1, me.kidsProfileId)));
    expect(kids.status).toBe(403);
    expect((await kids.json()).error.message).toBe('kids_no_rating');
    lock = { sessionId: 's', profileId: me.kidsProfileId, kidsLocked: true };
    const gated = await api.ratings.set(req('PUT', '/api/ratings', body(1, me.profileId)));
    expect(gated.status).toBe(403);
    expect((await gated.json()).error.message).toBe('kids_gate');
    lock = { sessionId: 's', profileId: null, kidsLocked: false };
  });
});
