import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { schema, type Database } from '@ad/db';
import type { ClassifiedFailure, JobProducer } from '@ad/queue';
import { Conflict, NotFound, createLogger, uuidv7, type Logger } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, asc, eq, like, sql } from 'drizzle-orm';
import { PipelineError, toPipelineError } from '../failure';
import { generateHlsKey, unwrapHlsKey, wrapHlsKey, type Keyring } from '../hls-key';
import { DEFAULT_LADDER, codecsFor, planLadder, type PlannedRung, type RungSpec } from '../ladder';
import { sniffContainer, type Container } from '../magic';
import {
  buildMasterTemplate,
  buildVariantTemplate,
  parseMediaPlaylist,
  type MasterRung,
} from '../playlist';
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
      await this.deps.producer
        .enqueue('caption.generate', { videoId, mode: 'transcribe' })
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

  /** `video.thumbnails`: three poster candidates at 10, 50 and 90 percent (ARCHITECTURE section 13). */
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
        const width = 1280;
        const height = Math.max(2, 2 * Math.round((width * probe.height) / probe.width / 2));
        const created: string[] = [];
        for (const [index, fraction] of [0.1, 0.5, 0.9].entries()) {
          await progress('Making thumbnails', 10 + index * 30);
          const output = join(dir, `thumb-${index + 1}.webp`);
          const at = Math.min(Math.max(seconds * fraction, 0), Math.max(seconds - 0.5, 0));
          const result = await this.runner.run(
            this.ffmpegPath(),
            thumbnailArgs({ input: path, container, atSeconds: at, width, output }),
            { timeoutMs: 120_000, niceness: this.deps.ffmpeg?.niceness ?? 10 },
          );
          if (result.code !== 0)
            throw new PipelineError(
              'encode_failed',
              `thumbnail ${index + 1}: ${result.stderr.slice(0, 300)}`,
            );
          const bytes = await readFile(output);
          const assetId = uuidv7();
          const rawKey = `candidates/${videoId}/${index + 1}`;
          await this.deps.originals.put(rawKey, bytes, { contentType: 'image/webp' });
          await this.deps.db.insert(assets).values({
            id: assetId,
            purpose: 'thumbnail',
            status: 'processing',
            rawKey,
            mime: 'image/webp',
            bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest(),
          });
          await this.deps.producer.enqueue('image.process', { assetId });
          created.push(assetId);
        }
        // The middle frame is the default poster until an admin picks another.
        await this.deps.db
          .update(videos)
          .set({ posterAssetId: created[1], updatedAt: new Date() })
          .where(and(eq(videos.id, videoId), sql`${videos.posterAssetId} IS NULL`));
      },
    );
  }
}
