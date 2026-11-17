import 'server-only';
import { cookies } from 'next/headers';
import {
  activeProfileCookieName,
  activeProfileCookieOptions,
  readActiveProfile,
  signActiveProfile,
} from '../viewer/active-profile';
import { viewerRuntime } from '../viewer/runtime';
import { getSession } from '../auth/session';
import { authRuntime } from '../auth/runtime';
import type { ProfileIo } from './real-profiles';

/**
 * The signed active profile cookie, read and written through next/headers. The same cookie the API route
 * `/api/profiles/[id]/select` sets, so the routes and the pages agree on who is watching.
 */
export function cookieProfileIo(): ProfileIo {
  const rt = () => viewerRuntime();
  return {
    async activeProfileId() {
      const session = await getSession();
      if (!session) return null;
      // A kids lock on the session row wins over the cookie, which the client can delete or replace.
      if (session.kidsLocked) return session.activeProfileId;
      const value = (await cookies()).get(activeProfileCookieName(rt().secureCookies))?.value;
      return readActiveProfile(rt().profileSecret, session.accountId, value);
    },
    async kidsLocked() {
      return (await getSession())?.kidsLocked ?? false;
    },
    async clearLock() {
      const session = await getSession();
      if (session) await authRuntime().sessions.clearKidsLock(session.sessionId, session.accountId);
    },
    async setActive(accountId, profileId, isKids) {
      const session = await getSession();
      if (session)
        await authRuntime().sessions.setProfile(session.sessionId, accountId, profileId, isKids);
      const { secureCookies, profileSecret } = rt();
      (await cookies()).set(
        activeProfileCookieName(secureCookies),
        signActiveProfile(profileSecret, accountId, profileId),
        activeProfileCookieOptions(secureCookies),
      );
    },
    async clearActive() {
      const { secureCookies } = rt();
      (await cookies()).set(activeProfileCookieName(secureCookies), '', {
        ...activeProfileCookieOptions(secureCookies),
        maxAge: 0,
      });
    },
  };
}
