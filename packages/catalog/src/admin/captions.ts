import { eq, sql } from 'drizzle-orm';
import { videos, withAccount } from '@ad/db';
import { Forbidden, NotFound, isUuid, type Actor, isStaffRole } from '@ad/shared';
import { rowsOf } from '../sql';
import { isoOf, type AdminCaptionState, type AdminContext } from './types';

/** One translated language of a video, for the chip on the Captions list. */
export interface AdminTranslationChip {
  language: string;
  state: 'needs_review' | 'approved' | 'rejected';
  /** Viewers can see it (the per language Publish switch). */
  published: boolean;
  /** The approved source revision changed after this translation was made. */
  sourceChanged: boolean;
}

export interface AdminCaptionRow {
  videoId: string;
  title: string;
  /** The language spoken in the video. `state` is the state of its track. */
  spokenLanguage: string;
  /** Other languages, ordered by code. Never changes `state`. */
  translations: AdminTranslationChip[];
  state: AdminCaptionState;
  cueCount: number | null;
  /** When the newest revision was made, or null when there is none. */
  updatedAt: string | null;
  /** Account id of whoever made or approved it. Null for automatic captions. */
  updatedBy: string | null;
  /** Automatic captions nobody has opened or edited, so approving them in bulk needs a tick. */
  untouchedAuto: boolean;
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
      SELECT v.id, v.title, coalesce(v.language, 'en') AS spoken, cap.status, cap.cue_count, cap.created_at, cap.reviewed_by, cap.created_by, cap.source,
        EXISTS (SELECT 1 FROM jobs j WHERE j.video_id = v.id AND j.queue = 'caption.generate'
          AND j.status IN ('queued', 'running')) AS generating,
        EXISTS (SELECT 1 FROM jobs j WHERE j.video_id = v.id AND j.queue = 'caption.generate'
          AND j.status IN ('failed', 'failed_permanent')
          AND NOT EXISTS (SELECT 1 FROM jobs k WHERE k.video_id = v.id AND k.queue = 'caption.generate' AND k.created_at > j.created_at)) AS failed
      FROM videos v
      LEFT JOIN LATERAL (
        SELECT c.status, c.cue_count, c.created_at, c.reviewed_by, c.created_by, c.source
        FROM caption_tracks ct JOIN captions c ON c.track_id = ct.id
        WHERE ct.video_id = v.id AND ct.language = coalesce(v.language, 'en') ORDER BY c.revision DESC LIMIT 1) cap ON true
      WHERE v.deleted_at IS NULL AND v.status = 'ready'
      ORDER BY v.title, v.id`);
    const chips = rowsOf<{
      video_id: string;
      language: string;
      published: boolean;
      status: string;
      source_changed: boolean;
    }>(
      await tx.execute(sql`
        SELECT ct.video_id, ct.language, ct.published, lat.status,
          (ap.source_sha256 IS NOT NULL AND src.sha256 IS NOT NULL AND ap.source_sha256 <> src.sha256) AS source_changed
        FROM caption_tracks ct
        JOIN videos v ON v.id = ct.video_id
        JOIN LATERAL (SELECT c.status FROM captions c WHERE c.track_id = ct.id ORDER BY c.revision DESC LIMIT 1) lat ON true
        LEFT JOIN captions ap ON ap.id = ct.approved_caption_id
        LEFT JOIN caption_tracks st ON st.video_id = v.id AND st.language = coalesce(v.language, 'en')
        LEFT JOIN captions src ON src.id = st.approved_caption_id
        WHERE ct.language <> coalesce(v.language, 'en') AND v.deleted_at IS NULL AND v.status = 'ready'
        ORDER BY ct.video_id, ct.language`),
    );
    const byVideo = new Map<string, AdminTranslationChip[]>();
    for (const chip of chips) {
      const list = byVideo.get(chip.video_id) ?? [];
      list.push({
        language: chip.language,
        state: chip.status === 'approved' ? 'approved' : chip.status === 'rejected' ? 'rejected' : 'needs_review',
        published: chip.published,
        sourceChanged: chip.source_changed,
      });
      byVideo.set(chip.video_id, list);
    }
    return rowsOf<{
      id: string;
      title: string;
      spoken: string;
      status: string | null;
      cue_count: number | null;
      created_at: Date | string | null;
      reviewed_by: string | null;
      created_by: string | null;
      source: string | null;
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
        spokenLanguage: row.spoken,
        translations: byVideo.get(row.id) ?? [],
        state,
        cueCount: row.status ? row.cue_count : null,
        updatedAt: row.status ? isoOf(row.created_at) : null,
        updatedBy: row.status === 'approved' ? row.reviewed_by : row.created_by,
        untouchedAuto:
          state === 'needs_review' &&
          row.source === 'whisper' &&
          row.created_by === null &&
          row.reviewed_by === null,
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
