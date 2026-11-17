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

export const inviteStaffAction = (email: string, role: string) =>
  run((a) => peopleService.invite(a, String(email), roleOf(role)));
export const resendInviteAction = (id: string) =>
  run((a) => peopleService.resendInvite(a, String(id)));
export const revokeInviteAction = (id: string) =>
  run((a) => peopleService.revokeInvite(a, String(id)));
export const changeRoleAction = (id: string, role: string) =>
  run((a) => peopleService.changeRole(a, String(id), roleOf(role)));
