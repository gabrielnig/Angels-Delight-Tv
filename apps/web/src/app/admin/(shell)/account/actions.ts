'use server';

import { revalidatePath } from 'next/cache';
import { accountService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';

export async function updateNameAction(name: string) {
  const actor = await requireActor('/admin/account');
  const result = await accountService.updateName(actor, String(name));
  revalidatePath('/admin', 'layout');
  return result;
}

export async function changePasswordAction(current: string, next: string, confirm: string) {
  const actor = await requireActor('/admin/account');
  const result = await accountService.changePassword(
    actor,
    String(current),
    String(next),
    String(confirm),
  );
  revalidatePath('/admin/account');
  return result;
}

export async function revokeSessionAction(sessionId: string) {
  const actor = await requireActor('/admin/account');
  const result = await accountService.revokeSession(actor, String(sessionId));
  revalidatePath('/admin/account');
  return result;
}

export async function regenerateCodesAction(password: string) {
  const actor = await requireActor('/admin/account');
  const result = await accountService.regenerateCodes(actor, String(password));
  revalidatePath('/admin/account');
  return result;
}
