import { schema, type Database } from '@ad/db';
import { Forbidden, NotFound, isUuid, type Actor, isStaffRole } from '@ad/shared';
import { asc, desc, eq } from 'drizzle-orm';

const { videos, jobs, renditions } = schema;

/** The most recent jobs shown per video. Older rows are history the screen does not need. */
const JOB_LIMIT = 20;

export interface EncodingStatus {
  video: {
    id: string;
    status: string;
    publishState: string;
    durationMs: number | null;
    failureCode: string | null;
    failureMessage: string | null;
  };
  jobs: Array<{
    id: string;
    queue: string;
    status: string;
    stage: string | null;
    progress: number;
    attempts: number;
    errorMessage: string | null;
    errorDetail: string | null;
    createdAt: string;
    startedAt: string | null;
    heartbeatAt: string | null;
    finishedAt: string | null;
  }>;
  renditions: Array<{ height: number; width: number; status: string; segmentCount: number | null }>;
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/** Where a video is in processing, for the admin encoding screen (M14). Editors and admins only. */
export async function encodingStatus(
  db: Database,
  actor: Actor,
  videoId: string,
): Promise<EncodingStatus> {
  if (!isStaffRole(actor.role))
    throw new Forbidden('Only editors and admins can see encoding status');
  if (!isUuid(videoId)) throw new NotFound('Video not found');
  const [video] = await db
    .select({
      id: videos.id,
      status: videos.status,
      publishState: videos.publishState,
      durationMs: videos.durationMs,
      failureCode: videos.failureCode,
      failureMessage: videos.failureMessage,
    })
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);
  if (!video) throw new NotFound('Video not found');

  const jobRows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.videoId, videoId))
    .orderBy(desc(jobs.createdAt))
    .limit(JOB_LIMIT);
  const rungs = await db
    .select({
      height: renditions.height,
      width: renditions.width,
      status: renditions.status,
      segmentCount: renditions.segmentCount,
    })
    .from(renditions)
    .where(eq(renditions.videoId, videoId))
    .orderBy(asc(renditions.height));

  return {
    video,
    jobs: jobRows.map((row) => ({
      id: row.id,
      queue: row.queue,
      status: row.status,
      stage: row.stage,
      progress: row.progress,
      attempts: row.attempts,
      errorMessage: row.errorMessage,
      errorDetail: row.errorDetail,
      createdAt: row.createdAt.toISOString(),
      startedAt: iso(row.startedAt),
      heartbeatAt: iso(row.heartbeatAt),
      finishedAt: iso(row.finishedAt),
    })),
    renditions: rungs,
  };
}
