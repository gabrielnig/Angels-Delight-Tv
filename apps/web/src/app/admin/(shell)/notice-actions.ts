'use server';

import { revalidatePath } from 'next/cache';
import { noticesAdmin } from '@/lib/data/admin/notices';
import { requireActionActor } from '@/lib/data/admin/session-next';

export async function markNoticesReadAction(): Promise<void> {
  const actor = await requireActionActor('/admin');
  await noticesAdmin.markAllRead(actor);
  revalidatePath('/admin', 'layout');
}
