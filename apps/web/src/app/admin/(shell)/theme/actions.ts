'use server';

import { revalidatePath } from 'next/cache';
import { themeAdmin } from '@/lib/data/admin/theme';
import type { SaveInput } from '@/lib/data/admin/theme';
import type {
  ActionResult,
  HistoryDto,
  LogoDto,
  ThemeEditorDto,
  VersionDetailDto,
} from '@/lib/data/admin/theme-types';
import { requireActor } from '@/lib/data/admin/session-next';

export async function saveDraftAction(input: SaveInput): Promise<ActionResult<ThemeEditorDto>> {
  const actor = await requireActor('/admin/theme');
  const result = await themeAdmin.saveDraft(actor, input);
  if (result.ok) revalidatePath('/admin/theme');
  return result;
}

export async function publishAction(
  input: SaveInput & { acknowledgeWarnings?: boolean },
): Promise<ActionResult<ThemeEditorDto>> {
  const actor = await requireActor('/admin/theme');
  const result = await themeAdmin.publish(actor, input);
  if (result.ok) revalidatePath('/admin/theme');
  return result;
}

export async function resetAction(): Promise<ActionResult<ThemeEditorDto>> {
  const actor = await requireActor('/admin/theme');
  const result = await themeAdmin.reset(actor);
  if (result.ok) revalidatePath('/admin/theme');
  return result;
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult<LogoDto>> {
  const actor = await requireActor('/admin/theme');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose an image file.' };
  }
  if (file.size > 600 * 1024) {
    return { ok: false, message: 'The image is larger than 500 KB. Use a smaller file.' };
  }
  const alt = formData.get('altText');
  return themeAdmin.uploadLogo(
    actor,
    new Uint8Array(await file.arrayBuffer()),
    typeof alt === 'string' ? alt : null,
  );
}

export async function loadHistoryAction(options: {
  filter: 'all' | 'published' | 'draft';
  beforeVersion?: number;
}): Promise<ActionResult<HistoryDto>> {
  const actor = await requireActor('/admin/theme/history');
  return themeAdmin.history(actor, options);
}

export async function loadVersionAction(id: string): Promise<ActionResult<VersionDetailDto>> {
  const actor = await requireActor('/admin/theme/history');
  return themeAdmin.version(actor, id);
}

export async function restoreVersionAction(id: string): Promise<ActionResult<{ version: number }>> {
  const actor = await requireActor('/admin/theme/history');
  const result = await themeAdmin.restore(actor, id);
  if (result.ok) {
    revalidatePath('/admin/theme');
    revalidatePath('/admin/theme/history');
  }
  return result;
}
