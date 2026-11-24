'use server';

import { revalidatePath } from 'next/cache';
import { ValidationFailed } from '@ad/shared';
import { markersAdmin, type MarkerPayload } from '@/lib/data/admin/markers';
import { requireActionActor } from '@/lib/data/admin/session-next';

/** Saves skip markers and chapters. They apply to the published video at once, with no republish (D-200). */
export async function saveMarkersAction(
  videoId: string,
  payload: MarkerPayload,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const actor = await requireActionActor(`/admin/videos/${videoId}/markers`);
  try {
    await markersAdmin.save(actor, videoId, payload);
  } catch (error) {
    if (error instanceof ValidationFailed) {
      return {
        ok: false,
        errors: Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k, v[0] ?? ''])),
      };
    }
    throw error;
  }
  revalidatePath('/admin', 'layout');
  revalidatePath('/admin');
  revalidatePath(`/watch/${videoId}`);
  return { ok: true };
}
