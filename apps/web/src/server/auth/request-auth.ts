import type { SessionContext } from '@ad/auth';
import { Forbidden, Unauthorized, type Actor, isStaffRole } from '@ad/shared';
import { activeProfileCookieName, cookieValue, readActiveProfile } from '../viewer/active-profile';
import { sessionCookieName } from './cookies';

export interface RequestAuthDeps {
  sessions: { validate(token: string): Promise<SessionContext | null> };
  secureCookies: boolean;
  /** Key for the active profile cookie, the same one the viewer routes use. */
  profileSecret: Uint8Array;
  /** Runs for every staff request after the session checks pass. Used for the per staff admin rate limit. */
  beforeStaff?(accountId: string): Promise<void>;
}

/**
 * Request level sign in checks for route handlers that take a `Request`, not Next cookies. Viewers need a verified,
 * active account. Staff also need a session that passed the second factor.
 */
export function createRequestAuth(deps: RequestAuthDeps) {
  async function session(request: Request): Promise<SessionContext> {
    const token = cookieValue(request.headers.get('cookie'), sessionCookieName(deps.secureCookies));
    if (!token) throw new Unauthorized();
    const found = await deps.sessions.validate(token);
    if (!found || found.status !== 'active' || !found.emailVerified) throw new Unauthorized();
    return found;
  }

  return {
    /** The signed in viewer. `profileId` is the active profile hint, or '' when the cookie is absent or not valid. */
    async getViewer(
      request: Request,
    ): Promise<{ accountId: string; profileId: string; kidsLocked: boolean }> {
      const found = await session(request);
      // The kids lock is on the session row. While it holds, the cookie is ignored.
      if (found.kidsLocked)
        return {
          accountId: found.accountId,
          profileId: found.activeProfileId ?? '',
          kidsLocked: true,
        };
      const profileId = readActiveProfile(
        deps.profileSecret,
        found.accountId,
        cookieValue(request.headers.get('cookie'), activeProfileCookieName(deps.secureCookies)),
      );
      return { accountId: found.accountId, profileId: profileId ?? '', kidsLocked: false };
    },

    /** The signed in editor or admin. 401 when not signed in or the second factor is pending, 403 for a viewer. */
    async getActor(request: Request): Promise<Actor> {
      const found = await session(request);
      if (!isStaffRole(found.role)) throw new Forbidden();
      if (!found.mfaVerified) throw new Unauthorized();
      await deps.beforeStaff?.(found.accountId);
      return { accountId: found.accountId, role: found.role };
    },
  };
}

export type RequestAuth = ReturnType<typeof createRequestAuth>;
