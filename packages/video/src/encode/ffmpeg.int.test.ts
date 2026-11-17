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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keyring, unwrapHlsKey } from '../hls-key';
import { VideoPipeline } from './pipeline';

const hasFfmpeg =
  spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const secret = new Uint8Array(32).fill(9);
const kek = new Uint8Array(32).fill(4);

async function readAll(storage: LocalStorage, key: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.get(key)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

describe.skipIf(!integrationEnabled() || !hasFfmpeg)('real ffmpeg on a generated clip', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let videoId: string;
  let prefix: string;

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-ffmpeg-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });

    const clip = join(root, 'clip.mp4');
    const made = spawnSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=14:size=1280x720:rate=25',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=14',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      clip,
    ]);
    expect(made.status).toBe(0);

    const owner = makeAccount({ role: 'editor' });
    await t.db.insert(schema.accounts).values(owner);
    const video = makeVideo({ createdBy: owner.id, status: 'uploaded' });
    const bytes = await readFile(clip);
    const key = `originals/${video.id}/up`;
    await originals.put(key, bytes);
    await t.db
      .insert(schema.videos)
      .values({ ...video, originalKey: key, originalBytes: bytes.length });
    videoId = video.id;
    prefix = video.mediaPrefix;

    const boss = new FakeBoss();
    await ensureQueues(boss);
    const pipeline = new VideoPipeline({
      db: t.db,
      originals,
      media,
      keyring: keyring(kek),
      producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      scratch: {
        root: join(root, 'scratch'),
        stats: async () => ({ freeBytes: 1e12, totalBytes: 2e12 }),
      },
      ffmpeg: { preset: 'ultrafast', threads: 2 },
      limits: { maxSeconds: 1800, warnSeconds: 3600 },
    });
    await pipeline.probe(videoId, async () => undefined);
    await pipeline.encode(videoId, async () => undefined);
    await pipeline.thumbnails(videoId, async () => undefined);
  }, 180_000);

  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('produces the capped ladder with 6 second segments and a ready video', async () => {
    const [video] = await t.db.select().from(schema.videos).where(eq(schema.videos.id, videoId));
    expect(video).toMatchObject({ status: 'ready', width: 1280, height: 720 });
    expect(video!.durationMs).toBeGreaterThan(13000);
    const renditions = await t.db
      .select()
      .from(schema.renditions)
      .where(eq(schema.renditions.videoId, videoId));
    expect(renditions.map((r) => r.height).sort((a, b) => a - b)).toEqual([360, 480, 720]);
    for (const rendition of renditions) {
      expect(rendition.segmentCount).toBe(3);
      expect(rendition.bandwidthBps).toBeGreaterThan(0);
      expect(rendition.codecs).toBe(
        rendition.height === 720 ? 'avc1.64001f,mp4a.40.2' : 'avc1.4d001e,mp4a.40.2',
      );
    }
  });

  it('writes variant playlists with aligned 6 second segments', async () => {
    const variant360 = (await readAll(originals, `templates/${videoId}/360.m3u8`)).toString();
    const variant720 = (await readAll(originals, `templates/${videoId}/720.m3u8`)).toString();
    const durations = (text: string) =>
      [...text.matchAll(/#EXTINF:([\d.]+),/g)].map((m) => Number(m[1]));
    const a = durations(variant360);
    const b = durations(variant720);
    expect(a).toHaveLength(3);
    expect(a.slice(0, 2).every((d) => Math.abs(d - 6) < 0.05)).toBe(true);
    for (let i = 0; i < 3; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(0.05);
  });

  it('encrypts segments: unreadable without the key, playable with it', async () => {
    const segment = await readAll(media, `v/${prefix}/360/seg_00000.ts`);
    expect(segment[0]).not.toBe(0x47);

    const [row] = await t.db
      .select()
      .from(schema.videoKeys)
      .where(eq(schema.videoKeys.videoId, videoId));
    const key = unwrapHlsKey(keyring(kek), videoId, row!.keyWrapped);
    const work = await mkdtemp(join(root, 'play-'));
    await writeFile(join(work, 'enc.key'), key);
    let playlist = (await readAll(originals, `templates/${videoId}/360.m3u8`)).toString();
    playlist = playlist.replace(`ad-key://${videoId}`, join(work, 'enc.key'));
    for (let i = 0; i < 3; i++) {
      const name = `seg_0000${i}.ts`;
      await writeFile(join(work, name), await readAll(media, `v/${prefix}/360/${name}`));
      playlist = playlist.replace(name, join(work, name));
    }
    await writeFile(join(work, 'index.m3u8'), playlist);

    const probe = spawnSync('ffprobe', [
      '-v',
      'error',
      '-allowed_extensions',
      'ALL',
      '-protocol_whitelist',
      'file,crypto,data',
      '-show_entries',
      'stream=codec_name,width,height',
      '-of',
      'json',
      join(work, 'index.m3u8'),
    ]);
    expect(probe.status).toBe(0);
    const streams = JSON.parse(probe.stdout.toString()).streams as {
      codec_name: string;
      width?: number;
    }[];
    expect(streams.map((s) => s.codec_name).sort()).toEqual(['aac', 'h264']);
    expect(streams.find((s) => s.codec_name === 'h264')?.width).toBe(640);

    const wrong = Buffer.from(key);
    wrong[0] = wrong[0]! ^ 0xff;
    await writeFile(join(work, 'enc.key'), wrong);
    const bad = spawnSync('ffprobe', [
      '-v',
      'error',
      '-allowed_extensions',
      'ALL',
      '-protocol_whitelist',
      'file,crypto,data',
      '-show_entries',
      'stream=codec_name',
      '-of',
      'json',
      join(work, 'index.m3u8'),
    ]);
    expect(
      bad.status !== 0 ||
        JSON.parse(bad.stdout.toString() || '{"streams":[]}').streams.length === 0,
    ).toBe(true);
  });

  it('normalises loudness close to the -16 LUFS target', async () => {
    const work = await mkdtemp(join(root, 'loud-'));
    const [row] = await t.db
      .select()
      .from(schema.videoKeys)
      .where(eq(schema.videoKeys.videoId, videoId));
    const key = unwrapHlsKey(keyring(kek), videoId, row!.keyWrapped);
    await writeFile(join(work, 'enc.key'), key);
    let playlist = (await readAll(originals, `templates/${videoId}/360.m3u8`))
      .toString()
      .replace(`ad-key://${videoId}`, join(work, 'enc.key'));
    for (let i = 0; i < 3; i++) {
      const name = `seg_0000${i}.ts`;
      await writeFile(join(work, name), await readAll(media, `v/${prefix}/360/${name}`));
      playlist = playlist.replace(name, join(work, name));
    }
    await writeFile(join(work, 'index.m3u8'), playlist);
    const out = spawnSync('ffmpeg', [
      '-hide_banner',
      '-allowed_extensions',
      'ALL',
      '-protocol_whitelist',
      'file,crypto,data',
      '-i',
      join(work, 'index.m3u8'),
      '-af',
      'ebur128=framelog=quiet',
      '-f',
      'null',
      '-',
    ]);
    const summary = out.stderr.toString();
    const lufs = Number(
      /I:\s+(-?[\d.]+) LUFS/.exec(summary.slice(summary.lastIndexOf('Integrated loudness')))?.[1],
    );
    expect(Number.isFinite(lufs)).toBe(true);
    expect(lufs).toBeGreaterThan(-22);
    expect(lufs).toBeLessThan(-12);
  });

  it('creates three webp poster candidates', async () => {
    const candidates = (await t.db.select().from(schema.assets)).filter((a) =>
      a.rawKey?.startsWith(`candidates/${videoId}/`),
    );
    expect(candidates).toHaveLength(3);
    const image = await readAll(media, candidates[0]!.variants[0]!.key);
    expect(image.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(image.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });
});
