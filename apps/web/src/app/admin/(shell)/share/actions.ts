'use server';

import { revalidatePath } from 'next/cache';
import { adminDataMode } from '@/lib/data/admin/mode';
import { shareAdmin, type ShareKind } from '@/lib/data/admin/real/share';
import { requireActionActor } from '@/lib/data/admin/session-next';

const PAGE = { video: '/admin/videos', series: '/admin/series' } as const;

export async function saveShareTextAction(
  kind: ShareKind,
  id: string,
  input: { title: string; description: string },
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const actor = await requireActionActor(`${PAGE[kind]}/${id}/share`);
  if (adminDataMode() !== 'real') {
    return { ok: false, errors: { form: 'Saving share text needs the real database.' } };
  }
  const result = await shareAdmin.save(actor, kind, id, input);
  if (result.ok) {
    revalidatePath(`/title/[slug]`, 'page');
    revalidatePath(`/series/[slug]`, 'page');
  }
  return result;
}
