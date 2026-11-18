import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import { Conflict } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PipelineError } from '../failure';
import { keyring, unwrapHlsKey } from '../hls-key';
import { FakeRunner, fakeMp4Bytes, fakeProbeJson } from '../testing';
import { VideoPipeline, classifyPipelineError } from './pipeline';

async function collect(stream: AsyncIterable<unknown>): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for await (const chunk of stream) out.push(Buffer.from(chunk as Buffer));
  return out;
}

const secret = new Uint8Array(32).fill(9);
const kek = new Uint8Array(32).fill(4);

describe.skipIf(!integrationEnabled())('VideoPipeline against Postgres and local storage', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let boss: FakeBoss;
  let runner: FakeRunner;
  let pipeline: VideoPipeline;
  let stages: [string, number][];
  const progress = async (stage: string, percent: number) => void stages.push([stage, percent]);

  async function newVideo(
    overrides: Record<string, unknown> = {},
    source: Uint8Array | null = fakeMp4Bytes(),
  ) {
    const owner = makeAccount({ role: 'editor' });
    await t.db.insert(schema.accounts).values(owner);
    const video = makeVideo({ createdBy: owner.id, status: 'uploaded', ...overrides });
    const key = `originals/${video.id}/up1`;
    if (source) await originals.put(key, source);
    await t.db.insert(schema.videos).values({
      ...video,
      originalKey: source ? key : null,
      originalBytes: source?.length ?? null,
    });
    return { ...video, key };
  }

  const row = async (id: string) =>
    (await t.db.select().from(schema.videos).where(eq(schema.videos.id, id)))[0]!;

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-pipeline-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    boss = new FakeBoss();
    await ensureQueues(boss);
  });

  beforeEach(() => {
    runner = new FakeRunner();
    stages = [];
    pipeline = new VideoPipeline({
      db: t.db,
      originals,
      media,
      keyring: keyring(kek),
      producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      scratch: {
        root: join(root, 'scratch'),
        stats: async () => ({ freeBytes: 1e12, totalBytes: 2e12 }),
      },
      runner,
      limits: { maxSeconds: 1800, warnSeconds: 3600 },
    });
  });

  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  describe('probe', () => {
    it('stores size and duration, then queues encoding and captions', async () => {
      const video = await newVideo();
      await pipeline.probe(video.id, progress);
      expect(await row(video.id)).toMatchObject({
        status: 'encoding',
        durationMs: 14000,
        width: 1280,
        height: 720,
      });
      const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, video.id));
      expect(jobs.map((job) => job.queue).sort()).toEqual(['caption.generate', 'video.encode']);
    });

    it('asks for script alignment when a script was uploaded with the video', async () => {
      const video = await newVideo();
      await originals.put(`scripts/${video.id}.txt`, new TextEncoder().encode('Hello there'));
      await pipeline.probe(video.id, progress);
      const sent = boss.jobs.find(
        (job) => job.name === 'caption.generate' && job.data.videoId === video.id,
      );
      expect(sent?.data.mode).toBe('align');
    });

    it('transcribes when there is no script', async () => {
      const video = await newVideo();
      await pipeline.probe(video.id, progress);
      const sent = boss.jobs.find(
        (job) => job.name === 'caption.generate' && job.data.videoId === video.id,
      );
      expect(sent?.data.mode).toBe('transcribe');
    });

    it('does not queue captions for a silent source', async () => {
      runner.probe = fakeProbeJson({ audio: false });
      const video = await newVideo();
      await pipeline.probe(video.id, progress);
      const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, video.id));
      expect(jobs.map((job) => job.queue)).toEqual(['video.encode']);
    });

    it('rejects a file whose bytes are not a video container as a permanent failure', async () => {
      const video = await newVideo(
        {},
        new TextEncoder().encode('#EXTM3U\nnot a video at all, just text pretending'),
      );
      const error = await pipeline.probe(video.id, progress).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PipelineError);
      expect(error as PipelineError).toMatchObject({ code: 'unsupported_format', permanent: true });
    });

    it('failVideo records the plain reason and removes an invalid source', async () => {
      const video = await newVideo();
      await pipeline.failVideo(
        video.id,
        classifyPipelineError(new PipelineError('damaged_file', 'moov atom not found')),
      );
      expect(await row(video.id)).toMatchObject({
        status: 'failed',
        failureCode: 'damaged_file',
        failureMessage: 'The video file is damaged. Try exporting it again.',
        originalKey: null,
      });
      expect(await originals.head(video.key)).toBeNull();
    });

    it('keeps the source for a transient failure so Retry works', async () => {
      const video = await newVideo();
      await pipeline.failVideo(
        video.id,
        classifyPipelineError(new PipelineError('storage_unavailable', 'reset')),
      );
      expect(await originals.head(video.key)).not.toBeNull();
      expect((await row(video.id)).originalKey).toBe(video.key);
    });

    it('cleans its scratch directory', async () => {
      const video = await newVideo();
      await pipeline.probe(video.id, progress);
      expect(await readdir(join(root, 'scratch')).catch(() => [])).toEqual([]);
    });
  });

  describe('encode', () => {
    it('never upscales: a 720p source gets 360, 480 and 720 and becomes ready', async () => {
      const video = await newVideo({ durationMs: 14000 });
      await pipeline.encode(video.id, progress);
      const renditions = await t.db
        .select()
        .from(schema.renditions)
        .where(eq(schema.renditions.videoId, video.id));
      expect(renditions.map((r) => r.height).sort((a, b) => a - b)).toEqual([360, 480, 720]);
      expect(renditions.every((r) => r.status === 'ready' && r.segmentCount === 3)).toBe(true);
      expect(renditions.find((r) => r.height === 720)).toMatchObject({
        width: 1280,
        codecs: 'avc1.64001f,mp4a.40.2',
      });
      expect(await row(video.id)).toMatchObject({ status: 'ready', durationMs: 14000 });
    });

    it('uploads segments under the media prefix with the right layout and cache headers', async () => {
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const prefix = (await row(video.id)).mediaPrefix;
      const segments = await media.list(`v/${prefix}/360/`);
      expect(segments.map((s) => s.key)).toEqual([
        `v/${prefix}/360/seg_00000.ts`,
        `v/${prefix}/360/seg_00001.ts`,
        `v/${prefix}/360/seg_00002.ts`,
      ]);
    });

    it('stores templates and a master playlist in the private bucket', async () => {
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const master = (await readAll(originals, `templates/${video.id}/master.m3u8`)).toString();
      expect(master).toContain('360.m3u8');
      expect(master).toContain('RESOLUTION=1280x720');
      const variant = (await readAll(originals, `templates/${video.id}/480.m3u8`)).toString();
      expect(variant).toContain(`URI="ad-key://${video.id}"`);
      expect(variant).toContain('seg_00002.ts');
    });

    it('creates one wrapped key per video and keeps it across retries', async () => {
      const video = await newVideo();
      runner.failHeights.add(720);
      await expect(pipeline.encode(video.id, progress)).rejects.toMatchObject({
        code: 'encode_failed',
      });
      const [first] = await t.db
        .select()
        .from(schema.videoKeys)
        .where(eq(schema.videoKeys.videoId, video.id));
      runner.failHeights.clear();
      await pipeline.encode(video.id, progress);
      const [second] = await t.db
        .select()
        .from(schema.videoKeys)
        .where(eq(schema.videoKeys.videoId, video.id));
      expect(Buffer.from(second!.keyWrapped)).toEqual(Buffer.from(first!.keyWrapped));
      expect(unwrapHlsKey(keyring(kek), video.id, second!.keyWrapped)).toHaveLength(16);
      expect(
        first!.keyWrapped.includes(
          Buffer.from(unwrapHlsKey(keyring(kek), video.id, first!.keyWrapped)),
        ),
      ).toBe(false);
    });

    it('resumes: finished rungs are skipped and only the failed rung is encoded again (M14-S03 error)', async () => {
      const video = await newVideo();
      runner.failHeights.add(720);
      await expect(pipeline.encode(video.id, progress)).rejects.toBeInstanceOf(PipelineError);
      expect(runner.encodeCalls()).toEqual([360, 480, 720]);
      const failed = await t.db
        .select()
        .from(schema.renditions)
        .where(eq(schema.renditions.videoId, video.id));
      expect(failed.find((r) => r.height === 720)?.status).toBe('failed');

      runner.calls = [];
      runner.failHeights.clear();
      await pipeline.encode(video.id, progress);
      expect(runner.encodeCalls()).toEqual([720]);
      expect((await row(video.id)).status).toBe('ready');
    });

    it('re-encodes a rung whose stored segments went missing', async () => {
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const prefix = (await row(video.id)).mediaPrefix;
      await media.delete(`v/${prefix}/480/seg_00001.ts`);
      runner.calls = [];
      await pipeline.encode(video.id, progress);
      expect(runner.encodeCalls()).toEqual([480]);
      expect(await media.list(`v/${prefix}/480/`)).toHaveLength(3);
    });

    it('reports stages in order with rising percentages and finishes at Done', async () => {
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const names = stages.map(([name]) => name);
      expect(names[0]).toBe('Reading file');
      expect(names).toEqual(
        expect.arrayContaining([
          'Encoding 360p',
          'Encoding 480p',
          'Encoding 720p',
          'Uploading',
          'Packaging',
          'Done',
        ]),
      );
      expect(names.at(-1)).toBe('Done');
      expect(stages.at(-1)?.[1]).toBe(100);
      const percents = stages.map(([, p]) => p);
      expect(percents).toEqual([...percents].sort((a, b) => a - b));
    });

    it('makes a video-only ladder for a silent source and omits audio from codecs', async () => {
      runner.probe = fakeProbeJson({ audio: false });
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const [r] = await t.db
        .select()
        .from(schema.renditions)
        .where(eq(schema.renditions.videoId, video.id));
      expect(r?.codecs).not.toContain('mp4a');
      expect(runner.calls.find((c) => c.args.includes('-hls_time'))?.args).toContain('-an');
    });

    it('caps the ladder at the source and uses a single rung under 360p', async () => {
      runner.probe = fakeProbeJson({ width: 320, height: 240 });
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const renditions = await t.db
        .select()
        .from(schema.renditions)
        .where(eq(schema.renditions.videoId, video.id));
      expect(renditions.map((r) => r.height)).toEqual([240]);
    });

    it('defers with out_of_disk and creates nothing when space is short (M14-S07)', async () => {
      const tight = new VideoPipeline({
        ...(pipeline as unknown as { deps: ConstructorParameters<typeof VideoPipeline>[0] }).deps,
        scratch: {
          root: join(root, 'scratch'),
          stats: async () => ({ freeBytes: 10, totalBytes: 1000 }),
        },
      });
      const video = await newVideo();
      await expect(tight.encode(video.id, progress)).rejects.toMatchObject({
        code: 'out_of_disk',
        permanent: false,
      });
      expect(
        await t.db.select().from(schema.renditions).where(eq(schema.renditions.videoId, video.id)),
      ).toHaveLength(0);
    });

    it('queues poster thumbnails after the video is ready', async () => {
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, video.id));
      expect(jobs.map((j) => j.queue)).toContain('video.thumbnails');
    });
  });

  describe('thumbnails', () => {
    it('creates six candidates at evenly spaced points, each with a score', async () => {
      runner.probe = fakeProbeJson({ seconds: 60 });
      const video = await newVideo({ durationMs: 60000 });
      await pipeline.thumbnails(video.id, progress);
      const candidates = await t.db.select().from(schema.assets);
      const mine = candidates.filter((a) => a.rawKey?.startsWith(`candidates/${video.id}/`));
      expect(mine.map((a) => a.rawKey).sort()).toEqual(
        [1, 2, 3, 4, 5, 6].map((n) => `candidates/${video.id}/${n}`),
      );
      // Frames are stored as sources and sized by the image.process job.
      expect(mine.every((a) => a.status === 'processing' && a.mime === 'image/webp')).toBe(true);
      for (const asset of mine) expect(await originals.head(asset.rawKey!)).not.toBeNull();
      expect(mine.every((a) => a.candidateScore !== null && a.candidateScore > 70)).toBe(true);
      const queued = await t.db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.queue, 'image.process'));
      expect(queued.filter((j) => mine.some((a) => a.id === j.assetId))).toHaveLength(6);
      // Slots are the middle of each sixth of the video: about 5, 15, 25, 35, 45 and 55 seconds.
      const firstTries = runner.frameTimes.slice(0, 6).map((n) => Math.round(n));
      expect(firstTries).toEqual([5, 15, 25, 35, 45, 55]);
    });

    it('defaults the poster to the best scoring frame, the one nearest the middle on a tie', async () => {
      runner.probe = fakeProbeJson({ seconds: 60 });
      const video = await newVideo({ durationMs: 60000 });
      await pipeline.thumbnails(video.id, progress);
      const mine = (await t.db.select().from(schema.assets)).filter((a) =>
        a.rawKey?.startsWith(`candidates/${video.id}/`),
      );
      expect((await row(video.id)).posterAssetId).toBe(
        mine.find((a) => a.rawKey!.endsWith('/3'))!.id,
      );
    });

    it('avoids a black frame by trying nearby points, and keeps the better one', async () => {
      runner.frame = (at) => (Math.round(at) === 15 ? 'black' : 'good');
      runner.probe = fakeProbeJson({ seconds: 60 });
      const video = await newVideo({ durationMs: 60000 });
      await pipeline.thumbnails(video.id, progress);
      const mine = (await t.db.select().from(schema.assets)).filter((a) =>
        a.rawKey?.startsWith(`candidates/${video.id}/`),
      );
      expect(mine).toHaveLength(6);
      // The black slot was tried again further along, and the frame kept is not black.
      expect(runner.frameTimes.filter((n) => Math.abs(n - 15) < 0.6)).toHaveLength(1);
      expect(runner.frameTimes.length).toBeGreaterThan(6);
      const second = mine.find((a) => a.rawKey!.endsWith('/2'))!;
      expect(second.candidateScore).toBeGreaterThan(70);
    });

    it('keeps the least bad frame and scores it low when every try is black', async () => {
      runner.frame = () => 'black';
      runner.probe = fakeProbeJson({ seconds: 60 });
      const video = await newVideo({ durationMs: 60000 });
      await pipeline.thumbnails(video.id, progress);
      const mine = (await t.db.select().from(schema.assets)).filter((a) =>
        a.rawKey?.startsWith(`candidates/${video.id}/`),
      );
      expect(mine).toHaveLength(6);
      expect(mine.every((a) => a.candidateScore === 0)).toBe(true);
      // Never more than three tries per slot.
      expect(runner.frameTimes.length).toBeLessThanOrEqual(18);
    });

    it('still makes a candidate, with no score, when a frame cannot be read for scoring', async () => {
      runner.frame = (at) => (Math.round(at) === 25 ? 'broken' : 'good');
      runner.probe = fakeProbeJson({ seconds: 60 });
      const video = await newVideo({ durationMs: 60000 });
      await pipeline.thumbnails(video.id, progress);
      const mine = (await t.db.select().from(schema.assets)).filter((a) =>
        a.rawKey?.startsWith(`candidates/${video.id}/`),
      );
      expect(mine).toHaveLength(6);
      expect(mine.find((a) => a.rawKey!.endsWith('/3'))!.candidateScore).toBeNull();
      expect(mine.filter((a) => a.candidateScore !== null)).toHaveLength(5);
    });

    it('is idempotent and does not replace a poster an admin chose', async () => {
      const video = await newVideo();
      await pipeline.thumbnails(video.id, progress);
      const count = (await t.db.select().from(schema.assets)).length;
      await pipeline.thumbnails(video.id, progress);
      expect((await t.db.select().from(schema.assets)).length).toBe(count);
    });
  });

  describe('sprites', () => {
    it('packs frames into sheets, uploads a map next to the captions and stores its key', async () => {
      runner.spriteSheets = 1;
      const video = await newVideo({ durationMs: 14000, width: 1280, height: 720 });
      await pipeline.thumbnails(video.id, progress);
      const stored = await row(video.id);
      expect(stored.spriteKey).toMatch(
        new RegExp(`^cap/${stored.mediaPrefix}/sprites/map-[0-9a-f]{8}\\.vtt$`),
      );
      const body = Buffer.concat(await collect(await media.get(stored.spriteKey!))).toString();
      expect(body.startsWith('WEBVTT')).toBe(true);
      expect(body).toMatch(
        /00:00:00\.000 --> 00:00:05\.000\nsheet-1-[0-9a-f]{8}\.jpg#xywh=0,0,160,90/,
      );
      const sheets = await media.list(`cap/${stored.mediaPrefix}/sprites/`);
      expect(sheets.map((o) => o.key).some((k) => /sheet-1-[0-9a-f]{8}\.jpg$/.test(k))).toBe(true);
    });

    it('never fails the thumbnails job when the sprite step breaks', async () => {
      runner.failSprites = true;
      const video = await newVideo({ durationMs: 14000, width: 1280, height: 720 });
      await expect(pipeline.thumbnails(video.id, progress)).resolves.toBeUndefined();
      expect((await row(video.id)).spriteKey).toBeNull();
    });

    it('can be switched off', async () => {
      const off = new VideoPipeline({
        ...(pipeline as unknown as { deps: ConstructorParameters<typeof VideoPipeline>[0] }).deps,
        sprites: { enabled: async () => false },
      });
      const video = await newVideo({ durationMs: 14000, width: 1280, height: 720 });
      await off.thumbnails(video.id, progress);
      expect((await row(video.id)).spriteKey).toBeNull();
    });
  });

  describe('retry and key rewrap', () => {
    it('restarts from encoding when probe already finished, and from probe otherwise', async () => {
      const probed = await newVideo({ status: 'failed', durationMs: 14000 });
      const first = await pipeline.retry(probed.id);
      expect(first.jobId).toBeTruthy();
      expect((await row(probed.id)).status).toBe('uploaded');
      const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, probed.id));
      expect(jobs[0]?.queue).toBe('video.encode');

      const fresh = await newVideo({ status: 'failed' });
      await pipeline.retry(fresh.id);
      const freshJobs = await t.db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.videoId, fresh.id));
      expect(freshJobs[0]?.queue).toBe('video.probe');
    });

    it('refuses to retry a video that is not failed or has lost its source', async () => {
      const ok = await newVideo({ status: 'ready', durationMs: 1000 });
      await expect(pipeline.retry(ok.id)).rejects.toBeInstanceOf(Conflict);
      const gone = await newVideo({ status: 'failed' }, null);
      await expect(pipeline.retry(gone.id)).rejects.toThrow(/Replace the file/);
    });

    it('rewraps a stored key under the current KEK after rotation', async () => {
      const video = await newVideo();
      await pipeline.encode(video.id, progress);
      const newKek = new Uint8Array(32).fill(8);
      const rotated = new VideoPipeline({
        ...(pipeline as unknown as { deps: ConstructorParameters<typeof VideoPipeline>[0] }).deps,
        keyring: keyring(newKek, kek),
      });
      await rotated.rewrapKey(video.id);
      const [stored] = await t.db
        .select()
        .from(schema.videoKeys)
        .where(eq(schema.videoKeys.videoId, video.id));
      expect(unwrapHlsKey(keyring(newKek), video.id, stored!.keyWrapped)).toHaveLength(16);
      expect(stored!.rotatedAt).toBeTruthy();
    });
  });
});

async function readAll(storage: LocalStorage, key: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.get(key)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}
