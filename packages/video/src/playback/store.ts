import { schema, withAccount, type Database } from '@ad/db';
import { and, eq } from 'drizzle-orm';
import type { PlayableVideo, PlaybackStore, PublicCaption } from './service';

const { videos, profiles, videoKeys, captionTracks, captions } = schema;

export class DrizzlePlaybackStore implements PlaybackStore {
  constructor(private readonly db: Database) {}

  async video(videoId: string): Promise<PlayableVideo | null> {
    const [row] = await this.db
      .select({
        id: videos.id,
        mediaPrefix: videos.mediaPrefix,
        status: videos.status,
        publishState: videos.publishState,
        publishAt: videos.publishAt,
        kidsSafe: videos.kidsSafe,
        deletedAt: videos.deletedAt,
      })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    return row ?? null;
  }

  async profile(profileId: string, accountId: string) {
    // profiles are row level secured by account, so the read must run as that account or it sees nothing.
    const [row] = await withAccount(this.db, { accountId, role: 'viewer' }, (tx) =>
      tx
        .select({ id: profiles.id, isKids: profiles.isKids })
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
        .limit(1),
    );
    return row ?? null;
  }

  async wrappedKey(videoId: string): Promise<Uint8Array | null> {
    const [row] = await this.db
      .select({ wrapped: videoKeys.keyWrapped })
      .from(videoKeys)
      .where(eq(videoKeys.videoId, videoId))
      .limit(1);
    return row?.wrapped ?? null;
  }

  async spriteKey(videoId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ key: videos.spriteKey })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    return row?.key ?? null;
  }

  async captions(videoId: string): Promise<PublicCaption[]> {
    const rows = await this.db
      .select({
        language: captionTracks.language,
        label: captionTracks.label,
        isDefault: captionTracks.isDefault,
        key: captions.publicKey,
      })
      .from(captionTracks)
      .innerJoin(captions, eq(captions.id, captionTracks.approvedCaptionId))
      .where(and(eq(captionTracks.videoId, videoId), eq(captions.status, 'approved')));
    return rows.flatMap((row) => (row.key ? [{ ...row, key: row.key }] : []));
  }
}
