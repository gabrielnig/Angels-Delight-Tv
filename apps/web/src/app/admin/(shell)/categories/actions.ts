'use server';

import { revalidatePath } from 'next/cache';
import { collectionService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(
  fn: (actor: Awaited<ReturnType<typeof requireActionActor>>) => Promise<CommandResult>,
) {
  const actor = await requireActionActor('/admin/categories');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function createCategoryAction(name: string) {
  return run((a) => collectionService.createCategory(a, String(name)));
}

export async function renameCategoryAction(id: string, name: string) {
  return run((a) => collectionService.renameCategory(a, String(id), String(name)));
}

export async function hideCategoryAction(id: string, hidden: boolean) {
  return run((a) => collectionService.setCategoryHidden(a, String(id), Boolean(hidden)));
}

export async function moveCategoryAction(id: string, delta: -1 | 1) {
  return run((a) => collectionService.moveCategory(a, String(id), delta === -1 ? -1 : 1));
}

export async function deleteCategoryAction(id: string) {
  return run((a) => collectionService.deleteCategory(a, String(id)));
}
