import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { realAuthEnabled } from '../server/auth/mode';
import { getSession as getRealSession, readSessionToken } from '../server/auth/session';
import { signInRedirect } from './auth-notices';
import { realDataEnabled } from '../server/data/mode';
import { cookieProfileIo } from '../server/data/profile-io';
import { rememberedProfile } from './profiles/always-ask';
import { can } from './admin/can';
import { getAccount, getProfiles } from './data';
import { guestContext } from './data/types';
import { currentGuestAudience } from '../server/guest/guest-view';
import type { Profile, ViewerContext, ViewerSession } from './data';

/**
 * The viewer session for pages and actions. With real auth it comes from the lane B session cookie. With real
 * viewer data the selected profile is the signed active profile cookie (server/viewer/active-profile.ts), which
 * is also what the API routes read. In fixture mode a cookie named ad_fixture switches the demo state: out,
 * unverified or noprofile, and ad_profile holds the selected fixture profile id.
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

async function selectedProfileId(): Promise<string | null | undefined> {
  if (realDataEnabled()) return cookieProfileIo().activeProfileId();
  return (await cookies()).get(PROFILE_COOKIE)?.value;
}

async function getRealViewerSession(): Promise<ViewerSession | null> {
  const real = await getRealSession();
  // M02-S08: an account waiting to be deleted can only use the cancel screen.
  if (real?.status === 'pending_deletion') redirect('/account/deletion');
  if (!real || real.status !== 'active') return null;
  const [overview, profiles, selected] = await Promise.all([
    getAccount().overview(real.accountId),
    getProfiles().list(real.accountId),
    selectedProfileId(),
  ]);
  return {
    accountId: real.accountId,
    email: overview.email,
    displayName: overview.displayName,
    verified: real.emailVerified,
    memberSince: overview.memberSince,
    profile: rememberedProfile(profiles, selected),
    canUpload: can(real.role, 'video.upload'),
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
  if (!session) {
    // A cookie that no longer maps to a session means it was revoked elsewhere or expired (M01-S12 AC3).
    const ended = realAuthEnabled() && (await readSessionToken()) !== undefined;
    redirect(signInRedirect(next, ended ? 'ended' : undefined));
  }
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

export type ViewerOrGuest =
  ({ kind: 'account' } & ViewerState) | { kind: 'guest'; ctx: ViewerContext };

/**
 * For pages anyone may open (M40-S01). A missing session is a guest with the device audience and never a
 * redirect. An account that is unverified or has no active profile keeps its redirects, and so does one waiting
 * for deletion. Personal pages keep using `requireProfile`.
 */
export async function getViewerOrGuest(next = '/'): Promise<ViewerOrGuest> {
  const session = await getSession();
  if (!session) return { kind: 'guest', ctx: guestContext(await currentGuestAudience()) };
  const state = await requireProfile(next);
  return { kind: 'account', ...state };
}
