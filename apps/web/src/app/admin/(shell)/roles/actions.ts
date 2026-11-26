'use server';

import { revalidatePath } from 'next/cache';
import { Forbidden } from '@ad/shared';
import { MAX_BULK_CALL, newBulkId, type BulkOutcome } from '@/lib/data/admin/bulk';
import type { StaffBulkAction } from '@/lib/data/admin/staff-bulk';
import { auditBulkRun } from '@/server/admin/bulk-run';
import { peopleService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(
  fn: (a: Awaited<ReturnType<typeof requireActionActor>>) => Promise<CommandResult>,
) {
  const actor = await requireActionActor('/admin/roles');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

const roleOf = (role: string) =>
  role === 'super_admin' ? 'super_admin' : role === 'admin' ? 'admin' : 'editor';

export async function inviteStaffAction(email: string, role: string) {
  return run((a) => peopleService.invite(a, String(email), roleOf(role)));
}

export async function resendInviteAction(id: string) {
  return run((a) => peopleService.resendInvite(a, String(id)));
}

export async function revokeInviteAction(id: string) {
  return run((a) => peopleService.revokeInvite(a, String(id)));
}

export async function changeRoleAction(id: string, role: string) {
  return run((a) => peopleService.changeRole(a, String(id), roleOf(role)));
}

export async function reauthenticateAction(password: string) {
  const actor = await requireActionActor('/admin/roles');
  return peopleService.reauthenticate(actor, String(password));
}

export async function sendReauthCodeAction() {
  const actor = await requireActionActor('/admin/roles');
  return (
    (await peopleService.sendReauthCode?.(actor)) ?? { ok: false as const, error: 'Not available here.' }
  );
}

export async function reauthenticateWithCodeAction(code: string) {
  const actor = await requireActionActor('/admin/roles');
  return (
    (await peopleService.reauthenticateWithCode?.(actor, String(code).replace(/\s/g, ''))) ?? {
      ok: false as const,
      error: 'Not available here.',
    }
  );
}

export async function resetTwoFactorAction(id: string, code: string) {
  return run((a) => peopleService.resetTwoFactor(a, String(id), String(code).replace(/\s/g, '')));
}

export async function bulkPreflightAction() {
  const actor = await requireActionActor('/admin/roles');
  return peopleService.bulkPreflight(actor);
}

/** Role change (Editor and Admin only) or invite resend for many people. Super admin only. */
export async function bulkStaffAction(
  ids: string[],
  action: StaffBulkAction,
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/roles');
  const used = ids.slice(0, MAX_BULK_CALL);
  const who = { accountId: actor.accountId, role: actor.role };
  const label = action.type === 'role' ? 'Change roles' : 'Resend invites';
  const itemAction = action.type === 'role' ? 'staff.bulk_role' : 'staff.bulk_resend_invites';
  let outcome: BulkOutcome;
  try {
    outcome = await peopleService.bulkStaff(actor, used, action, bulkId);
  } catch (error) {
    // A forged call from a role below Super admin is refused and recorded.
    if (error instanceof Forbidden)
      await auditBulkRun(who, {
        action: itemAction,
        label,
        targetType: 'staff',
        bulkId,
        ids: used,
        denied: true,
      });
    throw error;
  }
  await auditBulkRun(who, {
    action: itemAction,
    label,
    targetType: action.type === 'role' ? 'staff' : 'invite',
    bulkId,
    ids: used,
    outcome,
    ...(action.type === 'role' ? { reason: `New role: ${action.role}` } : {}),
  });
  revalidatePath('/admin', 'layout');
  return outcome;
}
