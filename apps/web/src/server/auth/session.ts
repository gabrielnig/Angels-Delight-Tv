import 'server-only';
import { DEFAULT_SESSION_POLICIES, type SessionContext } from '@ad/auth';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import {
  type SessionCookieKind,
  pendingCookieName,
  pendingCookieOptions,
  sessionCookieName,
  sessionCookieOptions,
} from './cookies';
import { buildMeta, sameOriginOr403 } from './request';
import { authRuntime } from './runtime';

const IDLE: Record<SessionCookieKind, number> = {
  viewer: DEFAULT_SESSION_POLICIES.viewer.idleSeconds,
  staff: DEFAULT_SESSION_POLICIES.staff.idleSeconds,
  pending_mfa: DEFAULT_SESSION_POLICIES.pendingMfa.idleSeconds,
};

export async function requestMeta() {
  return buildMeta(await headers(), authRuntime().env.TRUSTED_PROXY_MODE);
}

/** Server actions are also checked against Origin here, on top of the framework check (SECURITY.md section 4). */
export async function assertActionOrigin(): Promise<void> {
  const refused = sameOriginOr403(await headers(), authRuntime().env.APP_ORIGIN);
  if (refused) throw new Error('Cross-origin request refused');
}

export async function setSessionCookie(token: string, kind: SessionCookieKind): Promise<void> {
  const secure = authRuntime().secureCookies;
  (await cookies()).set(
    sessionCookieName(secure),
    token,
    sessionCookieOptions({ secure, kind, idleSeconds: IDLE[kind] }),
  );
}

export async function clearSessionCookie(): Promise<void> {
  const secure = authRuntime().secureCookies;
  (await cookies()).set(sessionCookieName(secure), '', {
    ...sessionCookieOptions({ secure, kind: 'viewer', idleSeconds: 0 }),
    maxAge: 0,
  });
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName(authRuntime().secureCookies))?.value;
}

export async function setPendingCookie(value: string, maxAge: number): Promise<void> {
  const secure = authRuntime().secureCookies;
  (await cookies()).set(pendingCookieName(secure), value, pendingCookieOptions(secure, maxAge));
}

export async function readPendingCookie(): Promise<string | undefined> {
  return (await cookies()).get(pendingCookieName(authRuntime().secureCookies))?.value;
}

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return authRuntime().sessions.validate(token);
});
