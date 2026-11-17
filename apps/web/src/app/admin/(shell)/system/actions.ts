'use server';

import { revalidatePath } from 'next/cache';
import { systemService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';

export async function retryJobAction(id: string) {
  const actor = await requireActionActor('/admin/system');
  const result = await systemService.retryJob(actor, String(id));
  revalidatePath('/admin/system');
  return result;
}

export async function discardJobAction(id: string, reason: string) {
  const actor = await requireActionActor('/admin/system');
  const result = await systemService.discardJob(actor, String(id), String(reason));
  revalidatePath('/admin/system');
  return result;
}
