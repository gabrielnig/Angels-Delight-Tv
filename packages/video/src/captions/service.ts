import { schema, type Database } from '@ad/db';
import type { JobProducer } from '@ad/queue';
import {
  Conflict,
  Forbidden,
  NotFound,
  ValidationFailed,
  isUuid,
  type Actor,
  isStaffRole,
  isAdminRole,
} from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  VttError,
  parseSrt,
  parseVtt,
  sanitizeCueText,
  serializeVtt,
  validateCues,
  type Cue,
  type CueWarning,
} from '../vtt';
import { cleanScript } from './align';
import {
  AUTOSAVE_WINDOW_MS,
  ensureTrack,
  sha8Of,
  storeRevision,
  type CaptionRow,
} from './revisions';

const { captions, captionTracks, videos, jobs } = schema;

const SCRIPT_MAX_BYTES = 200 * 1024;

export type CaptionState = 'none' | 'generating' | 'needs_review' | 'approved' | 'rejected';

/** Thrown by approve when the cues have warnings and the caller has not confirmed them. */
export class CaptionNeedsConfirmation extends Conflict {
  constructor(readonly warnings: CueWarning[]) {
    super('These captions have warnings. Confirm to approve anyway.');
    this.name = 'CaptionNeedsConfirmation';
  }
}

export interface AuditSink {
  record(event: {
    action: string;
    outcome: 'success' | 'denied' | 'failure';
    actorAccountId?: string | null;
    actorRole?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface CaptionServiceDeps {
  db: Database;
  originals: StorageAdapter;
  media: StorageAdapter;
  producer: Pick<JobProducer, 'enqueue'>;
  audit?: AuditSink;
  clock?: () => Date;
}

export interface TrackSummary {
  trackId: string;
  language: string;
  label: string;
  state: CaptionState;
  latestRevisionId: string | null;
  approvedRevisionId: string | null;
  cueCount: number;
  updatedAt: Date | null;
  reviewNote: string | null;
}

export interface ReviewQueueRow {
  videoId: string;
  title: string;
  trackId: string;
  captionId: string;
  language: string;
  cueCount: number;
  source: CaptionRow['source'];
  waitingSince: Date;
  reviewNote: string | null;
  state: 'needs_review';
}

const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

function assertStaff(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Only editors and admins manage captions');
}

async function readText(storage: StorageAdapter, key: string): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.get(key)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function cleanCues(cues: Cue[]): Cue[] {
  if (!Array.isArray(cues) || cues.length > 20_000) {
    throw new ValidationFailed({ cues: ['A caption file can hold up to 20,000 cues.'] });
  }
  return cues.map((cue, index) => {
    if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs) || cue.startMs < 0) {
      throw new ValidationFailed({ cues: [`Cue ${index + 1} has an invalid time.`] });
    }
    return {
      startMs: Math.round(cue.startMs),
      endMs: Math.round(cue.endMs),
      text: sanitizeCueText(String(cue.text ?? '')),
    };
  });
}

/** Review, edit and approve flow for caption revisions (M15-S03 to S10). Runs in the web process. */
export class CaptionService {
  private readonly db: Database;
  private readonly originals: StorageAdapter;
  private readonly media: StorageAdapter;
  private readonly producer: Pick<JobProducer, 'enqueue'>;
  private readonly audit?: AuditSink;
  private readonly clock: () => Date;

  constructor(deps: CaptionServiceDeps) {
    this.db = deps.db;
    this.originals = deps.originals;
    this.media = deps.media;
    this.producer = deps.producer;
    this.audit = deps.audit;
    this.clock = deps.clock ?? (() => new Date());
  }

  private async load(id: string) {
    if (!isUuid(id)) throw new NotFound('Captions not found');
    const [row] = await this.db
      .select({ caption: captions, track: captionTracks, video: videos })
      .from(captions)
      .innerJoin(captionTracks, eq(captionTracks.id, captions.trackId))
      .innerJoin(videos, eq(videos.id, captionTracks.videoId))
      .where(eq(captions.id, id))
      .limit(1);
    if (!row) throw new NotFound('Captions not found');
    return row;
  }

  private async record(
    actor: Actor,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.audit?.record({
      action,
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'caption',
      targetId,
      metadata,
    });
  }

  async getRevision(actor: Actor, captionId: string) {
    assertStaff(actor);
    const { caption } = await this.load(captionId);
    const cues = parseVtt(await readText(this.originals, caption.storageKey));
    return {
      caption,
      cues,
      warnings: validateCues(cues),
      /** Start times (ms) of cues to highlight. Only aligned revisions have any. */
      lowConfidence: caption.lowConfidenceCues,
    };
  }

  /**
   * A save is always a new revision waiting for review. Viewers keep the approved text until a newer
   * revision is approved. Only an admin can save and keep approved in one step.
   */
  async saveRevision(
    actor: Actor,
    trackId: string,
    cues: Cue[],
    options: { keepApproved?: boolean } = {},
  ): Promise<CaptionRow> {
    assertStaff(actor);
    if (options.keepApproved && !isAdminRole(actor.role)) {
      throw new Forbidden('Only an admin can save and keep captions approved');
    }
    const [track] = await this.db
      .select()
      .from(captionTracks)
      .where(eq(captionTracks.id, trackId))
      .limit(1);
    if (!track) throw new NotFound('Caption track not found');
    const next = cleanCues(cues);
    const revision = await storeRevision(this.db, this.originals, track, {
      cues: next,
      source: 'manual',
      createdBy: actor.accountId,
      lowConfidenceCues: await this.flagsToKeep(trackId, next),
      // Autosaves share one working revision. Save and keep approved is a deliberate act and always adds one.
      coalesce: options.keepApproved ? undefined : { withinMs: AUTOSAVE_WINDOW_MS },
    });
    if (!options.keepApproved) return revision;
    await this.record(actor, 'captions.save_keep_approved', revision.id, {
      videoId: track.videoId,
      revision: revision.revision,
    });
    return this.approve(actor, revision.id, { confirmWarnings: true });
  }

  /**
   * A flagged cue stays flagged until someone edits it. Cues are matched by start time and text, so changing the
   * wording or the timing counts as a review of that cue.
   */
  private async flagsToKeep(trackId: string, next: Cue[]): Promise<number[]> {
    const [latest] = await this.db
      .select()
      .from(captions)
      .where(eq(captions.trackId, trackId))
      .orderBy(desc(captions.revision))
      .limit(1);
    if (!latest || latest.lowConfidenceCues.length === 0) return [];
    const before = parseVtt(await readText(this.originals, latest.storageKey));
    const flagged = new Set(latest.lowConfidenceCues);
    return before
      .filter((cue) => flagged.has(cue.startMs))
      .filter((cue) =>
        next.some((n) => n.startMs === cue.startMs && n.endMs === cue.endMs && n.text === cue.text),
      )
      .map((cue) => cue.startMs);
  }

  /** The script text with speaker names and stage directions removed, as it will be used (M15-S02 edge). */
  previewScript(script: string): string {
    return cleanScript(script);
  }

  async getScript(
    actor: Actor,
    videoId: string,
  ): Promise<{ text: string; cleaned: string } | null> {
    assertStaff(actor);
    try {
      const text = await readText(this.originals, `scripts/${videoId}.txt`);
      return { text, cleaned: cleanScript(text) };
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  /** Keeps the script next to the other private files of the video and queues alignment to the audio. */
  async saveScript(
    actor: Actor,
    videoId: string,
    script: string,
  ): Promise<{ cleaned: string; jobId: string }> {
    assertStaff(actor);
    const cleaned = cleanScript(script);
    if (cleaned.trim() === '') {
      throw new ValidationFailed({ script: ['Paste the script text first.'] });
    }
    if (Buffer.byteLength(script) > SCRIPT_MAX_BYTES) {
      throw new ValidationFailed({ script: ['This script is longer than 200 KB.'] });
    }
    const [video] = await this.db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!video) throw new NotFound('Video not found');
    await this.originals.put(`scripts/${videoId}.txt`, new TextEncoder().encode(script), {
      contentType: 'text/plain; charset=utf-8',
    });
    const queued = await this.regenerate(actor, videoId, 'align');
    await this.record(actor, 'captions.script_saved', videoId, { videoId });
    return { cleaned, jobId: queued.jobId };
  }

  async approve(
    actor: Actor,
    captionId: string,
    options: { confirmWarnings?: boolean } = {},
  ): Promise<CaptionRow> {
    assertStaff(actor);
    const { caption, track, video } = await this.load(captionId);
    if (caption.status !== 'in_review' && caption.status !== 'draft') {
      throw new Conflict('Only captions waiting for review can be approved.');
    }
    const body = await readText(this.originals, caption.storageKey);
    const warnings = validateCues(parseVtt(body));
    if (warnings.length > 0 && !options.confirmWarnings)
      throw new CaptionNeedsConfirmation(warnings);

    // Publish first. If this throws nothing has changed (M15-S07 error).
    const publicKey = `cap/${video.mediaPrefix}/${track.language}/${sha8Of(body)}.vtt`;
    await this.media.put(publicKey, new TextEncoder().encode(body), {
      contentType: 'text/vtt; charset=utf-8',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    const approved = await this.db.transaction(async (tx) => {
      if (track.approvedCaptionId && track.approvedCaptionId !== caption.id) {
        await tx
          .update(captions)
          .set({ status: 'superseded' })
          .where(eq(captions.id, track.approvedCaptionId));
      }
      const [row] = await tx
        .update(captions)
        .set({
          status: 'approved',
          reviewedBy: actor.accountId,
          reviewedAt: this.clock(),
          publicKey,
        })
        .where(eq(captions.id, caption.id))
        .returning();
      await tx
        .update(captionTracks)
        .set({ approvedCaptionId: caption.id })
        .where(eq(captionTracks.id, track.id));
      return row!;
    });
    await this.record(actor, 'captions.approve', caption.id, {
      videoId: video.id,
      revision: caption.revision,
      warnings: warnings.length,
    });
    return approved;
  }

  async reject(actor: Actor, captionId: string, note: string): Promise<CaptionRow> {
    assertStaff(actor);
    const { caption, video } = await this.load(captionId);
    if (caption.status !== 'in_review' && caption.status !== 'draft') {
      throw new Conflict('Only captions waiting for review can be rejected.');
    }
    const [row] = await this.db
      .update(captions)
      .set({
        status: 'rejected',
        reviewedBy: actor.accountId,
        reviewedAt: this.clock(),
        reviewNote: note.slice(0, 500),
      })
      .where(eq(captions.id, caption.id))
      .returning();
    await this.record(actor, 'captions.reject', caption.id, {
      videoId: video.id,
      revision: caption.revision,
    });
    return row!;
  }

  async regenerate(actor: Actor, videoId: string, mode: 'transcribe' | 'align' = 'transcribe') {
    assertStaff(actor);
    const [video] = await this.db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!video) throw new NotFound('Video not found');
    return this.producer.enqueue(
      'caption.generate',
      { videoId, mode },
      { createdBy: actor.accountId },
    );
  }

  async importFile(
    actor: Actor,
    videoId: string,
    filename: string,
    content: string,
    language = 'en',
  ): Promise<CaptionRow> {
    assertStaff(actor);
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension !== 'vtt' && extension !== 'srt') {
      throw new ValidationFailed({ file: ['Upload a .vtt or .srt file.'] });
    }
    if (Buffer.byteLength(content) > IMPORT_MAX_BYTES) {
      throw new ValidationFailed({ file: ['This file is larger than 2 MB.'] });
    }
    const [video] = await this.db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!video) throw new NotFound('Video not found');
    let cues: Cue[];
    try {
      cues = extension === 'vtt' ? parseVtt(content) : parseSrt(content);
    } catch (error) {
      if (error instanceof VttError) throw new ValidationFailed({ file: [error.message] });
      throw error;
    }
    const track = await ensureTrack(this.db, videoId, language);
    const revision = await storeRevision(this.db, this.originals, track, {
      cues,
      source: 'manual',
      createdBy: actor.accountId,
    });
    await this.record(actor, 'captions.import', revision.id, {
      videoId,
      revision: revision.revision,
    });
    return revision;
  }

  async exportVtt(actor: Actor, captionId: string): Promise<string> {
    assertStaff(actor);
    const { caption } = await this.load(captionId);
    return serializeVtt(parseVtt(await readText(this.originals, caption.storageKey)));
  }

  /** Videos whose newest revision is waiting for review, oldest first. */
  async reviewQueue(actor: Actor): Promise<ReviewQueueRow[]> {
    assertStaff(actor);
    const rows = await this.db
      .select({
        videoId: videos.id,
        title: videos.title,
        trackId: captionTracks.id,
        captionId: captions.id,
        language: captionTracks.language,
        cueCount: captions.cueCount,
        source: captions.source,
        waitingSince: captions.createdAt,
        reviewNote: captions.reviewNote,
      })
      .from(captions)
      .innerJoin(captionTracks, eq(captionTracks.id, captions.trackId))
      .innerJoin(videos, eq(videos.id, captionTracks.videoId))
      .where(
        and(
          inArray(captions.status, ['draft', 'in_review']),
          sql`NOT EXISTS (SELECT 1 FROM captions newer WHERE newer.track_id = ${captions.trackId} AND newer.revision > ${captions.revision})`,
          sql`${videos.deletedAt} IS NULL`,
        ),
      )
      .orderBy(asc(captions.createdAt));
    return rows.map((row) => ({ ...row, state: 'needs_review' as const }));
  }

  async needsReviewCount(actor: Actor): Promise<number> {
    return (await this.reviewQueue(actor)).length;
  }

  async isGenerating(videoId: string): Promise<boolean> {
    const [open] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.queue, 'caption.generate'),
          eq(jobs.videoId, videoId),
          inArray(jobs.status, ['queued', 'running']),
        ),
      )
      .limit(1);
    return Boolean(open);
  }

  async listForVideo(actor: Actor, videoId: string): Promise<TrackSummary[]> {
    assertStaff(actor);
    const tracks = await this.db
      .select()
      .from(captionTracks)
      .where(eq(captionTracks.videoId, videoId));
    const generating = await this.isGenerating(videoId);
    const out: TrackSummary[] = [];
    for (const track of tracks) {
      const [latest] = await this.db
        .select()
        .from(captions)
        .where(eq(captions.trackId, track.id))
        .orderBy(desc(captions.revision))
        .limit(1);
      let state: CaptionState = 'none';
      if (generating) state = 'generating';
      else if (latest?.status === 'approved') state = 'approved';
      else if (latest?.status === 'rejected') state = 'rejected';
      else if (latest) state = 'needs_review';
      out.push({
        trackId: track.id,
        language: track.language,
        label: track.label,
        state,
        latestRevisionId: latest?.id ?? null,
        approvedRevisionId: track.approvedCaptionId,
        cueCount: latest?.cueCount ?? 0,
        updatedAt: latest?.createdAt ?? null,
        reviewNote: latest?.reviewNote ?? null,
      });
    }
    return out;
  }

  /** The publish gate (M15-S10): is there an approved track for this language. */
  async hasApprovedCaptions(videoId: string, language = 'en'): Promise<boolean> {
    const [row] = await this.db
      .select({ id: captions.id })
      .from(captionTracks)
      .innerJoin(captions, eq(captions.id, captionTracks.approvedCaptionId))
      .where(
        and(
          eq(captionTracks.videoId, videoId),
          eq(captionTracks.language, language),
          eq(captions.status, 'approved'),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** What the player may list. Only approved tracks, and only their media bucket key. */
  async publicCaptions(
    videoId: string,
  ): Promise<{ language: string; label: string; isDefault: boolean; key: string }[]> {
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
