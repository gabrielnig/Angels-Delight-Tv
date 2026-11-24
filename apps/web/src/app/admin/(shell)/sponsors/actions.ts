'use server';

import { revalidatePath } from 'next/cache';
import { AppError, ValidationFailed, type SponsorStoredStatus } from '@ad/shared';
import type { CreativeInput, SponsorForm } from '@ad/sponsors';
import { requireActionActor } from '@/lib/data/admin/session-next';
import { sponsorAdmin, uploadSponsorImage } from '@/server/sponsors/admin';
import type { SponsorImageKind } from '@/lib/admin/sponsor-image';

export type SponsorActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fields?: Record<string, string[]> };

type CreativeBody = CreativeInput & {
  imageSquareAssetId?: string | null;
  imageWideAssetId?: string | null;
  active?: boolean;
};

async function guarded<T extends object>(
  fn: (actor: Awaited<ReturnType<typeof requireActionActor>>) => Promise<T>,
): Promise<SponsorActionResult<T>> {
  const actor = await requireActionActor('/admin/sponsors');
  try {
    const data = await fn(actor);
    revalidatePath('/admin/sponsors', 'layout');
    return { ok: true, ...data };
  } catch (error) {
    if (error instanceof ValidationFailed) {
      return { ok: false, error: error.message, fields: error.fields };
    }
    if (error instanceof AppError) return { ok: false, error: error.message };
    return { ok: false, error: 'Something went wrong on our side. Nothing was changed. Try again.' };
  }
}

export const createSponsorAction = async (form: SponsorForm) =>
  guarded((a) => sponsorAdmin(a).create(a, form));

export const updateSponsorAction = async (id: string, form: SponsorForm) =>
  guarded(async (a) => {
    await sponsorAdmin(a).update(a, String(id), form);
    return {};
  });

export const setSponsorStatusAction = async (id: string, status: SponsorStoredStatus) =>
  guarded(async (a) => {
    await sponsorAdmin(a).setStatus(a, String(id), status);
    return {};
  });

// The service returns its own { ok } result, which overrides the wrapper's ok when it is false.
export const deleteSponsorAction = async (id: string) =>
  guarded((a) => sponsorAdmin(a).remove(a, String(id)));

export const addCreativeAction = async (sponsorId: string, input: CreativeBody, slots: string[]) =>
  guarded((a) => sponsorAdmin(a).addCreative(a, String(sponsorId), input, slots));

export const updateCreativeAction = async (creativeId: string, input: CreativeBody, slots: string[]) =>
  guarded((a) => sponsorAdmin(a).updateCreative(a, String(creativeId), input, slots));

export const removeCreativeAction = async (creativeId: string) =>
  guarded(async (a) => {
    await sponsorAdmin(a).removeCreative(a, String(creativeId));
    return {};
  });

export const setMasterSwitchAction = async (on: boolean, password: string) =>
  guarded((a) => sponsorAdmin(a).setMasterSwitch(a, Boolean(on), password));

export async function uploadSponsorImageAction(
  formData: FormData,
): Promise<SponsorActionResult<{ assetId: string }>> {
  const actor = await requireActionActor('/admin/sponsors');
  const file = formData.get('file');
  const kind: SponsorImageKind = formData.get('kind') === 'wide' ? 'wide' : 'square';
  if (!(file instanceof File)) return { ok: false, error: 'Choose a picture to upload.' };
  const result = await uploadSponsorImage(actor, new Uint8Array(await file.arrayBuffer()), kind);
  return result.ok ? { ok: true, assetId: result.assetId } : { ok: false, error: result.error };
}
