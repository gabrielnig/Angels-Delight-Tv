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
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { keyring } from '../hls-key';
import { previewMaxBytes } from '../preview';
import { nodeRunner, type ProcessRunner } from './ffmpeg';
import { VideoPipeline } from './pipeline';

const hasFfmpeg =
  spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const secret = new Uint8Array(32).fill(9);
const kek = new Uint8Array(32).fill(4);
const none = async () => undefined;

function ffmpeg(args: string[]) {
  const made = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
  expect(made.status).toBe(0);
}

describe.skipIf(!integrationEnabled() || !hasFfmpeg)('hero preview clip with real ffmpeg', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let owner: string;
  let boss: FakeBoss;
  let calls: string[][];
  let maxBytes: number | undefined;
  let clipMs: number | undefined;
  let pipeline: VideoPipeline;
  const files: Record<string, Buffer> = {};

  const runner: ProcessRunner = {
    run(command, args, options) {
      if (command === 'ffmpeg' && args.includes('libx264')) calls.push(args);
      return nodeRunner.run(command, args, options);
    },
  };

  async function newVideo(file: string, overrides: Record<string, unknown> = {}, withOriginal = true) {
    const video = makeVideo({
      createdBy: owner,
      status: 'ready',
      durationMs: 40_000,
      width: 640,
      height: 360,
      ...overrides,
    });
    const key = `originals/${video.id}/up`;
    if (withOriginal) await originals.put(key, files[file]!);
    await t.db.insert(schema.videos).values({
      ...video,
      originalKey: withOriginal ? key : null,
      originalBytes: withOriginal ? files[file]!.length : null,
    });
    return video;
  }
  const row = async (id: string) =>
    (await t.db.select().from(schema.videos).where(eq(schema.videos.id, id)))[0]!;
  const readMedia = async (key: string) => {
    const chunks: Buffer[] = [];
    for await (const chunk of await media.get(key)) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  };
  const probeOf = async (bytes: Buffer) => {
    const path = join(root, `check-${Date.now()}.mp4`);
    await writeFile(path, bytes);
    const out = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path]);
    return JSON.parse(out.stdout.toString()) as {
      streams: { codec_type: string; codec_name: string; width?: number }[];
      format: { duration: string };
    };
  };

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-preview-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    const account = makeAccount({ role: 'editor' });
    await t.db.insert(schema.accounts).values(account);
    owner = account.id;
    boss = new FakeBoss();
    await ensureQueues(boss);

    const make = async (name: string, ...args: string[]) => {
      const path = join(root, `${name}.mp4`);
      ffmpeg([...args, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path]);
      files[name] = await readFile(path);
    };
    await make('busy', '-f', 'lavfi', '-i', 'testsrc=duration=40:size=640x360:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=40', '-c:a', 'aac', '-shortest');
    await make('silent', '-f', 'lavfi', '-i', 'testsrc=duration=40:size=640x360:rate=24');
    await make('whole', '-f', 'lavfi', '-i', 'testsrc=duration=14:size=640x360:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=14', '-c:a', 'aac', '-shortest');
    await make('black', '-f', 'lavfi', '-i', 'color=c=black:s=320x180:d=40:r=24');
    await make('tiny', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x180:rate=24');
    await make('short', '-f', 'lavfi', '-i', 'testsrc=duration=5:size=320x180:rate=24');
  }, 120_000);

  beforeEach(() => {
    calls = [];
    maxBytes = undefined;
    clipMs = undefined;
    pipeline = new VideoPipeline({
      db: t.db,
      originals,
      media,
      keyring: keyring(kek),
      producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      scratch: { root: join(root, 'scratch'), stats: async () => ({ freeBytes: 1e12, totalBytes: 2e12 }) },
      runner,
      ffmpeg: { preset: 'ultrafast', threads: 2 },
      limits: { maxSeconds: 1800, warnSeconds: 3600 },
      preview: {
        get maxBytes() { return maxBytes; },
        clipMs: async () => clipMs ?? 20_000,
      },
    });
  });

  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('makes a 20 second H.264 clip with low bitrate AAC audio and records length and sound', async () => {
    const video = await newVideo('busy');
    await pipeline.previewClip(video.id, {}, none);
    const after = await row(video.id);
    expect(after.previewState).toBe('ready');
    expect(after.previewKey).toMatch(new RegExp(`^cap/${video.mediaPrefix}/preview/\\d+-[0-9a-f]{8}\\.mp4$`));
    expect(after.previewBytes).toBeGreaterThan(0);
    expect(after.previewBytes).toBeLessThan(previewMaxBytes(20_000));
    expect(after.previewHasAudio).toBe(true);
    expect(after.previewLengthMs).toBe(20_000);
    expect(after.previewNote).toBeNull();
    expect(after.previewUpdatedAt).not.toBeNull();
    const info = await probeOf(await readMedia(after.previewKey!));
    expect(info.streams.map((s) => s.codec_type).sort()).toEqual(['audio', 'video']);
    expect(info.streams.find((s) => s.codec_type === 'video')).toMatchObject({ codec_name: 'h264', width: 854 });
    expect(info.streams.find((s) => s.codec_type === 'audio')).toMatchObject({ codec_name: 'aac' });
    expect(Number(info.format.duration)).toBeGreaterThan(19.5);
    expect(Number(info.format.duration)).toBeLessThan(20.7);
  }, 120_000);

  it('keeps a silent source silent and records no sound', async () => {
    const video = await newVideo('silent');
    await pipeline.previewClip(video.id, {}, none);
    const after = await row(video.id);
    expect(after).toMatchObject({ previewState: 'ready', previewHasAudio: false, previewLengthMs: 20_000 });
    expect((await probeOf(await readMedia(after.previewKey!))).streams.map((s) => s.codec_type)).toEqual(['video']);
  }, 120_000);

  it('uses the whole video when it is no longer than the clip length', async () => {
    const video = await newVideo('whole', { durationMs: 14_000 });
    await pipeline.previewClip(video.id, {}, none);
    const after = await row(video.id);
    expect(after).toMatchObject({ previewState: 'ready', previewStartMs: 0, previewHasAudio: true });
    expect(after.previewLengthMs).toBeGreaterThan(13_000);
    expect(after.previewLengthMs).toBeLessThan(14_600);
  }, 120_000);

  it('follows the clip length setting', async () => {
    const video = await newVideo('busy');
    clipMs = 8000;
    await pipeline.previewClip(video.id, {}, none);
    const after = await row(video.id);
    expect(after.previewLengthMs).toBe(8000);
    expect(Number((await probeOf(await readMedia(after.previewKey!))).format.duration)).toBeLessThan(8.7);
  }, 120_000);

  it('uses the whole of a short video', async () => {
    const video = await newVideo('short', { durationMs: 5000 });
    await pipeline.previewClip(video.id, {}, none);
    const after = await row(video.id);
    expect(after).toMatchObject({ previewState: 'ready', previewStartMs: 0, previewHasAudio: false });
    expect(Number((await probeOf(await readMedia(after.previewKey!))).format.duration)).toBeGreaterThan(4.5);
  }, 60_000);

  it('skips a video under 3 seconds with a plain reason', async () => {
    const video = await newVideo('tiny');
    await pipeline.previewClip(video.id, {}, none);
    expect(await row(video.id)).toMatchObject({
      previewState: 'skipped',
      previewKey: null,
      previewNote: 'The video is under 3 seconds',
    });
  }, 60_000);

  it('skips a flat black video, so the poster is used', async () => {
    const video = await newVideo('black');
    await pipeline.previewClip(video.id, {}, none);
    const after = await row(video.id);
    expect(after.previewState).toBe('skipped');
    expect(after.previewNote).toMatch(/dark|plain/i);
    expect(calls).toHaveLength(0);
  }, 60_000);

  it('retries once at a higher crf when the clip is too big, then marks it failed without throwing', async () => {
    const video = await newVideo('busy');
    maxBytes = 1;
    await expect(pipeline.previewClip(video.id, {}, none)).resolves.toBeUndefined();
    expect(calls.map((args) => args[args.indexOf('-crf') + 1])).toEqual(['27', '31']);
    expect(await row(video.id)).toMatchObject({
      previewState: 'failed',
      previewKey: null,
      previewNote: 'The clip came out too large',
    });
  }, 120_000);

  it('skips with a note when the original is gone', async () => {
    const video = await newVideo('busy', {}, false);
    await pipeline.previewClip(video.id, {}, none);
    expect(await row(video.id)).toMatchObject({
      previewState: 'skipped',
      previewNote: 'The original file is no longer stored',
    });
  });

  it('does nothing when the mode is off', async () => {
    const video = await newVideo('busy', { previewMode: 'off' });
    await pipeline.previewClip(video.id, {}, none);
    expect(await row(video.id)).toMatchObject({ previewState: 'none', previewKey: null });
    expect(calls).toHaveLength(0);
  });

  it('a recut writes a new key, updates the row, then deletes the old file', async () => {
    const video = await newVideo('busy');
    await pipeline.previewClip(video.id, {}, none);
    const first = (await row(video.id)).previewKey!;
    await pipeline.previewClip(video.id, { mode: 'picked', startMs: 3300 }, none);
    const after = await row(video.id);
    expect(after.previewStartMs).toBe(3300);
    expect(after.previewKey).not.toBe(first);
    expect(after.previewKey).toMatch(/preview\/3300-/);
    expect(await media.head(first)).toBeNull();
    expect(await media.head(after.previewKey!)).not.toBeNull();
  }, 180_000);

  it('queues a clip after thumbnails and marks the video queued', async () => {
    const video = await newVideo('busy', { status: 'uploaded' });
    await pipeline.thumbnails(video.id, none);
    const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, video.id));
    expect(jobs.map((job) => job.queue)).toContain('video.preview');
    expect((await row(video.id)).previewState).toBe('queued');
  }, 120_000);

  it('does not queue a clip after thumbnails when the mode is off', async () => {
    const video = await newVideo('busy', { status: 'uploaded', previewMode: 'off' });
    await pipeline.thumbnails(video.id, none);
    const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, video.id));
    expect(jobs.map((job) => job.queue)).not.toContain('video.preview');
  }, 120_000);
});
