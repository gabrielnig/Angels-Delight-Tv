import { and, eq, sql } from 'drizzle-orm';
import { videos, withAccount } from '@ad/db';
import { Forbidden, isAdminRole, isUuid, isStaffRole, type Actor } from '@ad/shared';
import { writeAudit } from '../audit';
import type { Tx } from '../types';
import { OK, fail, type AdminContext, type CommandResult } from './types';

/** Shortest reason accepted when captions are switched off. Same rule as the caption override. */
export const MIN_OFF_REASON = 5;

/** `null` follows the site default, `true` offers captions, `false` offers none. */
export type CaptionsSwitch = boolean | null;

/** What viewers get: the video's own choice, else the site default (D-184). */
export function effectiveCaptionsEnabled(
  video: { captionsEnabled: CaptionsSwitch },
  siteDefault: boolean,
): boolean {
  return video.captionsEnabled ?? siteDefault;
}

export function validateAvailability(
  value: CaptionsSwitch,
  reason: string | undefined,
): { ok: true; reason: string | null } | { ok: false; error: string } {
  if (value !== false) return { ok: true, reason: null };
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < MIN_OFF_REASON)
    return { ok: false, error: `Give a reason of at least ${MIN_OFF_REASON} characters for switching captions off.` };
  return { ok: true, reason: trimmed };
}

function assertAdmin(actor: Actor): void {
  if (!isStaffRole(actor.role) || !isAdminRole(actor.role)) throw new Forbidden('Admins only');
}

async function applyOne(
  tx: Tx,
  actor: Actor,
  id: string,
  value: CaptionsSwitch,
  reason: string | null,
  bulkId: string | undefined,
): Promise<{ ok: true; previous: CaptionsSwitch } | { ok: false; error: string }> {
  const [video] = await tx
    .select({ title: videos.title, previous: videos.captionsEnabled })
    .from(videos)
    .where(and(eq(videos.id, id), sql`${videos.deletedAt} IS NULL`))
    .for('update');
  if (!video) return { ok: false, error: 'That video no longer exists.' };
  await tx
    .update(videos)
    .set({ captionsEnabled: value, captionsOffReason: reason, updatedAt: new Date() })
    .where(eq(videos.id, id));
  const word = value === false ? 'off' : value === true ? 'on' : 'the site default';
  await writeAudit(tx, {
    action: 'video.captions_availability',
    outcome: 'success',
    actorAccountId: actor.accountId,
    actorRole: actor.role,
    targetType: 'video',
    targetId: id,
    summary: value === false ? `Captions switched off for ${video.title}` : `Captions set to ${word} for ${video.title}`,
    before: { captionsEnabled: video.previous },
    after: { captionsEnabled: value },
    extra: { ...(reason ? { reason } : {}), ...(bulkId ? { bulkId } : {}) },
  });
  return { ok: true, previous: video.previous };
}

/** One video. Admin only, because switching captions off satisfies the publish gate (R22). */
export async function setCaptionsAvailability(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
  value: CaptionsSwitch,
  reason?: string,
): Promise<CommandResult> {
  assertAdmin(actor);
  if (!isUuid(videoId)) return fail('That video no longer exists.');
  const checked = validateAvailability(value, reason);
  if (!checked.ok) return fail(checked.error);
  return withAccount(ctx.db, actor, async (tx: Tx) => {
    const done = await applyOne(tx, actor, videoId, value, checked.reason, undefined);
    return done.ok ? OK : fail(done.error);
  });
}

/** Many videos. Each id succeeds or fails alone. `previous` lets the caller offer Undo. */
export async function setCaptionsAvailabilityMany(
  ctx: AdminContext,
  actor: Actor,
  ids: readonly string[],
  value: CaptionsSwitch,
  reason?: string,
  bulkId?: string,
): Promise<{
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
  previous: Record<string, CaptionsSwitch>;
}> {
  assertAdmin(actor);
  const checked = validateAvailability(value, reason);
  const out = {
    succeeded: [] as string[],
    failed: [] as Array<{ id: string; reason: string }>,
    previous: {} as Record<string, CaptionsSwitch>,
  };
  if (!checked.ok) {
    out.failed = ids.map((id) => ({ id, reason: checked.error }));
    return out;
  }
  for (const id of [...new Set(ids)]) {
    if (!isUuid(id)) {
      out.failed.push({ id, reason: 'That video no longer exists.' });
      continue;
    }
    const done = await withAccount(ctx.db, actor, (tx: Tx) =>
      applyOne(tx, actor, id, value, checked.reason, bulkId),
    );
    if (done.ok) {
      out.succeeded.push(id);
      out.previous[id] = done.previous;
    } else out.failed.push({ id, reason: done.error });
  }
  return out;
}
