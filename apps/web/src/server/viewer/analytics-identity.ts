import { withAccount } from '@ad/db';
import { loadOwnedProfile } from '@ad/viewer';
import type { ViewerResolver } from '../../lib/data/analytics-viewer';
import { guestCookieName, readGuest } from '../guest/guest-cookie';
import { activeProfileCookieName, cookieValue, readActiveProfile } from './active-profile';
import type { ViewerRuntime } from './api';

type Needs = Pick<ViewerRuntime, 'ctx' | 'secureCookies' | 'profileSecret' | 'resolveActor'>;

const anonymous = { profileId: null, audience: 'general' } as const;

/**
 * Who is watching, for the analytics route: the signed in account's active profile, checked against the
 * database. Kids profiles come back as `audience: 'kids'` so the collector stores no identity for them. Any
 * doubt (no session, no cookie, a forged or stale cookie) means anonymous, never an error.
 */
export function createRealViewerResolver(rt: Needs): ViewerResolver {
  const name = activeProfileCookieName(rt.secureCookies);
  return async (request) => {
    const actor = await rt.resolveActor(request);
    if (!actor) {
      // A guest with a valid cookie counts as one viewer per day. The id is only hashed with the day downstream.
      const guestId = readGuest(
        rt.profileSecret,
        cookieValue(request.headers.get('cookie'), guestCookieName(rt.secureCookies)),
      );
      return guestId ? { ...anonymous, subjectId: guestId } : { ...anonymous };
    }
    const profileId = readActiveProfile(
      rt.profileSecret,
      actor.accountId,
      cookieValue(request.headers.get('cookie'), name),
    );
    if (!profileId) return { ...anonymous };
    try {
      const profile = await withAccount(rt.ctx.db, actor, (tx) =>
        loadOwnedProfile(tx, actor, profileId),
      );
      return { profileId: profile.id, audience: profile.isKids ? 'kids' : 'general' };
    } catch {
      return { ...anonymous };
    }
  };
}
