import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { schema, type Database } from '@ad/db';
import type { ClassifiedFailure, JobProducer } from '@ad/queue';
import { Conflict, LOW_FRAME_SCORE, NotFound, createLogger, uuidv7, type Logger } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, asc, eq, like, sql } from 'drizzle-orm';
import { PipelineError, toPipelineError } from '../failure';
import { generateHlsKey, unwrapHlsKey, wrapHlsKey, type Keyring } from '../hls-key';
import { DEFAULT_LADDER, codecsFor, planLadder, type PlannedRung, type RungSpec } from '../ladder';
import { scoreFrame } from '../image/score';
import { sniffContainer, type Container } from '../magic';
import {
  buildMasterTemplate,
  buildVariantTemplate,
  parseMediaPlaylist,
  type MasterRung,
} from '../playlist';
import {
  PREVIEW_CRF,
  PREVIEW_MAX_BYTES,
  PREVIEW_RETRY_CRF,
  planPreview,
  previewArgs,
  previewKey,
  previewScoreOffsetMs,
} from '../preview';
import { sweepPreviews } from '../preview-sweep';
import { buildSpriteVtt, planSprite, spriteArgs } from '../sprite';
import { parseFfprobe, validateProbe, type ProbeLimits, type ProbeResult } from '../probe';
import {
  ProgressParser,
  encodeRungArgs,
  ffprobeArgs,
  segmentBandwidths,
  thumbnailArgs,
  nodeRunner,
  type ProcessRunner,
} from './ffmpeg';
import { downloadTo, readHead } from './files';
import { withScratch, type ScratchOptions } from './scratch';

const { videos, renditions, videoKeys, assets } = schema;

export type ProgressFn = (stage: string, percent: number) => Promise<void>;

export interface PipelineDeps {
  db: Database;
  originals: StorageAdapter;
  media: StorageAdapter;
  keyring: Keyring;
  producer: Pick<JobProducer, 'enqueue'>;
  scratch: ScratchOptions;
  runner?: ProcessRunner;
  ffmpeg?: {
    preset?: string;
    threads?: number;
    niceness?: number;
    ffmpegPath?: string;
    ffprobePath?: string;
  };
  limits: ProbeLimits;
  /** Reads the `video.ladder` setting. Falls back to the default ladder. */
  ladder?: () => Promise<RungSpec[]>;
  /** Seek preview sprites are on unless `enabled` says otherwise. */
  sprites?: { enabled?: () => Promise<boolean> };
  /** Hero preview clip limits. `maxBytes` exists so tests can force the oversize path. */
  preview?: { maxBytes?: number };
  logger?: Logger;
}

const SEGMENT_CACHE = 'public, max-age=31536000, immutable';
const PLAYLIST_CACHE = 'private, no-store';
const UPLOAD_CONCURRENCY = 4;
const PROGRESS_EVERY_MS = 2000;

/** Plain failure records for the queue wrapper and the mirror table. */
export function classifyPipelineError(error: unknown): ClassifiedFailure {
  const failure = toPipelineError(error);
  return {
    code: failure.code,
    plain: failure.plain,
    detail: failure.technical,
    permanent: failure.permanent,
  };
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** How many poster frames to offer, and how far (as a share of the duration) to move a frame that scores low. */
const POSTER_CANDIDATES = 6;
const POSTER_RETRY_SHIFT = 0.04;

async function scoreOrNull(frame: Buffer): Promise<number | null> {
  try {
    return (await scoreFrame(frame)).score;
  } catch {
    return null;
  }
}

export class VideoPipeline {
  private readonly runner: ProcessRunner;
  private readonly logger: Logger;

  constructor(private readonly deps: PipelineDeps) {
    this.runner = deps.runner ?? nodeRunner;
    this.logger = deps.logger ?? createLogger({ write: () => undefined });
  }

  private async mustLoad(videoId: string) {
    const [video] = await this.deps.db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) throw new PipelineError('unknown', `video ${videoId} not found`, true);
    return video;
  }

  private ffprobePath = () => this.deps.ffmpeg?.ffprobePath ?? 'ffprobe';
  private ffmpegPath = () => this.deps.ffmpeg?.ffmpegPath ?? 'ffmpeg';

  private async probeFile(path: string, container: Container): Promise<ProbeResult> {
    const result = await this.runner.run(this.ffprobePath(), ffprobeArgs(path, container), {
      timeoutMs: 120_000,
    });
    if (result.timedOut) throw new PipelineError('timeout', 'ffprobe timed out');
    if (result.code !== 0) {
      throw new PipelineError(
        'damaged_file',
        `ffprobe exited ${result.code}: ${result.stderr.slice(0, 500)}`,
      );
    }
    try {
      return parseFfprobe(JSON.parse(result.stdout));
    } catch (error) {
      throw new PipelineError(
        'unreadable_file',
        `ffprobe output unusable: ${(error as Error).message}`,
      );
    }
  }

  /** Downloads the source, checks the magic bytes and probes it. Shared by probe, encode and thumbnails. */
  private async fetchSource(videoId: string, dir: string) {
    const video = await this.mustLoad(videoId);
    if (!video.originalKey) throw new PipelineError('upload_incomplete', 'video has no original');
    const path = join(dir, 'source');
    try {
      await downloadTo(this.deps.originals, video.originalKey, path);
    } catch (error) {
      if (error instanceof NotFound)
        throw new PipelineError('upload_incomplete', 'original object missing');
      throw error;
    }
    const container = sniffContainer(await readHead(path, 64));
    if (!container)
      throw new PipelineError(
        'unsupported_format',
        'magic bytes did not match an allowed container',
      );
    const probe = await this.probeFile(path, container);
    const verdict = validateProbe(probe, container, this.deps.limits);
    if (!verdict.ok) throw new PipelineError(verdict.code, verdict.detail);
    return { video, path, container, probe, warnings: verdict.warnings };
  }

  /** `video.probe`: SECURITY section 8 step 4, then queue encoding and captions. */
  async probe(videoId: string, progress: ProgressFn): Promise<void> {
    const video = await this.mustLoad(videoId);
    await this.deps.db
      .update(videos)
      .set({ status: 'validating', failureCode: null, failureMessage: null, updatedAt: new Date() })
      .where(eq(videos.id, videoId));
    await progress('Reading file', 5);

    const found = await withScratch(
      this.deps.scratch,
      `probe-${videoId}`,
      video.originalBytes ?? 0,
      (dir) => this.fetchSource(videoId, dir),
    );
    for (const warning of found.warnings) this.logger.warn('probe warning', { videoId, warning });

    await this.deps.db
      .update(videos)
      .set({
        status: 'encoding',
        durationMs: found.probe.durationMs,
        width: found.probe.width,
        height: found.probe.height,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    await this.deps.producer.enqueue('video.encode', { videoId });
    if (found.probe.hasAudio) {
      // A script stored next to the video (bulk import, M15) keeps the author's wording and borrows the timing.
      const hasScript = await this.deps.originals.head(`scripts/${videoId}.txt`).then(
        (info) => info !== null,
        () => false,
      );
      await this.deps.producer
        .enqueue('caption.generate', { videoId, mode: hasScript ? 'align' : 'transcribe' })
        .catch((error: unknown) => {
          // Captions never block encoding. The admin can regenerate them from the caption screen.
          this.logger.warn('caption job not queued', { videoId, err: error });
        });
    }
    await progress('Done', 100);
  }

  /** Called by the queue wrapper once a job has failed for good. */
  async failVideo(videoId: string, failure: ClassifiedFailure): Promise<void> {
    const [video] = await this.deps.db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) return;
    const discard =
      failure.permanent &&
      [
        'unreadable_file',
        'damaged_file',
        'no_video_stream',
        'too_long',
        'bad_dimensions',
        'unsupported_format',
      ].includes(failure.code);
    await this.deps.db
      .update(videos)
      .set({
        status: 'failed',
        failureCode: failure.code,
        failureMessage: failure.plain,
        ...(discard ? { originalKey: null, originalBytes: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));
    if (discard && video.originalKey) {
      await this.deps.originals
        .delete(video.originalKey)
        .catch((err: unknown) => this.logger.warn('invalid source not deleted', { videoId, err }));
    }
  }

  /** Admin Retry: restart from the last good stage (M14-S06 AC3). */
  async retry(videoId: string, createdBy?: string): Promise<{ jobId: string }> {
    const video = await this.mustLoad(videoId);
    if (video.status !== 'failed') throw new Conflict('Only a failed video can be retried.');
    if (!video.originalKey)
      throw new Conflict('The source file was removed. Replace the file instead.');
    await this.deps.db
      .update(videos)
      .set({ status: 'uploaded', failureCode: null, failureMessage: null, updatedAt: new Date() })
      .where(eq(videos.id, videoId));
    const queue = video.durationMs ? 'video.encode' : 'video.probe';
    const result = await this.deps.producer.enqueue(queue, { videoId }, { createdBy });
    return { jobId: result.jobId };
  }

  private async ensureKey(videoId: string): Promise<Uint8Array> {
    const [row] = await this.deps.db
      .select()
      .from(videoKeys)
      .where(eq(videoKeys.videoId, videoId))
      .limit(1);
    if (row) return unwrapHlsKey(this.deps.keyring, videoId, row.keyWrapped);
    const key = generateHlsKey();
    const wrapped = wrapHlsKey(this.deps.keyring, videoId, key);
    await this.deps.db
      .insert(videoKeys)
      .values({ videoId, keyWrapped: wrapped.keyWrapped, kekVersion: wrapped.kekVersion })
      .onConflictDoNothing();
    const [stored] = await this.deps.db
      .select()
      .from(videoKeys)
      .where(eq(videoKeys.videoId, videoId))
      .limit(1);
    if (!stored) throw new PipelineError('key_failed', 'key row missing after insert');
    return unwrapHlsKey(this.deps.keyring, videoId, stored.keyWrapped);
  }

  /** Re-wraps a stored key under the current KEK, used after `HLS_KEK` rotation (`video.rekey`). */
  async rewrapKey(videoId: string): Promise<void> {
    const [row] = await this.deps.db
      .select()
      .from(videoKeys)
      .where(eq(videoKeys.videoId, videoId))
      .limit(1);
    if (!row) return;
    const key = unwrapHlsKey(this.deps.keyring, videoId, row.keyWrapped);
    const wrapped = wrapHlsKey(this.deps.keyring, videoId, key);
    await this.deps.db
      .update(videoKeys)
      .set({
        keyWrapped: wrapped.keyWrapped,
        kekVersion: wrapped.kekVersion,
        rotatedAt: new Date(),
      })
      .where(eq(videoKeys.videoId, videoId));
  }

  private async rungIsDone(
    video: { id: string; mediaPrefix: string },
    rung: PlannedRung,
    existing: typeof renditions.$inferSelect | undefined,
  ): Promise<boolean> {
    if (!existing || existing.status !== 'ready' || !existing.segmentCount || !existing.templateKey)
      return false;
    const stored = await this.deps.media.list(`v/${video.mediaPrefix}/${rung.height}/`);
    const template = await this.deps.originals.head(existing.templateKey);
    return stored.length === existing.segmentCount && template !== null;
  }

  /** `video.encode`: one rendition at a time, each a checkpoint that a retry skips (ARCHITECTURE section 8.2). */
  async encode(videoId: string, progress: ProgressFn): Promise<void> {
    const initial = await this.mustLoad(videoId);
    await this.deps.db
      .update(videos)
      .set({ status: 'encoding', failureCode: null, failureMessage: null, updatedAt: new Date() })
      .where(eq(videos.id, videoId));
    await progress('Reading file', 2);

    await withScratch(
      this.deps.scratch,
      `encode-${videoId}`,
      initial.originalBytes ?? 0,
      async (dir) => {
        const { video, path, container, probe } = await this.fetchSource(videoId, dir);
        const ladder = (await this.deps.ladder?.()) ?? DEFAULT_LADDER;
        const plan = planLadder(probe, ladder);

        const key = await this.ensureKey(videoId);
        const keyPath = join(dir, 'enc.key');
        await writeFile(keyPath, key, { mode: 0o600 });
        const keyInfoPath = join(dir, 'keyinfo.txt');
        await writeFile(keyInfoPath, `enc.key\n${keyPath}\n`, { mode: 0o600 });

        const existing = await this.deps.db
          .select()
          .from(renditions)
          .where(eq(renditions.videoId, videoId));
        const byHeight = new Map(existing.map((row) => [row.height, row]));
        const share = 90 / plan.length;
        let lastWrite = 0;

        for (const [index, rung] of plan.entries()) {
          const base = 5 + share * index;
          const stage = `Encoding ${rung.height}p`;
          const current = byHeight.get(rung.height);
          if (await this.rungIsDone(video, rung, current)) {
            await progress(stage, base + share);
            continue;
          }
          await progress(stage, base);
          await this.deps.db
            .insert(renditions)
            .values({
              videoId,
              height: rung.height,
              width: rung.width,
              videoKbps: rung.videoKbps,
              audioKbps: rung.audioKbps,
              status: 'encoding',
            })
            .onConflictDoUpdate({
              target: [renditions.videoId, renditions.height],
              set: {
                width: rung.width,
                videoKbps: rung.videoKbps,
                audioKbps: rung.audioKbps,
                status: 'encoding',
                errorMessage: null,
                updatedAt: new Date(),
              },
            });

          const outDir = join(dir, String(rung.height));
          await mkdir(outDir, { recursive: true });
          const parser = new ProgressParser();
          const result = await this.runner.run(
            this.ffmpegPath(),
            encodeRungArgs({
              input: path,
              container,
              outDir,
              rung,
              hasAudio: probe.hasAudio,
              keyInfoPath,
              preset: this.deps.ffmpeg?.preset ?? 'medium',
              threads: this.deps.ffmpeg?.threads ?? 0,
            }),
            {
              niceness: this.deps.ffmpeg?.niceness ?? 10,
              timeoutMs: 3 * 3600 * 1000,
              onStdout: (chunk) => {
                const ms = parser.feed(chunk);
                if (ms === null || Date.now() - lastWrite < PROGRESS_EVERY_MS) return;
                lastWrite = Date.now();
                const fraction = Math.min(1, ms / probe.durationMs);
                void progress(stage, base + share * 0.9 * fraction).catch(() => undefined);
              },
            },
          );
          if (result.timedOut)
            throw new PipelineError('timeout', `ffmpeg timed out on ${rung.height}p`);
          if (result.code !== 0) {
            await this.deps.db
              .update(renditions)
              .set({
                status: 'failed',
                errorMessage: result.stderr.slice(0, 1000),
                updatedAt: new Date(),
              })
              .where(and(eq(renditions.videoId, videoId), eq(renditions.height, rung.height)));
            throw new PipelineError(
              'encode_failed',
              `ffmpeg exited ${result.code} on ${rung.height}p: ${result.stderr.slice(0, 500)}`,
            );
          }

          await progress('Uploading', base + share * 0.9);
          await this.publishRung(video, rung, probe, outDir);
          await progress(stage, base + share);
        }

        await progress('Packaging', 96);
        const ready = await this.deps.db
          .select()
          .from(renditions)
          .where(and(eq(renditions.videoId, videoId), eq(renditions.status, 'ready')))
          .orderBy(asc(renditions.height));
        const wanted = new Set(plan.map((rung) => rung.height));
        const final = ready.filter((row) => wanted.has(row.height));
        if (final.length !== plan.length)
          throw new PipelineError('encode_failed', 'not every rendition finished');
        const master: MasterRung[] = final.map((row) => ({
          height: row.height,
          width: row.width,
          bandwidthBps: row.bandwidthBps ?? 0,
          avgBandwidthBps: row.avgBandwidthBps ?? 0,
          codecs: row.codecs ?? codecsFor({ height: row.height, profile: 'main' }, probe.hasAudio),
        }));
        await this.deps.originals.put(
          `templates/${videoId}/master.m3u8`,
          new TextEncoder().encode(buildMasterTemplate(master)),
          { contentType: 'application/vnd.apple.mpegurl', cacheControl: PLAYLIST_CACHE },
        );

        await this.deps.db
          .update(videos)
          .set({
            status: 'ready',
            durationMs: probe.durationMs,
            width: probe.width,
            height: probe.height,
            failureCode: null,
            failureMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      },
    );

    // Poster candidates are best effort and never block a ready video (M13-S08 error case).
    await this.deps.producer.enqueue('video.thumbnails', { videoId }).catch((error: unknown) => {
      this.logger.warn('thumbnail job not queued', { videoId, err: error });
    });
    await progress('Done', 100);
  }

  private async publishRung(
    video: { id: string; mediaPrefix: string },
    rung: PlannedRung,
    probe: ProbeResult,
    outDir: string,
  ): Promise<void> {
    const text = await readFile(join(outDir, 'index.m3u8'), 'utf8');
    const { segments } = parseMediaPlaylist(text);
    const sized: { name: string; path: string; bytes: number; seconds: number }[] = [];
    for (const segment of segments) {
      const path = join(outDir, segment.name);
      sized.push({ ...segment, path, bytes: (await stat(path)).size });
    }

    await mapLimit(sized, UPLOAD_CONCURRENCY, async (segment) => {
      const key = `v/${video.mediaPrefix}/${rung.height}/${segment.name}`;
      const head = await this.deps.media.head(key);
      if (head && head.bytes === segment.bytes) return;
      await this.deps.media.put(key, createReadStream(segment.path), {
        contentType: 'video/mp2t',
        cacheControl: SEGMENT_CACHE,
      });
    });

    const templateKey = `templates/${video.id}/${rung.height}.m3u8`;
    await this.deps.originals.put(
      templateKey,
      new TextEncoder().encode(buildVariantTemplate({ videoId: video.id, segments })),
      { contentType: 'application/vnd.apple.mpegurl', cacheControl: PLAYLIST_CACHE },
    );

    const bandwidth = segmentBandwidths(sized);
    await this.deps.db
      .update(renditions)
      .set({
        status: 'ready',
        bandwidthBps: bandwidth.peak,
        avgBandwidthBps: bandwidth.average,
        codecs: codecsFor(rung, probe.hasAudio),
        segmentCount: sized.length,
        totalBytes: sized.reduce((sum, segment) => sum + segment.bytes, 0),
        templateKey,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(and(eq(renditions.videoId, video.id), eq(renditions.height, rung.height)));
  }

  /**
   * `video.thumbnails`: six poster candidates at evenly spaced points (M36-S01). Each frame gets a score for light,
   * contrast and sharpness. A frame that scores low is tried again at two nearby points and the best one is kept, so
   * a black frame between scenes does not become a candidate. The best scoring frame is the default poster.
   */
  async thumbnails(videoId: string, progress: ProgressFn): Promise<void> {
    const prior = await this.deps.db
      .select({ id: assets.id })
      .from(assets)
      .where(like(assets.rawKey, `candidates/${videoId}/%`));
    if (prior.length >= 3) return;

    const initial = await this.mustLoad(videoId);
    await withScratch(
      this.deps.scratch,
      `thumbs-${videoId}`,
      initial.originalBytes ?? 0,
      async (dir) => {
        const { path, container, probe } = await this.fetchSource(videoId, dir);
        const seconds = probe.durationMs / 1000;
        const last = Math.max(seconds - 0.5, 0);
        const clampAt = (at: number) => Math.min(Math.max(at, 0), last);

        // Extract and score every frame first, so a failure part way leaves nothing behind.
        const frames: { bytes: Buffer; score: number | null }[] = [];
        for (let slot = 0; slot < POSTER_CANDIDATES; slot++) {
          await progress('Making thumbnails', 5 + Math.round((slot / POSTER_CANDIDATES) * 70));
          const base = (seconds * (slot + 0.5)) / POSTER_CANDIDATES;
          const nearby = [0, seconds * POSTER_RETRY_SHIFT, -seconds * POSTER_RETRY_SHIFT];
          let best: { bytes: Buffer; score: number | null } | null = null;
          for (const [attempt, shift] of nearby.entries()) {
            const frame = await this.extractFrame(
              dir,
              path,
              container,
              clampAt(base + shift),
              `${slot + 1}-${attempt}`,
            );
            const scored = { bytes: frame, score: await scoreOrNull(frame) };
            if (best === null || (scored.score ?? -1) > (best.score ?? -1)) best = scored;
            // An unreadable frame cannot be improved by moving, and a good one needs no retry.
            if (scored.score === null || scored.score >= LOW_FRAME_SCORE) break;
          }
          frames.push(best!);
        }

        const created: { id: string; score: number | null }[] = [];
        for (const [index, frame] of frames.entries()) {
          const assetId = uuidv7();
          const rawKey = `candidates/${videoId}/${index + 1}`;
          await this.deps.originals.put(rawKey, frame.bytes, { contentType: 'image/webp' });
          await this.deps.db.insert(assets).values({
            id: assetId,
            purpose: 'thumbnail',
            status: 'processing',
            rawKey,
            mime: 'image/webp',
            bytes: frame.bytes.length,
            sha256: createHash('sha256').update(frame.bytes).digest(),
            candidateScore: frame.score,
          });
          await this.deps.producer.enqueue('image.process', { assetId });
          created.push({ id: assetId, score: frame.score });
        }
        // The best frame is the default poster until an admin picks another. Ties go to the frame nearest the middle.
        const middle = (POSTER_CANDIDATES - 1) / 2;
        const ranked = created
          .map((c, index) => ({ ...c, index }))
          .sort(
            (a, b) =>
              (b.score ?? -1) - (a.score ?? -1) ||
              Math.abs(a.index - middle) - Math.abs(b.index - middle) ||
              a.index - b.index,
          );
        await this.deps.db
          .update(videos)
          .set({ posterAssetId: ranked[0]!.id, updatedAt: new Date() })
          .where(and(eq(videos.id, videoId), sql`${videos.posterAssetId} IS NULL`));
        // Sprites are optional and never fail the job (M08-S29 error case: sprite failure is silent).
        try {
          if (await this.spritesEnabled())
            await this.makeSprites(dir, path, container, probe, initial);
        } catch (error) {
          this.logger.warn('sprite sheets failed', { videoId, err: error });
        }
      },
    );
    await this.queuePreview(videoId);
  }

  /** Marks a video as waiting for its hero clip and queues the job. Best effort, a failure only logs. */
  async queuePreview(videoId: string, payload: { mode?: 'auto' | 'picked'; startMs?: number } = {}): Promise<void> {
    try {
      const video = await this.mustLoad(videoId);
      if (video.previewMode === 'off') return;
      await this.deps.db
        .update(videos)
        .set({ previewState: 'queued', updatedAt: new Date() })
        .where(eq(videos.id, videoId));
      await this.deps.producer.enqueue('video.preview', { videoId, ...payload });
    } catch (error) {
      this.logger.warn('preview job not queued', { videoId, err: error });
    }
  }

  /** Hourly backfill: queues clips for published videos that have none. Returns how many were queued. */
  sweepPreviews(limit?: number): Promise<number> {
    return sweepPreviews({ db: this.deps.db, producer: this.deps.producer }, limit);
  }

  private async setPreview(videoId: string, fields: Partial<typeof videos.$inferInsert>): Promise<void> {
    await this.deps.db
      .update(videos)
      .set({ previewUpdatedAt: new Date(), updatedAt: new Date(), ...fields })
      .where(eq(videos.id, videoId));
  }

  /**
   * `video.preview`: a six second silent clip for the Home hero (M41). It never fails the video. A clip that cannot
   * be made leaves the state `skipped` (nothing wrong with the video) or `failed` (a plain note for the editor), and
   * the hero falls back to the poster. A recut writes a new content hashed file, updates the row, then removes the old one.
   */
  async previewClip(
    videoId: string,
    opts: { mode?: 'auto' | 'picked'; startMs?: number } = {},
    progress: ProgressFn,
  ): Promise<void> {
    const video = await this.mustLoad(videoId);
    const mode = opts.mode ?? (video.previewMode === 'picked' ? 'picked' : 'auto');
    if (video.previewMode === 'off') return;
    const requestedStart = opts.startMs ?? video.previewStartMs ?? undefined;
    const maxBytes = this.deps.preview?.maxBytes ?? PREVIEW_MAX_BYTES;
    try {
      await progress('Making preview', 5);
      const outcome = await withScratch(
        this.deps.scratch,
        `preview-${videoId}`,
        video.originalBytes ?? 0,
        async (dir) => {
          const { path, container, probe } = await this.fetchSource(videoId, dir);
          const plan = planPreview({ durationMs: probe.durationMs, mode, startMs: requestedStart });
          if (plan.kind === 'skip') return { skip: plan.reason } as const;

          let startMs = plan.startMs;
          if (mode !== 'picked' || plan.candidates.length > 1) {
            const middle = (plan.candidates.length - 1) / 2;
            const scored: { start: number; score: number | null; index: number }[] = [];
            for (const [index, start] of plan.candidates.entries()) {
              const at = Math.min(start + previewScoreOffsetMs, Math.max(probe.durationMs / 1000 - 0.5, 0) * 1000);
              const frame = await this.extractFrame(dir, path, container, at / 1000, `preview-${index}`);
              scored.push({ start, score: await scoreOrNull(frame), index });
            }
            scored.sort(
              (a, b) =>
                (b.score ?? -1) - (a.score ?? -1) ||
                Math.abs(a.index - middle) - Math.abs(b.index - middle) ||
                a.index - b.index,
            );
            const best = scored[0]!;
            if (best.score === null || best.score < LOW_FRAME_SCORE)
              return { skip: 'The video looks too dark or plain for a clip' } as const;
            startMs = best.start;
          }

          await progress('Making preview', 40);
          const output = join(dir, 'preview.mp4');
          let bytes: Buffer | null = null;
          for (const crf of [PREVIEW_CRF, PREVIEW_RETRY_CRF]) {
            const result = await this.runner.run(
              this.ffmpegPath(),
              previewArgs({ input: path, container, startMs, lengthMs: plan.lengthMs, output, crf }),
              { timeoutMs: 5 * 60_000, niceness: this.deps.ffmpeg?.niceness ?? 10 },
            );
            if (result.code !== 0)
              throw new PipelineError('encode_failed', `preview: ${result.stderr.slice(0, 300)}`);
            const made = await readFile(output);
            if (made.length <= maxBytes) {
              bytes = made;
              break;
            }
          }
          if (!bytes) return { fail: 'The clip came out too large' } as const;
          return { bytes, startMs } as const;
        },
      );

      if ('skip' in outcome) {
        await this.setPreview(videoId, { previewState: 'skipped', previewNote: outcome.skip });
        return;
      }
      if ('fail' in outcome) {
        await this.setPreview(videoId, { previewState: 'failed', previewNote: outcome.fail });
        return;
      }
      await progress('Saving preview', 85);
      const key = previewKey(video.mediaPrefix, outcome.startMs, outcome.bytes);
      await this.deps.media.put(key, outcome.bytes, { contentType: 'video/mp4', cacheControl: SEGMENT_CACHE });
      await this.setPreview(videoId, {
        previewKey: key,
        previewState: 'ready',
        previewStartMs: outcome.startMs,
        previewBytes: outcome.bytes.length,
        previewNote: null,
      });
      if (video.previewKey && video.previewKey !== key)
        await this.deps.media.delete(video.previewKey).catch((error: unknown) => {
          this.logger.warn('old preview not removed', { videoId, err: error });
        });
      await progress('Done', 100);
    } catch (error) {
      const failure = toPipelineError(error);
      if (failure.code === 'upload_incomplete') {
        await this.setPreview(videoId, {
          previewState: 'skipped',
          previewNote: 'The original file is no longer stored',
        });
        return;
      }
      this.logger.warn('preview clip failed', { videoId, err: error });
      await this.setPreview(videoId, {
        previewState: 'failed',
        previewNote: 'The clip could not be made. Try again later',
      });
    }
  }

  private async extractFrame(
    dir: string,
    input: string,
    container: Container,
    atSeconds: number,
    name: string,
  ): Promise<Buffer> {
    const output = join(dir, `thumb-${name}.webp`);
    const result = await this.runner.run(
      this.ffmpegPath(),
      thumbnailArgs({ input, container, atSeconds, width: 1280, output }),
      { timeoutMs: 120_000, niceness: this.deps.ffmpeg?.niceness ?? 10 },
    );
    if (result.code !== 0)
      throw new PipelineError('encode_failed', `thumbnail ${name}: ${result.stderr.slice(0, 300)}`);
    return readFile(output);
  }

  private spritesEnabled = async () => (await this.deps.sprites?.enabled?.()) ?? true;

  /** Cuts one frame per interval, packs them into sheets and uploads the sheets and a WebVTT map to `cap/`. */
  private async makeSprites(
    dir: string,
    source: string,
    container: Container,
    probe: ProbeResult,
    video: { id: string; mediaPrefix: string; spriteKey: string | null },
  ): Promise<void> {
    if (video.spriteKey) return;
    const plan = planSprite({
      durationSeconds: probe.durationMs / 1000,
      width: probe.width,
      height: probe.height,
    });
    if (!plan) return;
    const outDir = join(dir, 'sprites');
    await mkdir(outDir, { recursive: true });
    const result = await this.runner.run(
      this.ffmpegPath(),
      spriteArgs({ input: source, container, plan, outputPattern: join(outDir, 'sheet-%03d.jpg') }),
      { timeoutMs: 15 * 60_000, niceness: this.deps.ffmpeg?.niceness ?? 10 },
    );
    if (result.code !== 0)
      throw new PipelineError('encode_failed', `sprites: ${result.stderr.slice(0, 300)}`);
    const files = (await readdir(outDir)).filter((name) => name.endsWith('.jpg')).sort();
    if (files.length === 0) throw new PipelineError('encode_failed', 'sprites: no sheets written');

    const base = `cap/${video.mediaPrefix}/sprites/`;
    const names: string[] = [];
    for (const [index, file] of files.entries()) {
      const bytes = await readFile(join(outDir, file));
      const name = `sheet-${index + 1}-${createHash('sha256').update(bytes).digest('hex').slice(0, 8)}.jpg`;
      await this.deps.media.put(`${base}${name}`, bytes, {
        contentType: 'image/jpeg',
        cacheControl: SEGMENT_CACHE,
      });
      names.push(name);
    }
    const covered = {
      ...plan,
      frames: Math.min(plan.frames, names.length * plan.perSheet),
      sheets: names.length,
    };
    const vtt = Buffer.from(buildSpriteVtt(covered, probe.durationMs / 1000, names));
    const key = `${base}map-${createHash('sha256').update(vtt).digest('hex').slice(0, 8)}.vtt`;
    await this.deps.media.put(key, vtt, {
      contentType: 'text/vtt; charset=utf-8',
      cacheControl: SEGMENT_CACHE,
    });
    await this.deps.db
      .update(videos)
      .set({ spriteKey: key, updatedAt: new Date() })
      .where(eq(videos.id, video.id));
  }
}
