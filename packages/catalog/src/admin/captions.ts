import { eq, sql } from 'drizzle-orm';
import { videos, withAccount } from '@ad/db';
import { Forbidden, NotFound, isUuid, type Actor, isStaffRole } from '@ad/shared';
import { rowsOf } from '../sql';
import { isoOf, type AdminCaptionState, type AdminContext } from './types';

export interface AdminCaptionRow {
  videoId: string;
  title: string;
  state: AdminCaptionState;
  cueCount: number | null;
  /** When the newest revision was made, or null when there is none. */
  updatedAt: string | null;
  /** Account id of whoever made or approved it. Null for automatic captions. */
  updatedBy: string | null;
}

function assertStaff(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Editors only');
}

/** Ready videos with the state of their English captions, for the Captions list. */
export async function listAdminCaptionRows(
  ctx: AdminContext,
  actor: Actor,
): Promise<AdminCaptionRow[]> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const result = await tx.execute(sql`
      SELECT v.id, v.title, cap.status, cap.cue_count, cap.created_at, cap.reviewed_by, cap.created_by,
        EXISTS (SELECT 1 FROM jobs j WHERE j.video_id = v.id AND j.queue = 'caption.generate'
          AND j.status IN ('queued', 'running')) AS generating,
        EXISTS (SELECT 1 FROM jobs j WHERE j.video_id = v.id AND j.queue = 'caption.generate'
          AND j.status IN ('failed', 'failed_permanent')
          AND NOT EXISTS (SELECT 1 FROM jobs k WHERE k.video_id = v.id AND k.queue = 'caption.generate' AND k.created_at > j.created_at)) AS failed
      FROM videos v
      LEFT JOIN LATERAL (
        SELECT c.status, c.cue_count, c.created_at, c.reviewed_by, c.created_by
        FROM caption_tracks ct JOIN captions c ON c.track_id = ct.id
        WHERE ct.video_id = v.id AND ct.language = 'en' ORDER BY c.revision DESC LIMIT 1) cap ON true
      WHERE v.deleted_at IS NULL AND v.status = 'ready'
      ORDER BY v.title, v.id`);
    return rowsOf<{
      id: string;
      title: string;
      status: string | null;
      cue_count: number | null;
      created_at: Date | string | null;
      reviewed_by: string | null;
      created_by: string | null;
      generating: boolean;
      failed: boolean;
    }>(result).map((row) => {
      const state: AdminCaptionState = row.generating
        ? 'generating'
        : row.status === 'approved'
          ? 'approved'
          : row.status
            ? 'needs_review'
            : row.failed
              ? 'failed'
              : 'none';
      return {
        videoId: row.id,
        title: row.title,
        state,
        cueCount: row.status ? row.cue_count : null,
        updatedAt: row.status ? isoOf(row.created_at) : null,
        updatedBy: row.status === 'approved' ? row.reviewed_by : row.created_by,
      };
    });
  });
}

/** Approved captions replace any earlier "publish without captions" reason. */
export async function clearCaptionOverride(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
): Promise<void> {
  assertStaff(actor);
  if (!isUuid(videoId)) throw new NotFound('Video not found');
  await withAccount(ctx.db, actor, (tx) =>
    tx.update(videos).set({ captionOverrideReason: null }).where(eq(videos.id, videoId)),
  );
}
