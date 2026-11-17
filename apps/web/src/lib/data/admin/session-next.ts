import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { can } from '@/lib/admin/can';
import type { AdminAction } from '@/lib/admin/can';
import { realAdminActor, realPendingActor } from '@/server/auth/admin';
import { realAuthEnabled } from '@/server/auth/mode';
import { createFixtureAuth, fixtureAuthEnabled, PENDING_COOKIE, SESSION_COOKIE } from './session';
import type { AdminActor } from './types';

type Auth = ReturnType<typeof createFixtureAuth>;
const KEY = Symbol.for('ad.admin.fixture.auth');

export function fixtureAuth(): Auth {
  const holder = globalThis as unknown as Record<symbol, Auth | undefined>;
  return (holder[KEY] ??= createFixtureAuth());
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/admin',
};

/** Returns the signed in staff member, or null. Replace the body when the auth lane lands. */
export async function getActor(): Promise<AdminActor | null> {
  if (realAuthEnabled()) {
    const real = await realAdminActor();
    return real && can(real.role, 'admin.access') ? real : null;
  }
  if (!fixtureAuthEnabled()) return null;
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  const actor = id ? fixtureAuth().actorFor(id) : null;
  return actor && can(actor.role, 'admin.access') ? actor : null;
}

export async function requireActor(next = '/admin'): Promise<AdminActor> {
  const actor = await getActor();
  if (!actor) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  return actor;
}

export async function pendingAccountId(): Promise<string | null> {
  if (realAuthEnabled()) return (await realPendingActor())?.accountId ?? null;
  return (await cookies()).get(PENDING_COOKIE)?.value ?? null;
}

/** Same origin admin paths only, so a crafted next parameter cannot send people elsewhere. */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string') return '/admin';
  return /^\/admin(\/[A-Za-z0-9._~\-/]*)?(\?[A-Za-z0-9._~\-=&%]*)?$/.test(value) &&
    !value.includes('//') &&
    !value.includes('..')
    ? value
    : '/admin';
}

export function allowed(actor: AdminActor, action: AdminAction): boolean {
  return can(actor.role, action);
}
