import { and, eq, sql } from 'drizzle-orm';
import { series, videos, withAccount } from '@ad/db';
import { Forbidden, NotFound, ValidationFailed, isStaffRole, isUuid, type Actor } from '@ad/shared';
import { writeAudit } from '../audit';
import type { AdminContext } from './types';

/** Limits and rules match `apps/web/src/lib/seo/share-overrides.ts`, which the admin form uses for instant messages. */
export const SHARE_TITLE_MAX = 90;
export const SHARE_DESCRIPTION_MAX = 200;
const HIDDEN = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]');

export interface ShareText {
  title: string | null;
  description: string | null;
}

function clean(raw: string | undefined, max: number, label: string, field: string): string | null | undefined {
  if (raw === undefined) return undefined;
  const text = raw.trim();
  if (HIDDEN.test(text) || /[<>]/.test(text)) {
    throw new ValidationFailed({ [field]: [`Remove hidden characters and the < and > signs from the ${label}.`] });
  }
  if (text.length > max) throw new ValidationFailed({ [field]: [`Keep the ${label} to ${max} characters or fewer.`] });
  return text === '' ? null : text;
}

function assertStaff(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Editors only');
}

/** The editor's share words for a title, null where the card follows the title or description. */
export async function getShareText(
  ctx: AdminContext,
  actor: Actor,
  kind: 'video' | 'series',
  id: string,
): Promise<ShareText> {
  assertStaff(actor);
  if (!isUuid(id)) throw new NotFound('Title not found');
  return withAccount(ctx.db, actor, async (tx) => {
    const table = kind === 'video' ? videos : series;
    const [row] = await tx
      .select({ title: table.shareTitle, description: table.shareDescription })
      .from(table)
      .where(and(eq(table.id, id), sql`${table.deletedAt} IS NULL`));
    if (!row) throw new NotFound('Title not found');
    return { title: row.title, description: row.description };
  });
}

/** Saves the share title and description (empty text clears them) and audits the change with the field names only. */
export async function setShareText(
  ctx: AdminContext,
  actor: Actor,
  kind: 'video' | 'series',
  id: string,
  input: { title?: string; description?: string },
): Promise<void> {
  assertStaff(actor);
  if (!isUuid(id)) throw new NotFound('Title not found');
  const shareTitle = clean(input.title, SHARE_TITLE_MAX, 'share title', 'title');
  const shareDescription = clean(input.description, SHARE_DESCRIPTION_MAX, 'share description', 'description');
  await withAccount(ctx.db, actor, async (tx) => {
    const table = kind === 'video' ? videos : series;
    const set: { shareTitle?: string | null; shareDescription?: string | null } = {};
    if (shareTitle !== undefined) set.shareTitle = shareTitle;
    if (shareDescription !== undefined) set.shareDescription = shareDescription;
    const [current] = await tx
      .select({ title: table.title })
      .from(table)
      .where(and(eq(table.id, id), sql`${table.deletedAt} IS NULL`))
      .for('update');
    if (!current) throw new NotFound('Title not found');
    if (Object.keys(set).length) await tx.update(table).set(set).where(eq(table.id, id));
    await writeAudit(tx, {
      action: `${kind}.share_text`,
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: kind,
      targetId: id,
      summary: `Changed the share card words of ${current.title}`,
      extra: { fields: Object.keys(set) },
    });
  });
}
