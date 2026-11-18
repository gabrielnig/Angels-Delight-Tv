import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import type { Actor } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { UploadService } from '@ad/video';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseManifestText, validateManifest } from './manifest';
import { runImport } from './runner';
import { ServiceImportPorts, localPartWriter, type PartWriter } from './service-ports';

const MIB = 1024 * 1024;
const secret = new Uint8Array(32).fill(4);

describe.skipIf(!integrationEnabled())(
  'ServiceImportPorts against Postgres and local storage',
  () => {
    let t: TestDatabase;
    let actor: Actor;
    let dir: string;
    let originals: LocalStorage;
    let upload: UploadService;
    let producer: JobProducer;
    let boss: FakeBoss;

    beforeAll(async () => {
      t = await createTestDatabase();
      const root = await mkdtemp(join(tmpdir(), 'ad-import-store-'));
      dir = await mkdtemp(join(tmpdir(), 'ad-import-dir-'));
      originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
      const media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
      boss = new FakeBoss();
      await ensureQueues(boss);
      producer = new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) });
      const row = makeAccount({ role: 'admin' });
      await t.db.insert(schema.accounts).values(row);
      actor = { accountId: row.id, role: 'admin' };
      upload = new UploadService({
        db: t.db,
        originals,
        media,
        producer,
        limits: { maxBytes: 5 * 1024 * MIB, partBytes: 5 * MIB },
      });
      await writeFile(join(dir, 'small.mp4'), Buffer.alloc(1 * MIB, 1));
      await writeFile(join(dir, 'big.mp4'), Buffer.alloc(11 * MIB, 2));
      await writeFile(join(dir, 'script.txt'), 'Hello there');
      await writeFile(join(dir, 'poster.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    });

    afterAll(async () => {
      await t.drop();
    });

    const ports = (writePart: PartWriter) =>
      new ServiceImportPorts({
        db: t.db,
        actor,
        dir,
        ctx: { db: t.db },
        upload,
        originals,
        producer,
        writePart,
      });

    async function rows(text: string) {
      const raw = parseManifestText(text, 'csv');
      if (!raw.ok) throw new Error(raw.error);
      const checked = await validateManifest(raw.rows, { exists: async () => true });
      expect(checked.errors).toEqual([]);
      return checked.rows;
    }

    it('imports with metadata, series, categories, script and poster, and a rerun skips it', async () => {
      const manifest = await rows(
        [
          'file,title,description,category,series,season,episode,age_rating,language,script,poster',
          'small.mp4,Small One,About it,Science|Kids,Wonders,1,1,kids,yo,script.txt,poster.jpg',
        ].join('\n'),
      );
      const good = ports(localPartWriter(originals, secret));
      const first = await runImport(manifest, good, { dryRun: false });
      expect(first.results[0]).toMatchObject({ status: 'imported', poster: 'pending' });
      const videoId = first.results[0]!.videoId!;

      const [video] = await t.db.select().from(schema.videos).where(eq(schema.videos.id, videoId));
      expect(video).toMatchObject({
        title: 'Small One',
        description: 'About it',
        language: 'yo',
        suitability: 'kids',
        kidsSafe: true,
        status: 'uploaded',
        kind: 'episode',
      });
      expect(video!.originalKey).toBeTruthy();
      expect(video!.originalSha256).not.toBeNull();
      const cats = await t.db
        .select()
        .from(schema.videoCategories)
        .where(eq(schema.videoCategories.videoId, videoId));
      expect(cats).toHaveLength(2);
      expect((await originals.head(`scripts/${videoId}.txt`))?.bytes).toBe(11);
      const queued = await t.db.select().from(schema.jobs);
      expect(queued.map((job) => job.queue).sort()).toEqual(['image.process', 'video.probe']);

      const second = await runImport(manifest, good, { dryRun: false });
      expect(second.results[0]).toMatchObject({ status: 'skipped', videoId, poster: 'pending' });
      const all = await t.db.select().from(schema.videos);
      expect(all.filter((v) => v.title === 'Small One')).toHaveLength(1);
    });

    it('resumes an interrupted multi part upload without re-sending finished parts and without a second video', async () => {
      const manifest = await rows('file,title\nbig.mp4,Big One');
      const sent: string[] = [];
      const real = localPartWriter(originals, secret);
      let calls = 0;
      const flaky: PartWriter = async (url, bytes) => {
        calls++;
        if (calls === 2) throw new Error('connection lost');
        sent.push(`${bytes.byteLength}`);
        await real(url, bytes);
      };
      const failed = await runImport(manifest, ports(flaky), { dryRun: false });
      expect(failed.results[0]).toMatchObject({ status: 'failed', message: 'connection lost' });
      expect(sent).toHaveLength(1);

      const counted: number[] = [];
      const counting: PartWriter = async (url, bytes) => {
        counted.push(bytes.byteLength);
        await real(url, bytes);
      };
      const resumed = await runImport(manifest, ports(counting), { dryRun: false });
      expect(resumed.results[0]).toMatchObject({ status: 'resumed' });
      expect(counted).toHaveLength(2);

      const done = await runImport(manifest, ports(counting), { dryRun: false });
      expect(done.results[0]!.status).toBe('skipped');
      const bigs = (await t.db.select().from(schema.videos)).filter((v) => v.title === 'Big One');
      expect(bigs).toHaveLength(1);
      expect(bigs[0]!.status).toBe('uploaded');
    });
  },
);
