import { schema, type Database } from '@ad/db';
import { Conflict, NotFound, createLogger, type Logger } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, desc, eq, isNull } from 'drizzle-orm';

const { videos, renditions, jobs } = schema;

export interface FailedEncodeDeps {
  db: Database;
  originals: StorageAdapter;
  media: StorageAdapter;
  logger?: Logger;
}

export interface FailedEncodeRow {
  videoId: string;
  title: string;
  failedAt: Date;
  code: string | null;
  /** Plain words for the admin. */
  plain: string;
  /** For the developer. Show it only behind a disclosure and only to admins. */
  technical: string | null;
  stage: string | null;
  attempts: number;
  hasOriginal: boolean;
  originalBytes: number | null;
  /** Retry needs the source file. Without it the admin must replace the file. */
  canRetry: boolean;
  /** Partial output a failed encode left behind. */
  leftover: { files: number; bytes: number };
}

/** Where a failed encode leaves partial files. Captions and the original are not touched. */
function leftoverLocations(video: { id: string; mediaPrefix: string }) {
  return {
    media: [`v/${video.mediaPrefix}/`, `cap/${video.mediaPrefix}/sprites/`],
    originals: [`templates/${video.id}/`],
  };
}

/** M14-S06 and S09: finding failed encodes and clearing what they left behind so Retry starts clean. */
export class FailedEncodeService {
  private readonly logger: Logger;
  constructor(private readonly deps: FailedEncodeDeps) {
    this.logger = deps.logger ?? createLogger({ write: () => undefined });
  }

  private async measure(video: { id: string; mediaPrefix: string }) {
    const where = leftoverLocations(video);
    let files = 0;
    let bytes = 0;
    for (const prefix of where.media)
      for (const object of await this.deps.media.list(prefix)) {
        files += 1;
        bytes += object.bytes;
      }
    for (const prefix of where.originals)
      for (const object of await this.deps.originals.list(prefix)) {
        files += 1;
        bytes += object.bytes;
      }
    return { files, bytes };
  }

  async list(): Promise<FailedEncodeRow[]> {
    const { db } = this.deps;
    const failed = await db
      .select()
      .from(videos)
      .where(and(eq(videos.status, 'failed'), isNull(videos.deletedAt)))
      .orderBy(desc(videos.updatedAt));
    const out: FailedEncodeRow[] = [];
    for (const video of failed) {
      const [job] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.videoId, video.id), eq(jobs.status, 'failed')))
        .orderBy(desc(jobs.createdAt))
        .limit(1);
      const hasOriginal = Boolean(video.originalKey);
      out.push({
        videoId: video.id,
        title: video.title,
        failedAt: video.updatedAt,
        code: video.failureCode,
        plain: video.failureMessage ?? 'Something went wrong while preparing this video.',
        technical: job?.errorDetail ?? null,
        stage: job?.stage ?? null,
        attempts: job?.attempts ?? 0,
        hasOriginal,
        originalBytes: video.originalBytes,
        canRetry: hasOriginal,
        leftover: await this.measure(video),
      });
    }
    return out;
  }

  /** Deletes partial files and rendition rows of one failed video. Safe to repeat. */
  async cleanup(videoId: string): Promise<{ removedFiles: number; freedBytes: number }> {
    const { db, media, originals } = this.deps;
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) throw new NotFound('Video not found');
    if (video.status !== 'failed') throw new Conflict('Only a failed video can be cleaned up.');
    const { files, bytes } = await this.measure(video);
    const where = leftoverLocations(video);
    for (const prefix of where.media) await media.deletePrefix(prefix);
    for (const prefix of where.originals) await originals.deletePrefix(prefix);
    await db.delete(renditions).where(eq(renditions.videoId, videoId));
    await db
      .update(videos)
      .set({ spriteKey: null, updatedAt: new Date() })
      .where(eq(videos.id, videoId));
    this.logger.info('failed encode cleaned', { videoId, files, bytes });
    return { removedFiles: files, freedBytes: bytes };
  }

  async cleanupAll(): Promise<{ videos: number; removedFiles: number; freedBytes: number }> {
    const rows = await this.list();
    let removedFiles = 0;
    let freedBytes = 0;
    for (const row of rows) {
      const result = await this.cleanup(row.videoId);
      removedFiles += result.removedFiles;
      freedBytes += result.freedBytes;
    }
    return { videos: rows.length, removedFiles, freedBytes };
  }
}
