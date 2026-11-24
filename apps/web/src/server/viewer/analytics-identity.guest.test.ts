import { describe, expect, it } from 'vitest';
import { guestCookieName, newGuestId, signGuest } from '../guest/guest-cookie';
import { createRealViewerResolver } from './analytics-identity';

const secret = new Uint8Array(32).fill(4);

function resolver(actor: unknown = null, secure = true, kids = false) {
  return createRealViewerResolver({
    guestAudience: async () => ({ kids }),
    ctx: { db: {} } as never,
    secureCookies: secure,
    profileSecret: secret,
    resolveActor: async () => actor as never,
  });
}
const req = (cookie?: string) =>
  new Request('https://app.test/api/analytics', {
    method: 'POST',
    ...(cookie ? { headers: { cookie } } : {}),
  });

describe('analytics identity for guests (M40-S16)', () => {
  it('returns the guest id as the subject for a valid guest cookie, with no profile', async () => {
    const id = newGuestId();
    const who = await resolver()(req(`${guestCookieName(true)}=${signGuest(secret, id)}`));
    expect(who).toEqual({ profileId: null, audience: 'general', subjectId: id });
  });

  it('is anonymous for no cookie and for a forged or foreign cookie', async () => {
    const id = newGuestId();
    expect(await resolver()(req())).toEqual({ profileId: null, audience: 'general' });
    expect(await resolver()(req(`${guestCookieName(true)}=${id}.forged`))).toEqual({
      profileId: null,
      audience: 'general',
    });
    const other = signGuest(new Uint8Array(32).fill(9), id);
    expect(await resolver()(req(`${guestCookieName(true)}=${other}`))).toEqual({
      profileId: null,
      audience: 'general',
    });
  });

  it('a signed in account is never given a guest subject', async () => {
    const id = newGuestId();
    const who = await resolver({ accountId: 'a', role: 'viewer' })(
      req(`${guestCookieName(true)}=${signGuest(secret, id)}`),
    );
    expect(who.subjectId).toBeUndefined();
  });

  it('reads the plain cookie name when cookies are not secure', async () => {
    const id = newGuestId();
    const who = await resolver(null, false)(req(`ad_guest=${signGuest(secret, id)}`));
    expect(who.subjectId).toBe(id);
  });

  it('stores no identity for a guest in Kids mode', async () => {
    const id = newGuestId();
    const who = await resolver(
      null,
      true,
      true,
    )(req(`${guestCookieName(true)}=${signGuest(secret, id)}`));
    expect(who).toEqual({ profileId: null, audience: 'kids' });
  });
});
