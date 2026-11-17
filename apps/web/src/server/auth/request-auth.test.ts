import { Forbidden, Unauthorized } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { signActiveProfile } from '../viewer/active-profile';
import { createRequestAuth } from './request-auth';

const PID = '0198c3c0-0000-7000-8000-000000000001';
const SECRET = new Uint8Array(32).fill(5);

type Session = {
  sessionId: string;
  accountId: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'active' | 'locked';
  emailVerified: boolean;
  mfaVerified: boolean;
};

function auth(session: Session | null) {
  return createRequestAuth({
    sessions: {
      validate: async (token) => (token === 'good' && session ? (session as never) : null),
    },
    secureCookies: false,
    profileSecret: SECRET,
  });
}

const base: Session = {
  sessionId: 's1',
  accountId: 'a1',
  role: 'viewer',
  status: 'active',
  emailVerified: true,
  mfaVerified: false,
};
const req = (cookie?: string) =>
  new Request('http://localhost/api/x', { headers: cookie ? { cookie } : {} });

describe('getViewer', () => {
  it('resolves the account and the active profile cookie', async () => {
    const cookie = `ad_session=good; ad_profile=${signActiveProfile(SECRET, 'a1', PID)}`;
    expect(await auth(base).getViewer(req(cookie))).toEqual({ accountId: 'a1', profileId: PID });
  });

  it('returns an empty profile hint when the cookie is missing or forged', async () => {
    expect((await auth(base).getViewer(req('ad_session=good'))).profileId).toBe('');
    const forged = `ad_session=good; ad_profile=${signActiveProfile(SECRET, 'other', PID)}`;
    expect((await auth(base).getViewer(req(forged))).profileId).toBe('');
  });

  it('refuses no cookie, unknown token, locked and unverified accounts', async () => {
    await expect(auth(base).getViewer(req())).rejects.toBeInstanceOf(Unauthorized);
    await expect(auth(base).getViewer(req('ad_session=bad'))).rejects.toBeInstanceOf(Unauthorized);
    await expect(
      auth({ ...base, status: 'locked' }).getViewer(req('ad_session=good')),
    ).rejects.toBeInstanceOf(Unauthorized);
    await expect(
      auth({ ...base, emailVerified: false }).getViewer(req('ad_session=good')),
    ).rejects.toBeInstanceOf(Unauthorized);
  });
});

describe('getActor', () => {
  const staff: Session = { ...base, role: 'editor', mfaVerified: true };

  it('accepts an editor or admin whose session passed the second factor', async () => {
    expect(await auth(staff).getActor(req('ad_session=good'))).toEqual({
      accountId: 'a1',
      role: 'editor',
    });
    expect((await auth({ ...staff, role: 'admin' }).getActor(req('ad_session=good'))).role).toBe(
      'admin',
    );
  });

  it('answers 401 without a session or before the second factor', async () => {
    await expect(auth(staff).getActor(req())).rejects.toBeInstanceOf(Unauthorized);
    await expect(
      auth({ ...staff, mfaVerified: false }).getActor(req('ad_session=good')),
    ).rejects.toBeInstanceOf(Unauthorized);
  });

  it('answers 403 for a viewer who is signed in', async () => {
    await expect(auth(base).getActor(req('ad_session=good'))).rejects.toBeInstanceOf(Forbidden);
  });
});
