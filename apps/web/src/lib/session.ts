import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { realAuthEnabled } from '../server/auth/mode';
import { getSession as getRealSession } from '../server/auth/session';
import { getAccount, getProfiles } from './data';
import type { Profile, ViewerContext, ViewerSession } from './data';

/**
 * Fixture session. A cookie named ad_fixture switches the demo state: out, unverified or noprofile.
 * ad_profile holds the selected profile id. The real session reader from lane B replaces this file's internals.
 */
export const FIXTURE_ACCOUNT_ID = 'acct-demo';
const PROFILE_COOKIE = 'ad_profile';
const FIXTURE_COOKIE = 'ad_fixture';

/** The account the request acts for: the real signed in account, or the demo one in fixture mode. */
export async function currentAccountId(): Promise<string> {
  if (!realAuthEnabled()) return FIXTURE_ACCOUNT_ID;
  const session = await getRealSession();
  if (!session) throw new Error('Not signed in');
  return session.accountId;
}

async function getRealViewerSession(): Promise<ViewerSession | null> {
  const real = await getRealSession();
  if (!real || real.status !== 'active') return null;
  const [overview, profiles, jar] = await Promise.all([
    getAccount().overview(real.accountId),
    getProfiles().list(real.accountId),
    cookies(),
  ]);
  const selected = jar.get(PROFILE_COOKIE)?.value;
  return {
    accountId: real.accountId,
    email: overview.email,
    displayName: overview.displayName,
    verified: real.emailVerified,
    memberSince: overview.memberSince,
    profile: profiles.find((p) => p.id === selected) ?? null,
  };
}

export async function getSession(): Promise<ViewerSession | null> {
  if (realAuthEnabled()) return getRealViewerSession();
  const jar = await cookies();
  const mode = jar.get(FIXTURE_COOKIE)?.value;
  if (mode === 'out') return null;
  const profiles = await getProfiles().list(FIXTURE_ACCOUNT_ID);
  const selected = jar.get(PROFILE_COOKIE)?.value;
  let profile: Profile | null = profiles.find((p) => p.id === selected) ?? null;
  if (!profile && mode !== 'noprofile') profile = profiles[0] ?? null;
  if (mode === 'noprofile' && !selected) profile = null;
  return {
    accountId: FIXTURE_ACCOUNT_ID,
    email: 'adaeze.okafor@example.com',
    displayName: 'Adaeze Okafor',
    verified: mode !== 'unverified',
    memberSince: '3 Mar 2026',
    profile,
  };
}

export async function requireSession(next = '/'): Promise<ViewerSession> {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!session.verified) redirect('/verify-email');
  return session;
}

export interface ViewerState {
  session: ViewerSession;
  profile: Profile;
  ctx: ViewerContext;
}

export async function requireProfile(next = '/'): Promise<ViewerState> {
  const session = await requireSession(next);
  if (!session.profile) redirect('/profiles');
  return {
    session,
    profile: session.profile,
    ctx: {
      accountId: session.accountId,
      profileId: session.profile.id,
      audience: session.profile.kids ? 'kids' : 'adult',
    },
  };
}

export const sessionCookieNames = { profile: PROFILE_COOKIE, fixture: FIXTURE_COOKIE } as const;
