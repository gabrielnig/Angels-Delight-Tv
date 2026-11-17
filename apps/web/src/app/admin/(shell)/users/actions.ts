'use server';

import { revalidatePath } from 'next/cache';
import { peopleService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(fn: (a: Awaited<ReturnType<typeof requireActor>>) => Promise<CommandResult>) {
  const actor = await requireActor('/admin/users');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

export const suspendUserAction = (id: string, reason: string) =>
  run((a) => peopleService.suspend(a, String(id), String(reason)));
export const reinstateUserAction = (id: string) =>
  run((a) => peopleService.reinstate(a, String(id)));
export const revokeSessionsAction = (id: string, reason: string) =>
  run((a) => peopleService.revokeSessions(a, String(id), String(reason)));
