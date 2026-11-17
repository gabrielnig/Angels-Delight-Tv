import 'server-only';
import { TokenRejected } from '@ad/auth';
import { cache } from 'react';
import type { AdminActor } from '@/lib/data/admin/types';
import { classifyCode } from './admin-code';
import { type FormState, toFormState } from './form-errors';
import { adminRuntime, titleCaseFromEmail } from '@/server/admin/runtime';
import { authRuntime } from './runtime';
import {
  clearSessionCookie,
  getSession,
  readSessionToken,
  requestMeta,
  setSessionCookie,
} from './session';

const STAFF = new Set(['editor', 'admin']);

async function currentStaff() {
  const session = await getSession();
  if (!session || session.status !== 'active' || !STAFF.has(session.role)) return null;
  return session;
}

const nameFor = cache(async (accountId: string, role: 'editor' | 'admin', sessionId: string) => {
  const chosen = (await adminRuntime().names({ accountId, role }, [accountId])).get(accountId);
  if (chosen) return chosen;
  const info = await authRuntime().staff.getOverview({ accountId, role, sessionId });
  return titleCaseFromEmail(info.email);
});

/** The signed in staff member whose session passed the second factor, or null. */
export async function realAdminActor(): Promise<AdminActor | null> {
  const session = await currentStaff();
  if (!session?.mfaVerified) return null;
  const role = session.role as 'editor' | 'admin';
  return {
    accountId: session.accountId,
    role,
    name: await nameFor(session.accountId, role, session.sessionId),
    sessionId: session.sessionId,
  };
}

/** A staff session that is waiting for its second factor. */
export async function realPendingActor() {
  const session = await currentStaff();
  if (!session || session.mfaVerified) return null;
  return {
    accountId: session.accountId,
    role: session.role as 'editor' | 'admin',
    sessionId: session.sessionId,
  };
}

export async function realAdminSignIn(
  email: string,
  password: string,
): Promise<FormState & { ok?: true }> {
  try {
    const result = await authRuntime().staff.adminSignIn({ email, password }, await requestMeta());
    await setSessionCookie(
      result.session.token,
      result.status === 'signed_in' ? 'staff' : 'pending_mfa',
    );
    return { ok: true };
  } catch (error) {
    const state = toFormState(error);
    return state.error
      ? { error: state.error, retryAfter: state.retryAfter }
      : { error: 'Email or password is not right. Check both and try again.' };
  }
}

export async function realSubmitCode(
  input: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await realPendingActor();
  if (!actor) return { ok: false, error: 'Your sign in expired. Sign in again.' };
  const parsed = classifyCode(input);
  if (parsed.kind === 'invalid')
    return { ok: false, error: 'Enter the 6 digit code from your app, or a recovery code.' };
  try {
    const staff = authRuntime().staff;
    const meta = await requestMeta();
    const result =
      parsed.kind === 'totp'
        ? await staff.verifyMfa(actor, { code: parsed.code }, meta)
        : await staff.verifyRecoveryCode(actor, { code: parsed.code }, meta);
    await setSessionCookie(result.session.token, 'staff');
    return { ok: true };
  } catch (error) {
    const state = toFormState(error);
    if (state.fields?.code)
      return { ok: false, error: 'That code is not right. Wait for the next code and try again.' };
    return { ok: false, error: state.error ?? 'That code is not right.' };
  }
}

export async function realTwoFactorState(): Promise<'none' | 'enrolled' | 'signed_out'> {
  const actor = await realPendingActor();
  if (!actor) return 'signed_out';
  return (await authRuntime().staff.twoFactorConfirmed(actor)) ? 'enrolled' : 'none';
}

export async function realBeginEnrolment() {
  const actor = await realPendingActor();
  if (!actor) return null;
  return authRuntime().staff.beginEnrolment(actor, await requestMeta());
}

export async function realConfirmEnrolment(code: string) {
  const actor = await realPendingActor();
  if (!actor) return { ok: false as const, error: 'Your sign in expired. Sign in again.' };
  try {
    const result = await authRuntime().staff.confirmEnrolment(
      actor,
      { code: code.replace(/\s/g, '') },
      await requestMeta(),
    );
    await setSessionCookie(result.session.token, 'staff');
    return { ok: true as const, recoveryCodes: result.recoveryCodes };
  } catch (error) {
    const state = toFormState(error);
    return {
      ok: false as const,
      error: state.fields?.code
        ? 'That code is not right. Wait for the next code and try again.'
        : (state.error ?? 'Could not confirm the code.'),
    };
  }
}

export async function realAdminSignOut(): Promise<void> {
  const token = await readSessionToken();
  if (token) await authRuntime().staff.signOut(token, await requestMeta());
  await clearSessionCookie();
}

export async function realInspectInvite(token: string) {
  try {
    return await authRuntime().staff.inspectInvite(token);
  } catch (error) {
    if (error instanceof TokenRejected) return null;
    throw error;
  }
}

export async function realAcceptInvite(
  token: string,
  password: string,
): Promise<FormState & { ok?: true }> {
  try {
    const result = await authRuntime().staff.acceptInvite({ token, password }, await requestMeta());
    await setSessionCookie(result.session.token, 'pending_mfa');
    return { ok: true };
  } catch (error) {
    return toFormState(error);
  }
}
