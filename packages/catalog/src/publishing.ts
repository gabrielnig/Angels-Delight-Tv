import { and, eq, lte, sql } from 'drizzle-orm';
import { series, videos, withAccount, type Database } from '@ad/db';
import { writeAudit } from '@ad/audit';
import { Conflict, Forbidden, NotFound, isUuid, ValidationFailed, type Actor } from '@ad/shared';
import { rowsOf } from './sql';
import type { Tx } from './types';

/** Context for the editor side of publishing. Settings (M29) feed `requireApprovedCaptions`. */
export interface PublishingContext {
  db: Database;
  now?: () => Date;
  /** `features.require_approved_captions`. Default true (D-005). */
  requireApprovedCaptions?: boolean;
}

export type ChecklistKey =
  'encoding' | 'title' | 'description' | 'poster' | 'category' | 'captions';

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  ok: boolean;
}

export interface PublishChecklist {
  ok: boolean;
  items: ChecklistItem[];
}

export type PublishTarget = 'video' | 'series';

export interface PublishResult {
  id: string;
  publishState: 'draft' | 'scheduled' | 'published' | 'unpublished';
  publishAt: string | null;
  publishedAt: string | null;
}

export interface PublishInput {
  /** A future time schedules the release. Absent publishes now. */
  publishAt?: Date;
  /** Admin only. Lets a video go live without approved captions, with a reason that is audited (D-005). */
  captionOverride?: { reason: string };
}

const MIN_OVERRIDE_REASON = 5;

const LABELS: Record<ChecklistKey, string> = {
  encoding: 'Encoding is finished',
  title: 'Add a title',
  description: 'Add a description',
  poster: 'Choose a poster',
  category: 'Put it in at least one category',
  captions: 'Approve captions',
};

function assertStaff(actor: Actor): void {
  if (actor.role !== 'editor' && actor.role !== 'admin') throw new Forbidden('Editors only');
}

function resultOf(row: {
  id: string;
  publishState: PublishResult['publishState'];
  publishAt: Date | null;
  publishedAt: Date | null;
}): PublishResult {
  return {
    id: row.id,
    publishState: row.publishState,
    publishAt: row.publishAt ? row.publishAt.toISOString() : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

/** The server side publish gate (M28-S05). The UI lists the same items, but this is the one that decides. */
export async function evaluateChecklist(
  tx: Tx,
  target: PublishTarget,
  id: string,
  options: { requireApprovedCaptions: boolean },
): Promise<PublishChecklist> {
  const result =
    target === 'video'
      ? await tx.execute(sql`
          SELECT (v.status = 'ready') AS encoding, char_length(btrim(v.title)) > 0 AS title,
            char_length(btrim(coalesce(v.description, ''))) > 0 AS description,
            EXISTS (SELECT 1 FROM assets a WHERE a.id = v.poster_asset_id AND a.status = 'ready') AS poster,
            EXISTS (SELECT 1 FROM video_categories vc WHERE vc.video_id = v.id) AS category,
            EXISTS (SELECT 1 FROM caption_tracks ct WHERE ct.video_id = v.id AND ct.approved_caption_id IS NOT NULL) AS captions
          FROM videos v WHERE v.id = ${id}::uuid`)
      : await tx.execute(sql`
          SELECT true AS encoding, char_length(btrim(s.title)) > 0 AS title,
            char_length(btrim(coalesce(s.description, ''))) > 0 AS description,
            EXISTS (SELECT 1 FROM assets a WHERE a.id = s.poster_asset_id AND a.status = 'ready') AS poster,
            EXISTS (SELECT 1 FROM series_categories sc WHERE sc.series_id = s.id) AS category,
            true AS captions
          FROM series s WHERE s.id = ${id}::uuid`);
  const row = rowsOf<Record<ChecklistKey, boolean>>(result)[0];
  if (!row) throw new NotFound('Not found');
  const keys: ChecklistKey[] =
    target === 'video'
      ? ['encoding', 'title', 'description', 'poster', 'category', 'captions']
      : ['title', 'description', 'poster', 'category'];
  const items = keys.map((key) => ({
    key,
    label: LABELS[key],
    ok: key === 'captions' && !options.requireApprovedCaptions ? true : row[key] === true,
  }));
  return { ok: items.every((item) => item.ok), items };
}

function failures(checklist: PublishChecklist): Record<string, string[]> {
  return { checklist: checklist.items.filter((item) => !item.ok).map((item) => item.label) };
}

async function lockTarget(tx: Tx, target: PublishTarget, id: string) {
  if (!isUuid(id)) throw new NotFound('Not found');
  const table = target === 'video' ? videos : series;
  const [row] = await tx
    .select()
    .from(table)
    .where(and(eq(table.id, id), sql`${table.deletedAt} IS NULL`))
    .for('update');
  if (!row) throw new NotFound('Not found');
  return row;
}

async function applyState(
  tx: Tx,
  target: PublishTarget,
  id: string,
  values: {
    publishState: PublishResult['publishState'];
    publishAt: Date | null;
    publishedAt?: Date;
  },
): Promise<PublishResult> {
  const table = target === 'video' ? videos : series;
  const [row] = await tx.update(table).set(values).where(eq(table.id, id)).returning();
  return resultOf(row!);
}

/**
 * Publishes now, or schedules when `publishAt` is in the future (M28-S01, S02, S04). Republishing keeps the
 * original publish date (M28-S03). Fails with the list of missing items when the checklist is not met.
 */
export async function publish(
  ctx: PublishingContext,
  actor: Actor,
  target: PublishTarget,
  id: string,
  input: PublishInput = {},
): Promise<PublishResult> {
  assertStaff(actor);
  const now = (ctx.now ?? (() => new Date()))();
  if (input.publishAt && input.publishAt.getTime() <= now.getTime()) {
    throw new ValidationFailed({ publishAt: ['Pick a time in the future'] });
  }
  const override = input.captionOverride;
  if (override) {
    if (actor.role !== 'admin') throw new Forbidden('Only an admin can override captions');
    if (override.reason.trim().length < MIN_OVERRIDE_REASON) {
      throw new ValidationFailed({ captionOverride: ['Give a reason for the override'] });
    }
  }

  return withAccount(ctx.db, actor, async (tx) => {
    const current = await lockTarget(tx, target, id);
    const checklist = await evaluateChecklist(tx, target, id, {
      requireApprovedCaptions: (ctx.requireApprovedCaptions ?? true) && !override,
    });
    if (!checklist.ok) throw new ValidationFailed(failures(checklist));

    const scheduling = input.publishAt !== undefined;
    if (!scheduling && current.publishState === 'published') return resultOf(current);
    const result = await applyState(tx, target, id, {
      publishState: scheduling ? 'scheduled' : 'published',
      publishAt: scheduling ? input.publishAt! : null,
      publishedAt: scheduling ? undefined : (current.publishedAt ?? now),
    });
    if (override && target === 'video')
      await tx
        .update(videos)
        .set({ captionOverrideReason: override.reason.trim() })
        .where(eq(videos.id, id));
    await writeAudit(tx, {
      action: `${target}.${scheduling ? 'schedule' : 'publish'}`,
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: target,
      targetId: id,
      summary: `${scheduling ? 'Scheduled' : 'Published'} ${current.title}`,
      extra: {
        ...(scheduling ? { publishAt: input.publishAt!.toISOString() } : {}),
        ...(override ? { captionOverrideReason: override.reason.trim() } : {}),
      },
    });
    return result;
  });
}

/** Hides a published or scheduled title. Viewer progress and lists are kept (M28-S03). */
export async function unpublish(
  ctx: PublishingContext,
  actor: Actor,
  target: PublishTarget,
  id: string,
): Promise<PublishResult> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const current = await lockTarget(tx, target, id);
    if (current.publishState !== 'published' && current.publishState !== 'scheduled') {
      throw new Conflict('Only a published or scheduled title can be unpublished');
    }
    const result = await applyState(tx, target, id, {
      publishState: 'unpublished',
      publishAt: null,
    });
    await writeAudit(tx, {
      action: `${target}.unpublish`,
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: target,
      targetId: id,
      summary: `Unpublished ${current.title}`,
    });
    return result;
  });
}

/** Cancels a schedule and returns the title to draft, ready to publish again (M28-S04). */
export async function cancelSchedule(
  ctx: PublishingContext,
  actor: Actor,
  target: PublishTarget,
  id: string,
): Promise<PublishResult> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const current = await lockTarget(tx, target, id);
    if (current.publishState !== 'scheduled') throw new Conflict('Nothing is scheduled');
    const result = await applyState(tx, target, id, { publishState: 'draft', publishAt: null });
    await writeAudit(tx, {
      action: `${target}.schedule.cancel`,
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: target,
      targetId: id,
      summary: `Cancelled the schedule for ${current.title}`,
    });
    return result;
  });
}

export interface PromotionReport {
  published: { target: PublishTarget; id: string }[];
  /** Due items that no longer pass the checklist. They are taken back to draft so they never go live. */
  blocked: { target: PublishTarget; id: string; reasons: string[] }[];
}

/**
 * The scheduler tick (M30). Promotes every scheduled title that is due and re-runs the checklist first
 * (M28-S05). Safe to run often and after an outage: overdue titles are caught up at once.
 */
export async function promoteDueScheduled(ctx: PublishingContext): Promise<PromotionReport> {
  const now = (ctx.now ?? (() => new Date()))();
  const report: PromotionReport = { published: [], blocked: [] };
  const system: Actor = { accountId: '00000000-0000-7000-8000-000000000000', role: 'admin' };

  for (const target of ['video', 'series'] as const) {
    const table = target === 'video' ? videos : series;
    const due = await ctx.db
      .select({ id: table.id })
      .from(table)
      .where(
        and(
          eq(table.publishState, 'scheduled'),
          lte(table.publishAt, now),
          sql`${table.deletedAt} IS NULL`,
        ),
      );
    for (const { id } of due) {
      await withAccount(ctx.db, system, async (tx) => {
        const current = await lockTarget(tx, target, id);
        if (current.publishState !== 'scheduled') return;
        const checklist = await evaluateChecklist(tx, target, id, {
          requireApprovedCaptions: ctx.requireApprovedCaptions ?? true,
        });
        if (checklist.ok) {
          await applyState(tx, target, id, {
            publishState: 'published',
            publishAt: current.publishAt,
            publishedAt: current.publishedAt ?? current.publishAt ?? now,
          });
          report.published.push({ target, id });
          await writeAudit(tx, {
            action: `${target}.publish`,
            outcome: 'success',
            actorRole: 'system',
            targetType: target,
            targetId: id,
            summary: `Published ${current.title} on schedule`,
          });
        } else {
          await applyState(tx, target, id, { publishState: 'draft', publishAt: null });
          report.blocked.push({ target, id, reasons: failures(checklist).checklist ?? [] });
          await writeAudit(tx, {
            action: `${target}.schedule.blocked`,
            outcome: 'failure',
            actorRole: 'system',
            targetType: target,
            targetId: id,
            summary: `Scheduled release of ${current.title} was blocked`,
            extra: { reasons: failures(checklist).checklist },
          });
        }
      });
    }
  }
  return report;
}
