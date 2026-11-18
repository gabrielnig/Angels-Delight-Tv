import { and, asc, eq, sql } from 'drizzle-orm';
import { categories, videoCategories, withAccount } from '@ad/db';
import { writeAudit } from '../audit';
import { Forbidden, isUuid, type Actor } from '@ad/shared';
import { rowsOf } from '../sql';
import type { Tx } from '../types';
import { OK, clean, fail, slugOf, type AdminContext, type CommandResult } from './types';

export interface AdminCategory {
  id: string;
  name: string;
  hidden: boolean;
  position: number;
  videoCount: number;
}

function assertStaff(actor: Actor): void {
  if (actor.role !== 'editor' && actor.role !== 'admin') throw new Forbidden('Editors only');
}

function nameProblem(name: string): string | null {
  if (!name) return 'Give the category a name.';
  if (name.length > 40) return 'Use 40 characters or fewer.';
  return null;
}

const NOT_FOUND = 'Category not found.';

export async function listAdminCategories(
  ctx: AdminContext,
  actor: Actor,
): Promise<AdminCategory[]> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const result = await tx.execute(sql`
      SELECT c.id, c.name::text AS name, c.is_visible, c.position,
        (SELECT count(*) FROM video_categories vc JOIN videos v ON v.id = vc.video_id
          WHERE vc.category_id = c.id AND v.deleted_at IS NULL) AS video_count
      FROM categories c ORDER BY c.position, c.created_at`);
    return rowsOf<{
      id: string;
      name: string;
      is_visible: boolean;
      position: number;
      video_count: string | number;
    }>(result).map((row, index) => ({
      id: row.id,
      name: row.name,
      hidden: !row.is_visible,
      position: index,
      videoCount: Number(row.video_count),
    }));
  });
}

async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugOf(name, 'category');
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [taken] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, candidate));
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function nameTaken(tx: Tx, name: string, exceptId?: string) {
  const [clash] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        sql`${categories.name} = ${name}::citext`,
        exceptId ? sql`${categories.id} <> ${exceptId}::uuid` : sql`true`,
      ),
    );
  return Boolean(clash);
}

async function audit(tx: Tx, actor: Actor, action: string, id: string | null, summary: string) {
  await writeAudit(tx, {
    action,
    outcome: 'success',
    actorAccountId: actor.accountId,
    actorRole: actor.role,
    targetType: 'category',
    targetId: id,
    summary,
  });
}

export async function createAdminCategory(
  ctx: AdminContext,
  actor: Actor,
  rawName: string,
): Promise<CommandResult> {
  assertStaff(actor);
  const name = clean(rawName);
  const problem = nameProblem(name);
  if (problem) return fail(problem);
  return withAccount(ctx.db, actor, async (tx) => {
    if (await nameTaken(tx, name)) return fail('A category with that name already exists.');
    const [{ next }] = rowsOf<{ next: number }>(
      await tx.execute(sql`SELECT coalesce(max(position) + 1, 0) AS next FROM categories`),
    ) as [{ next: number }];
    const [row] = await tx
      .insert(categories)
      .values({ name, slug: await uniqueSlug(tx, name), position: Number(next) })
      .returning({ id: categories.id });
    await audit(tx, actor, 'category.create', row!.id, `Created category ${name}`);
    return OK;
  });
}

export async function renameAdminCategory(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  rawName: string,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) return fail(NOT_FOUND);
  const name = clean(rawName);
  return withAccount(ctx.db, actor, async (tx) => {
    const [current] = await tx.select().from(categories).where(eq(categories.id, id));
    if (!current) return fail(NOT_FOUND);
    const problem = nameProblem(name);
    if (problem) return fail(problem);
    if (await nameTaken(tx, name, id)) return fail('A category with that name already exists.');
    await tx.update(categories).set({ name }).where(eq(categories.id, id));
    await audit(tx, actor, 'category.rename', id, `Renamed category ${current.name} to ${name}`);
    return OK;
  });
}

export async function setAdminCategoryHidden(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  hidden: boolean,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) return fail(NOT_FOUND);
  return withAccount(ctx.db, actor, async (tx) => {
    const [row] = await tx
      .update(categories)
      .set({ isVisible: !hidden })
      .where(eq(categories.id, id))
      .returning({ name: categories.name });
    if (!row) return fail(NOT_FOUND);
    await audit(
      tx,
      actor,
      hidden ? 'category.hide' : 'category.show',
      id,
      `${hidden ? 'Hid' : 'Showed'} category ${row.name}`,
    );
    return OK;
  });
}

async function renumber(tx: Tx) {
  const all = await tx
    .select({ id: categories.id })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.createdAt));
  for (const [index, row] of all.entries())
    await tx.update(categories).set({ position: index }).where(eq(categories.id, row.id));
  return all.map((row) => row.id);
}

export async function moveAdminCategory(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  delta: -1 | 1,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) return fail(NOT_FOUND);
  return withAccount(ctx.db, actor, async (tx) => {
    const order = await renumber(tx);
    const index = order.indexOf(id);
    if (index < 0) return fail(NOT_FOUND);
    const target = index + delta;
    if (target < 0 || target >= order.length) return OK;
    await tx.update(categories).set({ position: target }).where(eq(categories.id, id));
    await tx.update(categories).set({ position: index }).where(eq(categories.id, order[target]!));
    return OK;
  });
}

export async function deleteAdminCategory(
  ctx: AdminContext,
  actor: Actor,
  id: string,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) return fail(NOT_FOUND);
  return withAccount(ctx.db, actor, async (tx) => {
    const [current] = await tx.select().from(categories).where(eq(categories.id, id));
    if (!current) return fail(NOT_FOUND);
    const [{ count }] = rowsOf<{ count: string }>(
      await tx.execute(sql`
        SELECT count(*) AS count FROM video_categories vc JOIN videos v ON v.id = vc.video_id
        WHERE vc.category_id = ${id}::uuid AND v.deleted_at IS NULL`),
    ) as [{ count: string }];
    const used = Number(count);
    if (used > 0)
      return fail(
        `${used} ${used === 1 ? 'video uses' : 'videos use'} this category. Move them first, or hide the category instead.`,
      );
    // Trashed videos keep no stale link to a category that no longer exists.
    await tx.delete(videoCategories).where(eq(videoCategories.categoryId, id));
    await tx.delete(categories).where(eq(categories.id, id));
    await renumber(tx);
    await audit(tx, actor, 'category.delete', id, `Deleted category ${current.name}`);
    return OK;
  });
}
