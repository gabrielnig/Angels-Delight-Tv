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
