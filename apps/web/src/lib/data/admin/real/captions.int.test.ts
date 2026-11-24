import { schema } from '@ad/db';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedVideo,
  type ViewerTestDb,
} from '@ad/catalog/testing';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import { LocalStorage } from '@ad/storage';
import { CaptionService, ensureTrack, storeRevision } from '@ad/video';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { Cue } from '@/lib/admin/cues';
import type { AdminActor } from '../types';
import { realCaptionService } from './captions';

const secret = new Uint8Array(32).fill(4);
const cue = (id: string, start: number, end: number, text: string): Cue => ({
  id,
  start,
  end,
  text,
});

describe.skipIf(!integrationEnabled())('real caption service', () => {
  let t: ViewerTestDb;
  let root: string;
  let boss: FakeBoss;
  let originals: LocalStorage;
  let editor: AdminActor;
  let admin: AdminActor;
  let viewer: AdminActor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    root = await mkdtemp(join(tmpdir(), 'ad-web-captions-'));
    boss = new FakeBoss();
    await ensureQueues(boss);
    const producer = new JobProducer({ boss, mirror: new DrizzleJobMirror(t.app) });
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    const service = new CaptionService({
      db: t.app,
      originals,
      media: new LocalStorage({ root, bucket: 'media', signingSecret: secret }),
      producer,
      translation: { name: 'google', supports: () => true, usdPerMillionChars: 20 },
      captionLanguages: async () => ['en', 'yo', 'ha'],
    });
    editor = {
      accountId: (await seedAccount(t.setup, 'editor')).id,
      role: 'editor',
      name: 'Ngozi Eze',
    };
    admin = {
      accountId: (await seedAccount(t.setup, 'admin')).id,
      role: 'admin',
      name: 'Chiamaka Okafor',
    };
    viewer = { accountId: (await seedAccount(t.setup)).id, role: 'viewer', name: 'Ada' };
    setAdminRuntime({
      db: () => t.app,
      enqueue: producer.enqueue.bind(producer) as never,
      captions: async () => service,
      names: async (_a, ids) =>
        new Map(ids.map((id) => [id, id === editor.accountId ? 'Ngozi Eze' : 'Chiamaka Okafor'])),
    });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  /** A ready video whose captions came from an upload, so the first revision exists. */
  async function withCaptions(
    cues = [cue('a', 0, 2000, 'Welcome.'), cue('b', 2500, 4500, 'Fractions today.')],
  ) {
    const video = await seedVideo(t.setup, {
      title: `Captioned ${Math.random()}`,
      durationMs: 60_000,
    });
    expect(await realCaptionService.upload(editor, video.id, cues)).toEqual({ ok: true });
    return video;
  }

  it('marks cues an aligned revision was unsure about, and drops the mark once the cue is edited', async () => {
    const video = await seedVideo(t.setup, { title: 'Aligned', durationMs: 60_000 });
    const trackRow = await ensureTrack(t.setup, video.id, 'en');
    await storeRevision(t.setup, originals, trackRow, {
      cues: [
        { startMs: 0, endMs: 2000, text: 'Welcome.' },
        { startMs: 2500, endMs: 4500, text: 'Fractions today.' },
      ],
      source: 'aligned',
      lowConfidenceCues: [2500],
    });
    const { track } = await realCaptionService.track(editor, video.id);
    expect(track?.cues.map((c) => c.lowConfidence === true)).toEqual([false, true]);
    await realCaptionService.save(editor, video.id, [
      cue('a', 0, 2000, 'Welcome.'),
      cue('b', 2500, 4500, 'Fractions, today.'),
    ]);
    const after = await realCaptionService.track(editor, video.id);
    expect(after.track?.cues.some((c) => c.lowConfidence)).toBe(false);
  });

  it('stores a script, queues alignment and previews the cleaned text', async () => {
    const video = await seedVideo(t.setup, { title: 'Scripted', durationMs: 60_000 });
    expect(await realCaptionService.previewScript(editor, 'NARRATOR: Hi there.')).toBe('Hi there.');
    expect(await realCaptionService.alignScript(editor, video.id, 'NARRATOR: Hi there.')).toEqual({
      ok: true,
    });
    const jobs = await t.setup.select().from(schema.jobs).where(eq(schema.jobs.videoId, video.id));
    expect(jobs.map((j) => j.queue)).toContain('caption.generate');
    expect(await realCaptionService.alignScript(editor, video.id, '   ')).toEqual({
      ok: false,
      error: 'Paste the script text first.',
    });
    await expect(realCaptionService.alignScript(viewer, video.id, 'Hi')).rejects.toThrow();
  });

  it('refuses a viewer', async () => {
    await expect(realCaptionService.list(viewer)).rejects.toThrow();
    await expect(realCaptionService.track(viewer, 'x')).rejects.toThrow();
  });

  it('has no track for a video without captions', async () => {
    const video = await seedVideo(t.setup, { title: 'Bare video' });
    const { track, video: shown } = await realCaptionService.track(editor, video.id);
    expect(track).toBeNull();
    expect(shown.id).toBe(video.id);
    expect(await realCaptionService.save(editor, video.id, [cue('a', 0, 1000, 'x')])).toEqual({
      ok: false,
      error: 'This video has no captions yet.',
    });
    expect(await realCaptionService.approve(editor, video.id)).toEqual({
      ok: false,
      error: 'This video has no captions yet.',
    });
  });

  it('upload makes a revision waiting for review, and the track shows the cues with times in milliseconds', async () => {
    const video = await withCaptions();
    const { track } = await realCaptionService.track(editor, video.id);
    expect(track).toMatchObject({
      videoId: video.id,
      language: 'en',
      state: 'needs_review',
      source: 'manual',
      updatedBy: 'Ngozi Eze',
      approvedBy: null,
      approvedCues: null,
      failure: null,
      progress: null,
    });
    expect(track?.cues.map(({ start, end, text }) => ({ start, end, text }))).toEqual([
      { start: 0, end: 2000, text: 'Welcome.' },
      { start: 2500, end: 4500, text: 'Fractions today.' },
    ]);
    expect(new Set(track?.cues.map((c) => c.id)).size).toBe(2);
  });

  it('saves edits as the newest revision and counts changes since approval', async () => {
    const video = await withCaptions();
    expect(await realCaptionService.approve(editor, video.id)).toEqual({ ok: true });
    const approved = (await realCaptionService.track(editor, video.id)).track!;
    expect(approved).toMatchObject({ state: 'approved', approvedBy: 'Ngozi Eze' });
    expect(approved.approvedCues).toHaveLength(2);

    const saved = await realCaptionService.save(editor, video.id, [
      cue('cue_1', 0, 2000, 'Welcome back.'),
      cue('cue_2', 2500, 4500, 'Fractions today.'),
    ]);
    expect(saved).toEqual({ ok: true, changesSinceApproval: 1 });
    const after = (await realCaptionService.track(editor, video.id)).track!;
    expect(after.state).toBe('needs_review');
    expect(after.cues[0]?.text).toBe('Welcome back.');
    expect(after.approvedCues?.[0]?.text).toBe('Welcome.');
  });

  it('validates what it saves', async () => {
    const video = await withCaptions();
    expect(await realCaptionService.save(editor, video.id, [])).toEqual({
      ok: false,
      error: 'Captions need between 1 and 5000 cues.',
    });
    expect(
      await realCaptionService.save(editor, video.id, [cue('a', 0, 1000, 'x'.repeat(501))]),
    ).toEqual({ ok: false, error: 'A cue is over 500 characters. Split it into two.' });
    expect(await realCaptionService.save(editor, video.id, [cue('a', -5, 1000, 'x')])).toEqual({
      ok: false,
      error: 'A cue has a time that is not valid.',
    });
  });

  it('approves even with warnings, clears a publish override, and shows who approved when', async () => {
    const video = await withCaptions([cue('a', 0, 12_000, 'x'.repeat(80))]);
    await t.setup
      .update(schema.videos)
      .set({ captionOverrideReason: 'Music only' })
      .where(eq(schema.videos.id, video.id));
    expect(await realCaptionService.approve(admin, video.id)).toEqual({ ok: true });
    const { track, video: shown } = await realCaptionService.track(admin, video.id);
    expect(track).toMatchObject({ state: 'approved', approvedBy: 'Chiamaka Okafor' });
    expect(track?.approvedAt).toMatch(/Z$/);
    expect(shown.captionOverrideReason).toBeNull();
  });

  it('bulk approve is admin only, approves clean tracks and skips ones with warnings or already approved', async () => {
    const clean = await withCaptions();
    const warned = await withCaptions([cue('a', 0, 2000, 'Hi.'), cue('b', 1000, 3000, 'Overlaps.')]);
    const done = await withCaptions();
    expect(await realCaptionService.approve(editor, done.id)).toEqual({ ok: true });
    await expect(realCaptionService.approveMany(editor, [clean.id])).rejects.toThrow();
    const result = await realCaptionService.approveMany(admin, [clean.id, warned.id, done.id]);
    expect(result.succeeded).toEqual([clean.id]);
    expect(result.skipped).toEqual([
      { id: warned.id, reason: 'Has warnings. Open it to review.' },
      { id: done.id, reason: 'Already approved.' },
    ]);
    expect(result.failed).toEqual([]);
    const after = await realCaptionService.track(admin, clean.id);
    expect(after.track?.state).toBe('approved');
  });

  it('regenerate queues the caption job and the track shows it generating', async () => {
    const video = await withCaptions();
    expect(await realCaptionService.regenerate(editor, video.id)).toEqual({ ok: true });
    expect(
      boss.jobs.some(
        (j) =>
          j.name === 'caption.generate' && (j.data as { videoId?: string }).videoId === video.id,
      ),
    ).toBe(true);
    const { track } = await realCaptionService.track(editor, video.id);
    expect(track?.state).toBe('generating');
    expect(track?.progress).toMatchObject({
      of: expect.any(Number),
      step: expect.any(Number),
      minutesLeft: expect.any(Number),
    });
    expect(await realCaptionService.save(editor, video.id, [cue('a', 0, 1, 'x')])).toEqual({
      ok: false,
      error: 'Captions are still being made.',
    });
    expect(await realCaptionService.approve(editor, video.id)).toEqual({
      ok: false,
      error: 'Captions are still being made.',
    });
  });

  it('shows a failed generation with its plain reason and refuses to approve it', async () => {
    const video = await seedVideo(t.setup, { title: 'Quiet audio' });
    await t.setup.insert(schema.jobs).values({
      queue: 'caption.generate',
      videoId: video.id,
      status: 'failed_permanent',
      errorMessage: 'The audio was too quiet to read.',
    });
    const { track } = await realCaptionService.track(editor, video.id);
    expect(track).toMatchObject({
      state: 'failed',
      failure: 'The audio was too quiet to read.',
      cues: [],
    });
    expect(await realCaptionService.approve(editor, video.id)).toEqual({
      ok: false,
      error: 'Captions could not be made. Upload a file or try again.',
    });
  });

  it('lists ready videos, filters by state and puts never touched ones last', async () => {
    const rows = await realCaptionService.list(editor);
    expect(rows.length).toBeGreaterThan(3);
    const states = new Set(rows.map((r) => r.state));
    expect(states.has('approved') && states.has('needs_review') && states.has('none')).toBe(true);
    const only = await realCaptionService.list(editor, { state: 'approved' });
    expect(only.every((r) => r.state === 'approved')).toBe(true);
    expect(only[0]).toMatchObject({ language: 'English', lastEditedBy: expect.any(String) });
    const none = rows.filter((r) => r.state === 'none');
    expect(none.every((r) => r.lastEditedBy === 'Not started' && r.cueCount === null)).toBe(true);
    const lastTouched = rows.findLastIndex((r) => r.lastEditedAt !== null);
    const firstUntouched = rows.findIndex((r) => r.lastEditedAt === null);
    expect(firstUntouched).toBeGreaterThan(lastTouched);
  });

  describe('languages (M46)', () => {
    /** An approved English revision, then a translated Yoruba revision waiting for review. */
    async function withTranslation() {
      const video = await withCaptions();
      await realCaptionService.approve(editor, video.id);
      const yoTrack = await ensureTrack(t.setup, video.id, 'yo', 'Yorùbá', {
        kind: 'subtitles',
        published: false,
        isDefault: false,
      });
      const [source] = await t.setup
        .select()
        .from(schema.captions)
        .innerJoin(schema.captionTracks, eq(schema.captionTracks.id, schema.captions.trackId))
        .where(eq(schema.captionTracks.videoId, video.id));
      await storeRevision(t.setup, originals, yoTrack, {
        cues: [
          { startMs: 0, endMs: 2000, text: 'Kaabo.' },
          { startMs: 2500, endMs: 4500, text: 'Ida loni.' },
        ],
        source: 'translation',
        sourceCaptionId: source!.captions.id,
        sourceSha256: Buffer.from(source!.captions.sha256),
      });
      return video;
    }

    it('the list reports the spoken language and a chip per translation', async () => {
      const video = await withTranslation();
      const row = (await realCaptionService.list(editor)).find((r) => r.videoId === video.id)!;
      expect(row.spokenLanguage).toBe('en');
      expect(row.translations).toEqual([
        { language: 'yo', state: 'needs_review', published: false, sourceChanged: false },
      ]);
    });

    it('track reads the requested language with the source cues beside it', async () => {
      const video = await withTranslation();
      const { track } = await realCaptionService.track(editor, video.id, 'yo');
      expect(track).toMatchObject({ language: 'yo', state: 'needs_review', translation: { published: false, spokenLanguage: 'en' } });
      expect(track!.cues.map((c) => c.text)).toEqual(['Kaabo.', 'Ida loni.']);
      expect(track!.translation!.sourceCues.map((c) => c.text)).toEqual(['Welcome.', 'Fractions today.']);
    });

    it('the language parameter reaches the service for save and approve', async () => {
      const video = await withTranslation();
      const edited = [cue('a', 0, 2000, 'Kaabo si eko.'), cue('b', 2500, 4500, 'Ida loni.')];
      expect(await realCaptionService.save(editor, video.id, edited, 'yo')).toMatchObject({ ok: true });
      expect(await realCaptionService.approve(editor, video.id, 'yo')).toEqual({ ok: true });
      const yo = (await realCaptionService.track(editor, video.id, 'yo')).track!;
      expect(yo.state).toBe('approved');
      expect(yo.cues[0]!.text).toBe('Kaabo si eko.');
      const en = (await realCaptionService.track(editor, video.id)).track!;
      expect(en.cues[0]!.text).toBe('Welcome.');
    });

    it('approving a translation does not publish it, and an editor cannot publish', async () => {
      const video = await withTranslation();
      await realCaptionService.approve(editor, video.id, 'yo');
      expect((await realCaptionService.track(editor, video.id, 'yo')).track!.translation!.published).toBe(false);
      await expect(realCaptionService.setPublished(editor, video.id, 'yo', true)).rejects.toThrow();
      expect(await realCaptionService.setPublished(admin, video.id, 'yo', true)).toEqual({ ok: true });
      expect((await realCaptionService.track(editor, video.id, 'yo')).track!.translation!.published).toBe(true);
    });

    it('publishing before approval is a plain message, not a crash', async () => {
      const video = await withTranslation();
      expect(await realCaptionService.setPublished(admin, video.id, 'yo', true)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/approve/i),
      });
    });

    it('translate queues a job and estimate prices it; a viewer cannot', async () => {
      const video = await withCaptions();
      await realCaptionService.approve(editor, video.id);
      const est = await realCaptionService.estimate(editor, video.id, 'ha');
      expect(est).toMatchObject({ configured: true, provider: 'google', cues: 2 });
      expect(await realCaptionService.translate(editor, video.id, 'ha')).toEqual({ ok: true });
      expect(await realCaptionService.translate(editor, video.id, 'yo')).toMatchObject({ ok: true });
      await expect(realCaptionService.translate(viewer, video.id, 'ha')).rejects.toThrow();
    });

    it('translate says why it cannot, in plain words', async () => {
      const video = await seedVideo(t.setup, { title: 'No captions', durationMs: 60_000 });
      expect(await realCaptionService.translate(editor, video.id, 'ha')).toMatchObject({
        ok: false,
        error: expect.stringMatching(/approve/i),
      });
    });
  });
});
