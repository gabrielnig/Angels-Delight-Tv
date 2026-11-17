'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PENDING_COOKIE, SESSION_COOKIE, fixtureAuthEnabled } from '@/lib/data/admin/session';
import {
  cookieOptions,
  fixtureAuth,
  pendingAccountId,
  safeNext,
} from '@/lib/data/admin/session-next';

export interface LoginState {
  error?: string;
  locked?: boolean;
  email?: string;
}

export async function signInAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));
  if (!fixtureAuthEnabled())
    return { email, error: 'Sign in is not available right now. Try again later.' };
  if (!email || !password) return { email, error: 'Enter your email and password.' };

  const result = fixtureAuth().checkPassword(email, password);
  if (!result.ok) {
    return result.reason === 'locked'
      ? {
          email,
          locked: true,
          error: `Too many attempts. Try again in ${result.retryInMinutes} minutes.`,
        }
      : { email, error: 'Email or password is not right. Check both and try again.' };
  }
  (await cookies()).set(PENDING_COOKIE, result.actor.accountId, { ...cookieOptions, maxAge: 600 });
  redirect(`/admin/login/2fa?next=${encodeURIComponent(next)}`);
}

export interface CodeState {
  error?: string;
}

export async function verifyCodeAction(_prev: CodeState, form: FormData): Promise<CodeState> {
  const accountId = await pendingAccountId();
  const next = safeNext(form.get('next'));
  if (!accountId) redirect('/admin/login?expired=1');
  const code = String(form.get('code') ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6 digit code from your app.' };
  const result = fixtureAuth().checkCode(accountId, code);
  if (!result.ok) {
    return {
      error:
        result.triesLeft > 0
          ? `That code is not right. Wait for the next code and try again. ${result.triesLeft} tries left.`
          : 'Too many wrong codes. Sign in again.',
    };
  }
  const jar = await cookies();
  jar.delete({ name: PENDING_COOKIE, path: '/admin' });
  jar.set(SESSION_COOKIE, accountId, { ...cookieOptions, maxAge: 60 * 30 });
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: '/admin' });
  redirect('/admin/login');
}
