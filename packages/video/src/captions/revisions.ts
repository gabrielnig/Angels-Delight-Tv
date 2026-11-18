import { schema, type Database } from '@ad/db';
import { ValidationFailed, uuidv7 } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { serializeVtt, type Cue } from '../vtt';

const { captionTracks, captions } = schema;

export type TrackRow = typeof captionTracks.$inferSelect;
export type CaptionRow = typeof captions.$inferSelect;

/** captions.bytes is capped at 1 MiB by a check constraint (SECURITY section 8). */
export const MAX_CAPTION_BYTES = 1024 * 1024;

export const draftKey = (videoId: string, language: string, revision: number) =>
  `captions-draft/${videoId}/${language}/r${revision}.vtt`;

/** One track per video and language. Safe when two jobs race: the unique index decides and both read the winner. */
export async function ensureTrack(
  db: Database,
  videoId: string,
  language: string,
  label = 'English',
): Promise<TrackRow> {
  await db
    .insert(captionTracks)
    .values({ id: uuidv7(), videoId, language, label, kind: 'captions', isDefault: true })
    .onConflictDoNothing();
  const [track] = await db
    .select()
    .from(captionTracks)
    .where(and(eq(captionTracks.videoId, videoId), eq(captionTracks.language, language)))
    .limit(1);
  if (!track) throw new Error('Caption track could not be created');
  return track;
}

export interface NewRevision {
  cues: Cue[];
  source: CaptionRow['source'];
  model?: string | null;
  createdBy?: string | null;
  reviewNote?: string | null;
  /** Start times (ms) of cues to highlight in review. */
  lowConfidenceCues?: number[];
}

/**
 * Appends a revision under a row lock on the track so revision numbers never collide. Earlier drafts and
 * revisions waiting for review become superseded. Approved and rejected revisions are left alone.
 */
export async function storeRevision(
  db: Database,
  originals: StorageAdapter,
  track: TrackRow,
  input: NewRevision,
): Promise<CaptionRow> {
  const text = serializeVtt(input.cues);
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_CAPTION_BYTES) {
    throw new ValidationFailed({ file: ['This caption file is too large. The limit is 1 MB.'] });
  }
  const sha256 = createHash('sha256').update(text).digest();

  return db.transaction(async (tx) => {
    await tx
      .select({ id: captionTracks.id })
      .from(captionTracks)
      .where(eq(captionTracks.id, track.id))
      .for('update');
    const [latest] = await tx
      .select({ revision: captions.revision })
      .from(captions)
      .where(eq(captions.trackId, track.id))
      .orderBy(desc(captions.revision))
      .limit(1);
    const revision = (latest?.revision ?? 0) + 1;
    const storageKey = draftKey(track.videoId, track.language, revision);
    await originals.put(storageKey, new TextEncoder().encode(text), { contentType: 'text/vtt' });
    await tx
      .update(captions)
      .set({ status: 'superseded' })
      .where(and(eq(captions.trackId, track.id), inArray(captions.status, ['draft', 'in_review'])));
    const [row] = await tx
      .insert(captions)
      .values({
        trackId: track.id,
        revision,
        source: input.source,
        status: 'in_review',
        storageKey,
        sha256,
        bytes,
        cueCount: input.cues.length,
        model: input.model ?? null,
        createdBy: input.createdBy ?? null,
        reviewNote: input.reviewNote ?? null,
        lowConfidenceCues: input.lowConfidenceCues ?? [],
      })
      .returning();
    return row!;
  });
}

export function sha8Of(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}
