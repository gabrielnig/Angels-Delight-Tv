'use server';

import { revalidatePath } from 'next/cache';
import { accountService } from '@/lib/data/admin/services';
import { noticesAdmin } from '@/lib/data/admin/notices';
import { requireActionActor } from '@/lib/data/admin/session-next';

export async function updateNameAction(name: string) {
  const actor = await requireActionActor('/admin/account');
  const result = await accountService.updateName(actor, String(name));
  revalidatePath('/admin', 'layout');
  return result;
}

export async function changePasswordAction(
  current: string,
  next: string,
  confirm: string,
  code: string,
) {
  const actor = await requireActionActor('/admin/account');
  const result = await accountService.changePassword(
    actor,
    String(current),
    String(next),
    String(confirm),
    String(code),
  );
  revalidatePath('/admin/account');
  return result;
}

export async function revokeSessionAction(sessionId: string) {
  const actor = await requireActionActor('/admin/account');
  const result = await accountService.revokeSession(actor, String(sessionId));
  revalidatePath('/admin/account');
  return result;
}

export async function regenerateCodesAction(code: string) {
  const actor = await requireActionActor('/admin/account');
  const result = await accountService.regenerateCodes(actor, String(code).replace(/\s/g, ''));
  revalidatePath('/admin/account');
  return result;
}

const unavailable = { ok: false as const, field: 'code', error: 'This is not available here.' };

export async function sendConfirmCodeAction() {
  const actor = await requireActionActor('/admin/account');
  return (await accountService.sendConfirmCode?.(actor)) ?? unavailable;
}

export async function revokeTrustedDeviceAction(id: string) {
  const actor = await requireActionActor('/admin/account');
  const result = (await accountService.revokeTrustedDevice?.(actor, String(id))) ?? unavailable;
  revalidatePath('/admin/account');
  return result;
}

const clean = (value: string | undefined) => (value === undefined ? undefined : String(value).replace(/\s/g, ''));

export async function sendTestCodeAction() {
  const actor = await requireActionActor('/admin/account');
  return (await accountService.sendTestCode?.(actor)) ?? unavailable;
}

export async function confirmTestCodeAction(code: string) {
  const actor = await requireActionActor('/admin/account');
  const result =
    (await accountService.confirmTestCode?.(actor, clean(code) ?? '')) ?? unavailable;
  revalidatePath('/admin/account');
  return result;
}

export async function switchToEmailAction(input: {
  password?: string;
  code?: string;
  emailCode?: string;
}) {
  const actor = await requireActionActor('/admin/account');
  const result =
    (await accountService.switchToEmail?.(actor, {
      password: input.password === undefined ? undefined : String(input.password),
      code: clean(input.code),
      emailCode: clean(input.emailCode),
    })) ?? unavailable;
  revalidatePath('/admin/account');
  return result;
}

export async function beginAuthenticatorAction(password: string) {
  const actor = await requireActionActor('/admin/account');
  return (await accountService.beginAuthenticator?.(actor, String(password))) ?? unavailable;
}

export async function finishAuthenticatorAction(code: string) {
  const actor = await requireActionActor('/admin/account');
  const result =
    (await accountService.finishAuthenticator?.(actor, clean(code) ?? '')) ?? unavailable;
  revalidatePath('/admin/account');
  return result;
}

export async function saveNotificationPrefsAction(patch: {
  failures?: boolean;
  captionsReady?: boolean;
  dailySummary?: boolean;
  emailFrequency?: string;
}) {
  const actor = await requireActionActor('/admin/account');
  const result = await noticesAdmin.setPrefs(actor, {
    ...(typeof patch?.failures === 'boolean' ? { failures: patch.failures } : {}),
    ...(typeof patch?.captionsReady === 'boolean' ? { captionsReady: patch.captionsReady } : {}),
    ...(typeof patch?.dailySummary === 'boolean' ? { dailySummary: patch.dailySummary } : {}),
    ...(typeof patch?.emailFrequency === 'string'
      ? { emailFrequency: patch.emailFrequency as 'immediate' | 'hourly' | 'daily' }
      : {}),
  });
  revalidatePath('/admin/account');
  return result;
}
