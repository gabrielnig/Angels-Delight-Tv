import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { LocalStorage } from '@ad/storage';
import { and, eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PipelineError } from '../failure';
import { FakeRunner, fakeMp4Bytes } from '../testing';
import { parseVtt } from '../vtt';
import { FakeTranscriber } from './adapter';
import { CaptionGenerator } from './generator';

const secret = new Uint8Array(32).fill(2);
const words = [
  { word: 'Welcome', startMs: 200, endMs: 600 },
  { word: 'to', startMs: 650, endMs: 800 },
  { word: 'the', startMs: 820, endMs: 950 },
  { word: 'lesson.', startMs: 1000, endMs: 1600 },
];

describe.skipIf(!integrationEnabled())(
  'CaptionGenerator against Postgres and local storage',
  () => {
    let t: TestDatabase;
    let root: string;
    let originals: LocalStorage;
    let runner: FakeRunner;
    let transcriber: FakeTranscriber;
    let generator: CaptionGenerator;
    let stages: string[];
    const progress = async (stage: string) => void stages.push(stage);

    async function newVideo(source: Uint8Array | null = fakeMp4Bytes()) {
      const owner = makeAccount({ role: 'editor' });
      await t.db.insert(schema.accounts).values(owner);
      const video = makeVideo({ createdBy: owner.id, status: 'ready', durationMs: 5000 });
      const key = `originals/${video.id}/up`;
      if (source) await originals.put(key, source);
      await t.db.insert(schema.videos).values({
        ...video,
        originalKey: source ? key : null,
        originalBytes: source?.length ?? null,
      });
      return video;
    }

    const revisions = async (videoId: string) => {
      const [track] = await t.db
        .select()
        .from(schema.captionTracks)
        .where(eq(schema.captionTracks.videoId, videoId));
      if (!track) return { track, rows: [] };
      const rows = await t.db
        .select()
        .from(schema.captions)
        .where(eq(schema.captions.trackId, track.id))
        .orderBy(schema.captions.revision);
      return { track, rows };
    };

    beforeAll(async () => {
      t = await createTestDatabase();
      root = await mkdtemp(join(tmpdir(), 'ad-captions-'));
      originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    });
    beforeEach(() => {
      runner = new FakeRunner();
      transcriber = new FakeTranscriber({ words, model: 'small.en' });
      stages = [];
      generator = new CaptionGenerator({
        db: t.db,
        originals,
        runner,
        transcriber,
        scratch: {
          root: join(root, 'scratch'),
          stats: async () => ({ freeBytes: 1e12, totalBytes: 2e12 }),
        },
      });
    });
    afterAll(async () => {
      await t?.drop();
      await rm(root, { recursive: true, force: true });
    });

    it('extracts mono 16 kHz audio, transcribes it and stores a draft revision needing review', async () => {
      const video = await newVideo();
      await generator.generate(video.id, 'transcribe', progress);

      const ffmpeg = runner.calls.find((call) => call.args.includes('-vn'));
      expect(ffmpeg?.args).toEqual(expect.arrayContaining(['-ac', '1', '-ar', '16000']));
      expect(transcriber.requests[0]).toMatchObject({ language: 'en' });
      expect(transcriber.requests[0]!.audio.length).toBeGreaterThan(0);

      const { track, rows } = await revisions(video.id);
      expect(track).toMatchObject({
        language: 'en',
        label: 'English',
        kind: 'captions',
        isDefault: true,
        approvedCaptionId: null,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        revision: 1,
        source: 'whisper',
        status: 'in_review',
        model: 'small.en',
        cueCount: 1,
      });
      expect(rows[0]!.storageKey).toBe(`captions-draft/${video.id}/en/r1.vtt`);
      const stored = await originals.get(rows[0]!.storageKey);
      const text = (await stored.toArray()).map((c) => Buffer.from(c)).join('');
      expect(parseVtt(text)[0]).toMatchObject({ startMs: 200, text: 'Welcome to the lesson.' });
      expect(rows[0]!.bytes).toBe(Buffer.byteLength(text));
      expect(stages).toContain('Extracting audio');
      expect(stages).toContain('Recognising speech');
    });

    it('keeps the old draft as a superseded revision when run again (regenerate)', async () => {
      const video = await newVideo();
      await generator.generate(video.id, 'transcribe', progress);
      await generator.generate(video.id, 'transcribe', progress);
      const { rows } = await revisions(video.id);
      expect(rows.map((r) => [r.revision, r.status])).toEqual([
        [1, 'superseded'],
        [2, 'in_review'],
      ]);
    });

    it('never touches an approved revision when regenerating', async () => {
      const video = await newVideo();
      await generator.generate(video.id, 'transcribe', progress);
      const { track, rows } = await revisions(video.id);
      const reviewer = makeAccount({ role: 'admin' });
      await t.db.insert(schema.accounts).values(reviewer);
      await t.db
        .update(schema.captions)
        .set({ status: 'approved', reviewedBy: reviewer.id, publicKey: 'cap/x/en/abcd1234.vtt' })
        .where(eq(schema.captions.id, rows[0]!.id));
      await t.db
        .update(schema.captionTracks)
        .set({ approvedCaptionId: rows[0]!.id })
        .where(eq(schema.captionTracks.id, track!.id));
      await generator.generate(video.id, 'transcribe', progress);
      const after = await revisions(video.id);
      expect(after.rows.map((r) => r.status)).toEqual(['approved', 'in_review']);
      expect(after.track!.approvedCaptionId).toBe(rows[0]!.id);
    });

    it('notes "No speech detected" for silence and stores an empty track (M15-S01 AC3)', async () => {
      transcriber = new FakeTranscriber({ words: [] });
      generator = new CaptionGenerator({
        db: t.db,
        originals,
        runner,
        transcriber,
        scratch: {
          root: join(root, 'scratch'),
          stats: async () => ({ freeBytes: 1e12, totalBytes: 2e12 }),
        },
      });
      const video = await newVideo();
      await generator.generate(video.id, 'transcribe', progress);
      const { rows } = await revisions(video.id);
      expect(rows[0]).toMatchObject({
        status: 'in_review',
        cueCount: 0,
        reviewNote: 'No speech detected',
      });
    });

    it('aligns to an uploaded script and records the source as aligned', async () => {
      const video = await newVideo();
      await originals.put(
        `scripts/${video.id}.txt`,
        new TextEncoder().encode('NARRATOR: Welcome to the lesson.'),
      );
      await generator.generate(video.id, 'align', progress);
      const { rows } = await revisions(video.id);
      expect(rows[0]).toMatchObject({ source: 'aligned', status: 'in_review' });
    });

    it('saves the cues that need a second look with the aligned revision', async () => {
      const video = await newVideo();
      await originals.put(
        `scripts/${video.id}.txt`,
        new TextEncoder().encode('Welcome to the brand new lesson.'),
      );
      await generator.generate(video.id, 'align', progress);
      const { rows } = await revisions(video.id);
      // "brand new" was never heard, so the one cue holding it is flagged by its start time.
      expect(rows[0]!.lowConfidenceCues).toEqual([200]);
    });

    it('flags nothing when the script matches what was heard', async () => {
      const video = await newVideo();
      await originals.put(
        `scripts/${video.id}.txt`,
        new TextEncoder().encode('Welcome to the lesson.'),
      );
      await generator.generate(video.id, 'align', progress);
      expect((await revisions(video.id)).rows[0]!.lowConfidenceCues).toEqual([]);
    });

    it('fails permanently with a plain reason when there is no script or it does not match', async () => {
      const video = await newVideo();
      await expect(generator.generate(video.id, 'align', progress)).rejects.toMatchObject({
        code: 'caption_failed',
        permanent: true,
      });
      await originals.put(
        `scripts/${video.id}.txt`,
        new TextEncoder().encode('Elephants wander across distant rivers every single morning.'),
      );
      await expect(generator.generate(video.id, 'align', progress)).rejects.toMatchObject({
        code: 'script_mismatch',
      });
      expect((await revisions(video.id)).rows).toHaveLength(0);
    });

    it('leaves the previous track untouched and retries later when the service is down (M15-S08 error)', async () => {
      const video = await newVideo();
      await generator.generate(video.id, 'transcribe', progress);
      transcriber.failWith = new PipelineError('caption_service_unavailable', 'down');
      const error = await generator
        .generate(video.id, 'transcribe', progress)
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ code: 'caption_service_unavailable', permanent: false });
      expect((await revisions(video.id)).rows.map((r) => r.status)).toEqual(['in_review']);
    });

    it('fails permanently when the video has no source file', async () => {
      const video = await newVideo(null);
      await expect(generator.generate(video.id, 'transcribe', progress)).rejects.toMatchObject({
        code: 'upload_incomplete',
      });
    });

    it('creates the track once even when two generations race', async () => {
      const video = await newVideo();
      await Promise.all([
        generator.generate(video.id, 'transcribe', progress),
        generator.generate(video.id, 'transcribe', progress),
      ]);
      const tracks = await t.db
        .select()
        .from(schema.captionTracks)
        .where(and(eq(schema.captionTracks.videoId, video.id)));
      expect(tracks).toHaveLength(1);
      expect((await revisions(video.id)).rows.map((r) => r.revision)).toEqual([1, 2]);
    });
  },
);
