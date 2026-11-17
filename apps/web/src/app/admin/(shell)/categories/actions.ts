'use server';

import { revalidatePath } from 'next/cache';
import { collectionService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(
  fn: (actor: Awaited<ReturnType<typeof requireActor>>) => Promise<CommandResult>,
) {
  const actor = await requireActor('/admin/categories');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

export const createCategoryAction = (name: string) =>
  run((a) => collectionService.createCategory(a, String(name)));
export const renameCategoryAction = (id: string, name: string) =>
  run((a) => collectionService.renameCategory(a, String(id), String(name)));
export const hideCategoryAction = (id: string, hidden: boolean) =>
  run((a) => collectionService.setCategoryHidden(a, String(id), Boolean(hidden)));
export const moveCategoryAction = (id: string, delta: -1 | 1) =>
  run((a) => collectionService.moveCategory(a, String(id), delta === -1 ? -1 : 1));
export const deleteCategoryAction = (id: string) =>
  run((a) => collectionService.deleteCategory(a, String(id)));
