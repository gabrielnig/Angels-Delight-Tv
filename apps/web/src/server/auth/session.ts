import 'server-only';
import { DEFAULT_SESSION_POLICIES, type SessionContext } from '@ad/auth';
import { randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import {
  type SessionCookieKind,
  pendingCookieName,
  pendingCookieOptions,
  sessionCookieName,
  sessionCookieOptions,
  DEVICE_COOKIE_DAYS,
  deviceCookieName,
  twoStepCookieName,
} from './cookies';
import { buildMeta, sameOriginOr403 } from './request';
import { authRuntime } from './runtime';

const IDLE: Record<SessionCookieKind, number> = {
  viewer: DEFAULT_SESSION_POLICIES.viewer.idleSeconds,
  staff: DEFAULT_SESSION_POLICIES.staff.idleSeconds,
  pending_mfa: DEFAULT_SESSION_POLICIES.pendingMfa.idleSeconds,
};

/** The device id of this browser. Minted on first use. Setting a cookie can fail outside an action, which is fine. */
async function deviceId(): Promise<string> {
  const secure = authRuntime().secureCookies;
  const jar = await cookies();
  const existing = jar.get(deviceCookieName(secure))?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const minted = randomBytes(24).toString('base64url');
  try {
    jar.set(deviceCookieName(secure), minted, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: DEVICE_COOKIE_DAYS * 86_400,
    });
  } catch {
    // Read only context: the next action sets it.
  }
  return minted;
}

export async function requestMeta() {
  return buildMeta(await headers(), authRuntime().env.TRUSTED_PROXY_MODE, await deviceId());
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

export async function setTwoStepCookie(value: string, maxAge: number): Promise<void> {
  const secure = authRuntime().secureCookies;
  (await cookies()).set(twoStepCookieName(secure), value, pendingCookieOptions(secure, maxAge));
}

export async function readTwoStepCookie(): Promise<string | undefined> {
  return (await cookies()).get(twoStepCookieName(authRuntime().secureCookies))?.value;
}

export async function clearTwoStepCookie(): Promise<void> {
  const secure = authRuntime().secureCookies;
  (await cookies()).set(twoStepCookieName(secure), '', pendingCookieOptions(secure, 0));
}

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return authRuntime().sessions.validate(token);
});
