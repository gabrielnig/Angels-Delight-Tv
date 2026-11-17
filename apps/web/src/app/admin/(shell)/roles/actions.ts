'use server';

import { revalidatePath } from 'next/cache';
import { peopleService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(fn: (a: Awaited<ReturnType<typeof requireActor>>) => Promise<CommandResult>) {
  const actor = await requireActor('/admin/roles');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

const roleOf = (role: string) => (role === 'admin' ? 'admin' : 'editor');

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
  const actor = await requireActor('/admin/roles');
  return peopleService.reauthenticate(actor, String(password));
}

export async function resetTwoFactorAction(id: string, code: string) {
  return run((a) => peopleService.resetTwoFactor(a, String(id), String(code).replace(/\s/g, '')));
}
