import { schema, type Database } from '@ad/db';
import type { Logger } from '@ad/shared';
import { notifyStaff } from '@ad/video';
import { eq } from 'drizzle-orm';
import type { StaffNotifier } from './handlers';

const { videos } = schema;

/** Builds the bell notices for job results (M21-S03). Titles come from the video, copy is plain and says what to do. */
export function makeNotifier(db: Database, logger: Logger): StaffNotifier {
  const lookup = async (videoId: string) => {
    const [row] = await db
      .select({ title: videos.title, failure: videos.failureMessage })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    return { title: row?.title?.trim() || 'Untitled video', failure: row?.failure ?? null };
  };
  const send = async (
    kind: Parameters<typeof notifyStaff>[1]['kind'],
    title: string,
    videoId: string,
    body: string,
    href: string,
  ) => {
    await notifyStaff(db, { kind, title, body, href, videoId }, (err) =>
      logger.warn('staff notice not stored', { err, kind }),
    );
  };
  return {
    async encodeDone(videoId) {
      const v = await lookup(videoId);
      await send('encode_done', 'Video is ready', videoId, v.title, `/admin/videos/${videoId}`);
    },
    async encodeFailed(videoId, reason) {
      const v = await lookup(videoId);
      await send(
        'encode_failed',
        'Encoding failed',
        videoId,
        `${v.title}: ${v.failure ?? reason}`,
        `/admin/videos/${videoId}`,
      );
    },
    async captionsReady(videoId) {
      const v = await lookup(videoId);
      await send(
        'captions_ready',
        'Captions ready to review',
        videoId,
        v.title,
        `/admin/captions/${videoId}`,
      );
    },
    async captionsFailed(videoId) {
      const v = await lookup(videoId);
      await send(
        'captions_failed',
        'Captions could not be made',
        videoId,
        `${v.title}: try again from the captions page.`,
        `/admin/captions/${videoId}`,
      );
    },
    async posterRecutFailed(videoId) {
      const v = await lookup(videoId);
      // Shares the failure kind so the bell, the digest and the checks need no new notice type (D-158).
      await send(
        'encode_failed',
        'Poster crop could not be applied',
        videoId,
        `${v.title}: the old poster is still showing. Open the poster page and save again.`,
        `/admin/videos/${videoId}/poster`,
      );
    },
  };
}
