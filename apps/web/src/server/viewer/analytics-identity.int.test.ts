import { createHarness, integrationEnabled, type ViewerHarness } from '@ad/viewer/testing';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activeProfileCookieName, signActiveProfile } from './active-profile';
import { createRealViewerResolver } from './analytics-identity';

const SECRET = new Uint8Array(32).fill(3);

describe.skipIf(!integrationEnabled())('analytics viewer identity', () => {
  let h: ViewerHarness;
  let actor: Actor | null;
  let resolve: ReturnType<typeof createRealViewerResolver>;

  const request = (cookie?: string) =>
    new Request('https://app.test/api/analytics', {
      method: 'POST',
      headers: cookie ? { cookie } : {},
    });
  const cookieFor = (accountId: string, profileId: string) =>
    `${activeProfileCookieName(false)}=${signActiveProfile(SECRET, accountId, profileId)}`;

  beforeAll(async () => {
    h = await createHarness();
    resolve = createRealViewerResolver({
      ctx: h.ctx,
      secureCookies: false,
      profileSecret: SECRET,
      resolveActor: async () => actor,
    });
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('is anonymous without a session', async () => {
    actor = null;
    expect(await resolve(request())).toEqual({ profileId: null, audience: 'general' });
  });

  it('is anonymous with a session but no active profile', async () => {
    const u = await h.makeUser();
    actor = u.actor;
    expect(await resolve(request())).toEqual({ profileId: null, audience: 'general' });
  });

  it('returns the active adult profile', async () => {
    const u = await h.makeUser();
    actor = u.actor;
    expect(await resolve(request(cookieFor(u.accountId, u.profileId)))).toEqual({
      profileId: u.profileId,
      audience: 'general',
    });
  });

  it('marks a kids profile so no identity is stored for it', async () => {
    const u = await h.makeUser();
    actor = u.actor;
    expect(await resolve(request(cookieFor(u.accountId, u.kidsProfileId)))).toEqual({
      profileId: u.kidsProfileId,
      audience: 'kids',
    });
  });

  it('ignores a cookie for a profile of another account or a forged one', async () => {
    const u = await h.makeUser();
    const other = await h.makeUser();
    actor = u.actor;
    // Signed for the other account, so it does not verify for this one.
    expect(await resolve(request(cookieFor(other.accountId, other.profileId)))).toEqual({
      profileId: null,
      audience: 'general',
    });
    // Signed for this account but pointing at someone else's profile id cannot happen without the secret,
    // and an unsigned id is rejected.
    expect(
      await resolve(request(`${activeProfileCookieName(false)}=${other.profileId}.forged`)),
    ).toEqual({ profileId: null, audience: 'general' });
  });

  it('falls back to anonymous when the profile no longer exists', async () => {
    const u = await h.makeUser();
    actor = u.actor;
    const gone = '0198a000-0000-7000-8000-000000000001';
    expect(await resolve(request(cookieFor(u.accountId, gone)))).toEqual({
      profileId: null,
      audience: 'general',
    });
  });
});
