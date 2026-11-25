import { schema, type Database } from '@ad/db';
import {
  Forbidden,
  NotFound,
  effectiveSeriesLabels,
  isStaffRole,
  isUuid,
  positionCode,
  resolveSeriesLabels,
  type Actor,
} from '@ad/shared';
import { and, asc, eq, ne } from 'drizzle-orm';
import type { AuditSink } from '../captions/service';
import {
  validateChapters,
  validateMarkers,
  type ChapterInput,
  type MarkerInput,
  type MarkerKind,
} from './validate';

const { videoMarkers, videoChapters, videos, episodes, seasons, series, settings } = schema;

export interface MarkerServiceDeps {
  db: Database;
  audit?: AuditSink;
  clock?: () => Date;
}

export interface MarkerWindow {
  startMs: number;
  /** Null on credits: runs to the end of the video. */
  endMs: number | null;
}

export interface PublishedExtras {
  markers: Partial<Record<MarkerKind, MarkerWindow>>;
  chapters: ChapterInput[];
}

export interface MarkerSnapshot {
  markers: MarkerInput[];
  chapters: ChapterInput[];
  durationMs: number | null;
}

const EMPTY: PublishedExtras = { markers: {}, chapters: [] };

/**
 * Skip windows and chapters for one video (M43). Reads for viewers take no viewer argument, so guests and
 * accounts share one call (R01). Edits are for editors and admins and apply to published videos at once.
 */
export class MarkerService {
  private readonly db: Database;
  private readonly audit?: AuditSink;
  private readonly clock: () => Date;

  constructor(deps: MarkerServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.clock = deps.clock ?? (() => new Date());
  }

  /** Editor view of one video: the stored markers and chapters plus the probed length. */
  async get(actor: Actor, videoId: string): Promise<MarkerSnapshot> {
    if (!isStaffRole(actor.role)) throw new Forbidden('Only editors and admins edit skip markers');
    if (!isUuid(videoId)) throw new NotFound('Video not found');
    const [video] = await this.db
      .select({ durationMs: videos.durationMs })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!video) throw new NotFound('Video not found');
    return { ...(await this.read(videoId)), durationMs: video.durationMs };
  }

  /**
   * The other episodes of the same series with their markers, for "Copy from another episode" (M43-S04).
   * A standalone video has none. Chapters are not copied, only skip windows.
   */
  async siblings(
    actor: Actor,
    videoId: string,
  ): Promise<{ id: string; title: string; label: string; markers: MarkerInput[] }[]> {
    if (!isStaffRole(actor.role)) throw new Forbidden('Only editors and admins edit skip markers');
    if (!isUuid(videoId)) throw new NotFound('Video not found');
    const [own] = await this.db
      .select({ seriesId: seasons.seriesId, labelOverrides: series.labelOverrides })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(series, eq(series.id, seasons.seriesId))
      .where(eq(episodes.videoId, videoId))
      .limit(1);
    if (!own) return [];
    const [site] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'content.series_labels'))
      .limit(1);
    const words = resolveSeriesLabels(effectiveSeriesLabels(site?.value, own.labelOverrides), null);
    const rows = await this.db
      .select({
        id: videos.id,
        title: videos.title,
        season: seasons.number,
        number: episodes.number,
      })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(videos, eq(videos.id, episodes.videoId))
      .where(and(eq(seasons.seriesId, own.seriesId), ne(episodes.videoId, videoId)))
      .orderBy(asc(seasons.number), asc(episodes.number));
    const out = [];
    for (const row of rows) {
      const { markers } = await this.read(row.id);
      out.push({ id: row.id, title: row.title, label: positionCode(words, row.season, row.number), markers });
    }
    return out;
  }

  /**
   * What the watch page ships with the video. No viewer argument. Unpublished, deleted and not ready videos
   * give nothing, so a marker never leaks a draft.
   */
  async getPublished(videoId: string): Promise<PublishedExtras> {
    if (!isUuid(videoId)) return EMPTY;
    const [video] = await this.db
      .select({
        status: videos.status,
        publishState: videos.publishState,
        publishAt: videos.publishAt,
        deletedAt: videos.deletedAt,
      })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!video || video.deletedAt || video.status !== 'ready') return EMPTY;
    const live =
      video.publishState === 'published' ||
      (video.publishState === 'scheduled' &&
        video.publishAt !== null &&
        video.publishAt.getTime() <= this.clock().getTime());
    if (!live) return EMPTY;
    const { markers, chapters } = await this.read(videoId);
    const out: PublishedExtras = { markers: {}, chapters };
    for (const m of markers) out.markers[m.kind] = { startMs: m.startMs, endMs: m.endMs };
    return out;
  }

  /** Replaces every marker and chapter of the video in one transaction. */
  async replace(
    actor: Actor,
    videoId: string,
    input: { markers: MarkerInput[]; chapters: ChapterInput[] },
  ): Promise<MarkerSnapshot> {
    if (!isStaffRole(actor.role)) throw new Forbidden('Only editors and admins edit skip markers');
    if (!isUuid(videoId)) throw new NotFound('Video not found');
    const [video] = await this.db
      .select({ durationMs: videos.durationMs })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!video) throw new NotFound('Video not found');

    const markers = validateMarkers(input.markers, video.durationMs);
    const chapters = validateChapters(input.chapters, video.durationMs);
    const now = this.clock();

    await this.db.transaction(async (tx) => {
      await tx.delete(videoMarkers).where(eq(videoMarkers.videoId, videoId));
      await tx.delete(videoChapters).where(eq(videoChapters.videoId, videoId));
      if (markers.length > 0) {
        await tx.insert(videoMarkers).values(
          markers.map((m) => ({
            videoId,
            kind: m.kind,
            startMs: m.startMs,
            endMs: m.endMs,
            createdBy: actor.accountId,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
      if (chapters.length > 0) {
        await tx.insert(videoChapters).values(
          chapters.map((c) => ({ videoId, startMs: c.startMs, title: c.title, createdAt: now, updatedAt: now })),
        );
      }
    });

    await this.audit?.record({
      action: 'video.markers.update',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: videoId,
      metadata: { markers: markers.length, chapters: chapters.length },
    });
    return { markers, chapters, durationMs: video.durationMs };
  }

  private async read(videoId: string): Promise<{ markers: MarkerInput[]; chapters: ChapterInput[] }> {
    const [markerRows, chapterRows] = await Promise.all([
      this.db
        .select({ kind: videoMarkers.kind, startMs: videoMarkers.startMs, endMs: videoMarkers.endMs })
        .from(videoMarkers)
        .where(eq(videoMarkers.videoId, videoId))
        .orderBy(asc(videoMarkers.startMs)),
      this.db
        .select({ startMs: videoChapters.startMs, title: videoChapters.title })
        .from(videoChapters)
        .where(eq(videoChapters.videoId, videoId))
        .orderBy(asc(videoChapters.startMs)),
    ]);
    return { markers: markerRows as MarkerInput[], chapters: chapterRows };
  }
}
