import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getProfiles } from './data';
import type { Profile, ViewerContext, ViewerSession } from './data';

/**
 * Fixture session. A cookie named ad_fixture switches the demo state: out, unverified or noprofile.
 * ad_profile holds the selected profile id. The real session reader from lane B replaces this file's internals.
 */
export const FIXTURE_ACCOUNT_ID = 'acct-demo';
const PROFILE_COOKIE = 'ad_profile';
const FIXTURE_COOKIE = 'ad_fixture';

export async function getSession(): Promise<ViewerSession | null> {
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
