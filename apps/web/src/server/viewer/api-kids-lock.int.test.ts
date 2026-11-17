import {
  createHarness,
  integrationEnabled,
  TEST_PASSWORD,
  type ViewerHarness,
} from '@ad/viewer/testing';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerApi, type KidsLockStore, type ViewerRuntime } from './api';
import { activeProfileCookieName, signActiveProfile } from './active-profile';

const ORIGIN = 'https://app.test';
const SECRET = new Uint8Array(32).fill(9);

/** The server side session row, as the runtime sees it. A cookie can never change it. */
function memoryLock() {
  const state = { sessionId: 's1', profileId: null as string | null, kidsLocked: false };
  const store: KidsLockStore = {
    read: async () => ({ ...state }),
    set: async (_session, _account, profileId, kidsLocked) => {
      state.profileId = profileId;
      state.kidsLocked = kidsLocked;
    },
    clear: async () => {
      state.profileId = null;
      state.kidsLocked = false;
    },
  };
  return { state, store };
}

describe.skipIf(!integrationEnabled())('viewer api kids lock', () => {
  let h: ViewerHarness;
  let user: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let actor: Actor;
  let lock: ReturnType<typeof memoryLock>;
  let api: ReturnType<typeof createViewerApi>;

  const call = (path: string, init: RequestInit = {}, cookie?: string) => {
    const headers = new Headers(init.headers);
    if (init.method && init.method !== 'GET') headers.set('origin', ORIGIN);
    if (cookie) headers.set('cookie', cookie);
    return new Request(`${ORIGIN}${path}`, { ...init, headers });
  };
  const post = (path: string, body: unknown, cookie?: string) =>
    call(path, { method: 'POST', body: JSON.stringify(body) }, cookie);

  beforeAll(async () => {
    h = await createHarness();
    user = await h.makeUser();
    actor = user.actor;
  });
  afterAll(async () => {
    await h?.drop();
  });

  beforeAll(() => {
    lock = memoryLock();
    const runtime: ViewerRuntime = {
      ctx: h.ctx,
      appOrigin: ORIGIN,
      secureCookies: false,
      profileSecret: SECRET,
      resolveActor: async () => actor,
      lock: lock.store,
    };
    api = createViewerApi(runtime);
  });

  it('locks the session when a kids profile is selected', async () => {
    const res = await api.profiles.select(post(`/api/profiles/${user.kidsProfileId}/select`, {}), {
      id: user.kidsProfileId,
    });
    expect(res.status).toBe(200);
    expect(lock.state).toMatchObject({ profileId: user.kidsProfileId, kidsLocked: true });
  });

  it('refuses a grown-up profile id in a read even with the cookie deleted', async () => {
    const res = await api.browse(call(`/api/browse?profileId=${user.profileId}`));
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe('kids_gate');
  });

  it('refuses a grown-up profile id in a write body', async () => {
    const res = await api.progress.save(
      post('/api/progress', { profileId: user.profileId, videoId: user.profileId, positionMs: 1 }),
    );
    expect(res.status).toBe(403);
  });

  it('ignores a forged cookie that names the grown-up profile', async () => {
    const forged = `${activeProfileCookieName(false)}=${signActiveProfile(SECRET, user.accountId, user.profileId)}`;
    const res = await api.browse(call(`/api/browse?profileId=${user.profileId}`, {}, forged));
    expect(res.status).toBe(403);
    const select = await api.profiles.select(
      post(`/api/profiles/${user.profileId}/select`, {}, forged),
      { id: user.profileId },
    );
    expect(select.status).toBe(403);
  });

  it('serves the kids profile itself', async () => {
    const res = await api.browse(call(`/api/browse?profileId=${user.kidsProfileId}`));
    expect(res.status).toBe(200);
  });

  it('refuses profile management and keeps the lock on the same session', async () => {
    const res = await api.profiles.create(
      post('/api/profiles', { name: 'Sneaky', avatarId: 'moon' }),
    );
    expect(res.status).toBe(403);
    expect(lock.state.kidsLocked).toBe(true);
  });

  it('keeps the lock after a wrong password', async () => {
    const res = await api.profiles.exitKids(post('/api/profiles/exit-kids', { password: 'nope' }));
    expect(res.status).toBe(403);
    expect(lock.state.kidsLocked).toBe(true);
  });

  it('clears the lock only with the account password', async () => {
    const res = await api.profiles.exitKids(
      post('/api/profiles/exit-kids', { password: TEST_PASSWORD }),
    );
    expect(res.status).toBe(200);
    expect(lock.state.kidsLocked).toBe(false);
    const open = await api.profiles.select(post(`/api/profiles/${user.profileId}/select`, {}), {
      id: user.profileId,
    });
    expect(open.status).toBe(200);
    expect(lock.state).toMatchObject({ profileId: user.profileId, kidsLocked: false });
  });
});
