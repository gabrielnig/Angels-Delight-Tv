import {
  NOW,
  createHarness,
  integrationEnabled,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerApi } from './api';

const ORIGIN = 'https://app.test';

describe.skipIf(!integrationEnabled())('POST /api/watch/progress', () => {
  let h: ViewerHarness;
  let api: ReturnType<typeof createViewerApi>;
  let me: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let other: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let video: Awaited<ReturnType<typeof seedVideo>>;
  let signedIn: Actor | null;

  const post = (body: unknown, init: RequestInit = {}) =>
    new Request(`${ORIGIN}/api/watch/progress`, {
      method: 'POST',
      headers: { origin: ORIGIN, ...(init.headers as Record<string, string>) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const update = (extra: Record<string, unknown> = {}) => ({
    videoId: video.id,
    profileId: me.profileId,
    positionSeconds: 42.4,
    durationSeconds: 120,
    ended: false,
    ...extra,
  });

  beforeAll(async () => {
    h = await createHarness();
    me = await h.makeUser();
    other = await h.makeUser();
    video = await seedVideo(h.db.setup, { kidsSafe: true, title: 'Rivers' });
    api = createViewerApi({
      ctx: h.ctx,
      appOrigin: ORIGIN,
      secureCookies: false,
      profileSecret: new Uint8Array(32).fill(9),
      resolveActor: async () => signedIn,
    });
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('answers 401 signed out and refuses cross-origin writes', async () => {
    signedIn = null;
    expect((await api.watchProgress(post(update()))).status).toBe(401);
    signedIn = me.actor;
    const cross = await api.watchProgress(post(update(), { headers: { origin: 'https://evil.test' } }));
    expect(cross.status).toBe(403);
  });

  it('stores the position in milliseconds and the player sink shape works', async () => {
    signedIn = me.actor;
    const res = await api.watchProgress(post(update()));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const saved = await (
      await api.progress.get(
        new Request(`${ORIGIN}/api/progress?profileId=${me.profileId}&videoId=${video.id}`),
      )
    ).json();
    expect(saved.progress).toMatchObject({ positionMs: 42_400, completed: false });
  });

  it('is idempotent and accepts a sendBeacon text body', async () => {
    signedIn = me.actor;
    h.setNow(new Date(NOW.getTime() + 60_000));
    const body = JSON.stringify(update({ positionSeconds: 60 }));
    for (let i = 0; i < 2; i += 1) {
      const res = await api.watchProgress(
        post(body, { headers: { 'content-type': 'text/plain;charset=UTF-8' } }),
      );
      expect(res.status).toBe(200);
    }
    const saved = await (
      await api.progress.get(
        new Request(`${ORIGIN}/api/progress?profileId=${me.profileId}&videoId=${video.id}`),
      )
    ).json();
    expect(saved.progress.positionMs).toBe(60_000);
  });

  it('marks the video finished when the player reports the end', async () => {
    signedIn = me.actor;
    h.setNow(new Date(NOW.getTime() + 120_000));
    await api.watchProgress(post(update({ positionSeconds: 119, ended: true })));
    const saved = await (
      await api.progress.get(
        new Request(`${ORIGIN}/api/progress?profileId=${me.profileId}&videoId=${video.id}`),
      )
    ).json();
    expect(saved.progress.completed).toBe(true);
  });

  it('answers 404 for another account profile and 422 for bad input', async () => {
    signedIn = me.actor;
    expect((await api.watchProgress(post(update({ profileId: other.profileId })))).status).toBe(404);
    expect((await api.watchProgress(post(update({ positionSeconds: -3 })))).status).toBe(422);
    expect((await api.watchProgress(post(update({ positionSeconds: 'soon' })))).status).toBe(422);
    expect((await api.watchProgress(post('{nope'))).status).toBe(422);
  });
});
