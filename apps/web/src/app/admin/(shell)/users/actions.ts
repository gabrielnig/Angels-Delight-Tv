'use server';

import { revalidatePath } from 'next/cache';
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
