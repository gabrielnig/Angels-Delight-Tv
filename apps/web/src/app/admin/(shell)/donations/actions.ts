'use server';

import { revalidatePath } from 'next/cache';
import { AppError, ValidationFailed } from '@ad/shared';
import { requireActionActor } from '@/lib/data/admin/session-next';
import { donationAdmin } from '@/server/donations/admin';

export type DonationActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fields?: Record<string, string[]> };

async function guarded<T extends object>(fn: (actor: Awaited<ReturnType<typeof requireActionActor>>) => Promise<T>): Promise<DonationActionResult<T>> {
  const actor = await requireActionActor('/admin/donations');
  try {
    return { ok: true, ...(await fn(actor)) };
  } catch (error) {
    if (error instanceof ValidationFailed) return { ok: false, error: error.message, fields: error.fields };
    if (error instanceof AppError) return { ok: false, error: error.message };
    return { ok: false, error: 'Something went wrong on our side. Nothing was changed. Try again.' };
  }
}

/** Shows one full address. The service writes the audit row, which never holds the address. */
export const revealDonorEmailAction = (id: string) =>
  guarded(async (a) => ({ email: await donationAdmin(a).revealEmail(a, String(id)) }));

export const resolveReviewAction = (id: string, accept: boolean, note: string) =>
  guarded(async (a) => {
    await donationAdmin(a).resolveReview(a, String(id), Boolean(accept), String(note));
    revalidatePath('/admin/donations', 'layout');
    return {};
  });
