import type { ProgressUpdate } from '@ad/player';

/** Body of `POST /api/progress` (lane C `saveProgressBody`). The server derives the duration from the video. */
export interface ViewerProgressBody {
  profileId: string;
  videoId: string;
  positionMs: number;
  ended: boolean;
  clientTimestamp: string;
}

export function toViewerProgressBody(
  update: ProgressUpdate,
  now: () => Date = () => new Date(),
): ViewerProgressBody {
  return {
    profileId: update.profileId,
    videoId: update.videoId,
    positionMs: Math.max(0, Math.round(update.positionSeconds * 1000)),
    ended: update.ended,
    clientTimestamp: now().toISOString(),
  };
}
