'use server';

import { revalidatePath } from 'next/cache';
import { Forbidden } from '@ad/shared';
import { MAX_BULK_CALL, newBulkId, type BulkOutcome, type BulkUndo } from '@/lib/data/admin/bulk';
import { MAX_USER_BULK, type UserBulkAction } from '@/lib/data/admin/user-bulk';
import { auditBulkRun } from '@/server/admin/bulk-run';
import { peopleService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(
  fn: (a: Awaited<ReturnType<typeof requireActionActor>>) => Promise<CommandResult>,
) {
  const actor = await requireActionActor('/admin/users');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function suspendUserAction(id: string, reason: string) {
  return run((a) => peopleService.suspend(a, String(id), String(reason)));
}

export async function reinstateUserAction(id: string) {
  return run((a) => peopleService.reinstate(a, String(id)));
}

export async function revokeSessionsAction(id: string, reason: string) {
  return run((a) => peopleService.revokeSessions(a, String(id), String(reason)));
}

export async function resetTwoFactorForUserAction(id: string, reason: string) {
  return run((a) => peopleService.resetViewerTwoFactor(a, String(id), String(reason)));
}

export async function deleteUserAccountAction(id: string, confirmation: string) {
  return run((a) => peopleService.deleteAccount(a, String(id), String(confirmation)));
}

/** Suspend, reinstate or force sign out for many viewer accounts. Admin only. At most 50 per call. */
export async function bulkUsersAction(
  ids: string[],
  action: UserBulkAction,
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/users');
  const used = ids.slice(0, Math.min(MAX_BULK_CALL, MAX_USER_BULK + 1));
  const who = { accountId: actor.accountId, role: actor.role };
  let outcome: BulkOutcome;
  try {
    outcome = await peopleService.bulkUsers(actor, used, action, bulkId);
  } catch (error) {
    // A forged call from a role below admin is refused and recorded.
    if (error instanceof Forbidden)
      await auditBulkRun(who, {
        action: `user.bulk_${action.type}`,
        label: 'Bulk account action',
        targetType: 'user',
        bulkId,
        ids: used,
        denied: true,
      });
    throw error;
  }
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    {
      action: `user.bulk_${action.type}`,
      label: action.type === 'suspend' ? 'Suspend accounts' : action.type === 'reinstate' ? 'Reinstate accounts' : 'Force sign out',
      targetType: 'user',
      bulkId,
      ids: used,
      outcome,
      ...(action.type !== 'reinstate' ? { reason: action.reason.trim().slice(0, 200) } : {}),
    },
  );
  revalidatePath('/admin', 'layout');
  return outcome;
}

export async function undoBulkUsersAction(undo: BulkUndo) {
  const actor = await requireActionActor('/admin/users');
  const result = await peopleService.undoUsers(actor, undo);
  revalidatePath('/admin', 'layout');
  return result;
}
