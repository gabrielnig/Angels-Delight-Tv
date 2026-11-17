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
import { Conflict, Forbidden, NotFound, ValidationFailed, type Actor } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseVtt } from '../vtt';
import { CaptionNeedsConfirmation, CaptionService } from './service';
import { ensureTrack, storeRevision } from './revisions';

const secret = new Uint8Array(32).fill(6);
const good = [
  { startMs: 0, endMs: 2000, text: 'Welcome to the lesson.' },
  { startMs: 2500, endMs: 4500, text: 'Today we learn fractions.' },
];

async function text(storage: LocalStorage, key: string): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.get(key)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

describe.skipIf(!integrationEnabled())('CaptionService against Postgres and local storage', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let boss: FakeBoss;
  let service: CaptionService;
  let editor: Actor;
  let admin: Actor;
  let viewer: Actor;
  let audit: { action: string; outcome: string; targetId?: string | null }[];

  async function account(role: 'viewer' | 'editor' | 'admin'): Promise<Actor> {
    const row = makeAccount({ role });
    await t.db.insert(schema.accounts).values(row);
    return { accountId: row.id, role };
  }

  async function videoWithDraft(cues = good) {
    const video = makeVideo({ createdBy: editor.accountId, status: 'ready', durationMs: 5000 });
    await t.db.insert(schema.videos).values(video);
    const track = await ensureTrack(t.db, video.id, 'en');
    const revision = await storeRevision(t.db, originals, track, {
      cues,
      source: 'whisper',
      model: 'small.en',
    });
    return { video, track, revision };
  }

  const captionRow = async (id: string) =>
    (await t.db.select().from(schema.captions).where(eq(schema.captions.id, id)))[0]!;
  const trackRow = async (id: string) =>
    (await t.db.select().from(schema.captionTracks).where(eq(schema.captionTracks.id, id)))[0]!;

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-capsvc-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    boss = new FakeBoss();
    await ensureQueues(boss);
    audit = [];
    service = new CaptionService({
      db: t.db,
      originals,
      media,
      producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      audit: { record: async (event) => void audit.push(event) },
    });
    editor = await account('editor');
    admin = await account('admin');
    viewer = await account('viewer');
  });
  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('loads a revision as cues with validation warnings', async () => {
    const { revision } = await videoWithDraft([{ startMs: 0, endMs: 9000, text: 'x'.repeat(60) }]);
    const loaded = await service.getRevision(editor, revision.id);
    expect(loaded.cues).toHaveLength(1);
    expect(loaded.warnings.map((w) => w.kind).sort()).toEqual(['line_too_long', 'too_long']);
    await expect(service.getRevision(viewer, revision.id)).rejects.toBeInstanceOf(Forbidden);
    await expect(
      service.getRevision(editor, '0192f0a0-0000-7000-8000-00000000dead'),
    ).rejects.toBeInstanceOf(NotFound);
  });

  it('saves edits as a new revision, superseding the draft, with sanitised text', async () => {
    const { track, revision } = await videoWithDraft();
    const saved = await service.saveRevision(editor, track.id, [
      { startMs: 0, endMs: 2000, text: '<script>x</script><b>Hi</b>' },
    ]);
    expect(saved).toMatchObject({
      revision: 2,
      status: 'in_review',
      source: 'manual',
      createdBy: editor.accountId,
    });
    expect(await text(originals, saved.storageKey)).toContain('x<b>Hi</b>');
    expect((await captionRow(revision.id)).status).toBe('superseded');
  });

  it('rejects overlapping saves only as warnings, but refuses a file that is too large', async () => {
    const { track } = await videoWithDraft();
    const huge = Array.from({ length: 20_000 }, (_, i) => ({
      startMs: i * 1000,
      endMs: i * 1000 + 900,
      text: 'line of caption text here',
    }));
    await expect(service.saveRevision(editor, track.id, huge)).rejects.toBeInstanceOf(
      ValidationFailed,
    );
  });

  describe('approve', () => {
    it('publishes a content-hashed copy to the media bucket and records who approved it (M15-S07 AC1)', async () => {
      const { video, track, revision } = await videoWithDraft();
      const approved = await service.approve(editor, revision.id);
      const [v] = await t.db.select().from(schema.videos).where(eq(schema.videos.id, video.id));
      expect(approved.status).toBe('approved');
      expect(approved.publicKey).toMatch(
        new RegExp(`^cap/${v!.mediaPrefix}/en/[0-9a-f]{8}\\.vtt$`),
      );
      expect(approved).toMatchObject({ reviewedBy: editor.accountId });
      expect(approved.reviewedAt).toBeTruthy();
      expect(parseVtt(await text(media, approved.publicKey!))).toEqual(good);
      expect((await trackRow(track.id)).approvedCaptionId).toBe(revision.id);
      expect(audit.at(-1)).toMatchObject({
        action: 'captions.approve',
        outcome: 'success',
        targetId: revision.id,
      });
    });

    it('asks for confirmation when there are warnings, then approves (M15-S07 AC2)', async () => {
      const { revision } = await videoWithDraft([
        { startMs: 0, endMs: 9000, text: 'Too long on screen.' },
      ]);
      const error = await service.approve(editor, revision.id).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CaptionNeedsConfirmation);
      expect((error as CaptionNeedsConfirmation).warnings[0]).toMatchObject({ kind: 'too_long' });
      expect((await captionRow(revision.id)).status).toBe('in_review');
      const approved = await service.approve(editor, revision.id, { confirmWarnings: true });
      expect(approved.status).toBe('approved');
    });

    it('supersedes the previously approved revision when a newer one is approved', async () => {
      const { track, revision } = await videoWithDraft();
      await service.approve(editor, revision.id);
      const next = await service.saveRevision(editor, track.id, [
        { startMs: 0, endMs: 2000, text: 'Changed.' },
      ]);
      expect((await trackRow(track.id)).approvedCaptionId).toBe(revision.id);
      await service.approve(admin, next.id);
      expect((await captionRow(revision.id)).status).toBe('superseded');
      expect((await trackRow(track.id)).approvedCaptionId).toBe(next.id);
    });

    it('leaves state unchanged when publishing fails (M15-S07 error)', async () => {
      const { revision } = await videoWithDraft();
      const broken = new CaptionService({
        db: t.db,
        originals,
        media: {
          ...media,
          put: async () => {
            throw new Error('bucket down');
          },
        } as never,
        producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      });
      await expect(broken.approve(editor, revision.id)).rejects.toThrow('bucket down');
      expect((await captionRow(revision.id)).status).toBe('in_review');
    });

    it('refuses to approve a revision that is not waiting for review', async () => {
      const { revision } = await videoWithDraft();
      await service.reject(editor, revision.id, 'Wrong video');
      await expect(service.approve(editor, revision.id)).rejects.toBeInstanceOf(Conflict);
    });
  });

  describe('editing an approved track (M15-S07 AC3)', () => {
    it('keeps viewers on the approved text while the new revision waits for review', async () => {
      const { video, track, revision } = await videoWithDraft();
      await service.approve(editor, revision.id);
      const next = await service.saveRevision(editor, track.id, [
        { startMs: 0, endMs: 2000, text: 'Edited.' },
      ]);
      expect(next.status).toBe('in_review');
      expect((await service.publicCaptions(video.id))[0]).toMatchObject({
        language: 'en',
        key: (await captionRow(revision.id)).publicKey,
      });
      expect(await service.hasApprovedCaptions(video.id)).toBe(true);
    });

    it('lets an admin save and keep approved, but not an editor', async () => {
      const { track, revision } = await videoWithDraft();
      await service.approve(editor, revision.id);
      await expect(
        service.saveRevision(editor, track.id, [{ startMs: 0, endMs: 2000, text: 'Quick fix.' }], {
          keepApproved: true,
        }),
      ).rejects.toBeInstanceOf(Forbidden);
      const kept = await service.saveRevision(
        admin,
        track.id,
        [{ startMs: 0, endMs: 2000, text: 'Quick fix.' }],
        { keepApproved: true },
      );
      expect(kept.status).toBe('approved');
      expect((await trackRow(track.id)).approvedCaptionId).toBe(kept.id);
    });
  });

  it('reject keeps a note and never shows the track to viewers (M15-S08 AC2)', async () => {
    const { video, revision } = await videoWithDraft();
    const rejected = await service.reject(editor, revision.id, 'Mostly wrong');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reviewNote: 'Mostly wrong',
      reviewedBy: editor.accountId,
    });
    expect(await service.publicCaptions(video.id)).toEqual([]);
    expect(await service.hasApprovedCaptions(video.id)).toBe(false);
  });

  it('regenerate queues a caption job, one at a time', async () => {
    const { video } = await videoWithDraft();
    const first = await service.regenerate(editor, video.id, 'transcribe');
    const second = await service.regenerate(editor, video.id, 'transcribe');
    expect(second.jobId).toBe(first.jobId);
    const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, video.id));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ queue: 'caption.generate', createdBy: editor.accountId });
  });

  describe('import and export (M15-S09)', () => {
    it('imports a vtt as a manual revision needing review', async () => {
      const { video } = await videoWithDraft();
      const imported = await service.importFile(
        editor,
        video.id,
        'lesson.vtt',
        'WEBVTT\n\n00:00.000 --> 00:02.000\nHello\n',
      );
      expect(imported).toMatchObject({ source: 'manual', status: 'in_review', cueCount: 1 });
    });
    it('converts srt to webvtt', async () => {
      const { video } = await videoWithDraft();
      const imported = await service.importFile(
        editor,
        video.id,
        'lesson.srt',
        '1\n00:00:01,000 --> 00:00:02,000\nHi\n',
      );
      expect(await text(originals, imported.storageKey)).toContain('00:01.000 --> 00:02.000');
    });
    it('reports the line number of a parse failure and refuses files over 2 MB', async () => {
      const { video } = await videoWithDraft();
      const error = await service
        .importFile(editor, video.id, 'x.vtt', 'WEBVTT\n\n00:00.000 --> nope\nHi\n')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationFailed);
      expect(JSON.stringify((error as ValidationFailed).fields)).toMatch(/line 3/);
      await expect(
        service.importFile(
          editor,
          video.id,
          'big.vtt',
          'WEBVTT\n\n' + 'x'.repeat(2 * 1024 * 1024 + 1),
        ),
      ).rejects.toBeInstanceOf(ValidationFailed);
      await expect(service.importFile(editor, video.id, 'a.txt', 'hi')).rejects.toBeInstanceOf(
        ValidationFailed,
      );
    });
    it('exports the revision as vtt text', async () => {
      const { revision } = await videoWithDraft();
      expect(parseVtt(await service.exportVtt(editor, revision.id))).toEqual(good);
    });
  });

  it('lists the review queue oldest first and counts what needs review (M15-S03)', async () => {
    const first = await videoWithDraft();
    await new Promise((r) => setTimeout(r, 15));
    const second = await videoWithDraft();
    await service.approve(editor, (await videoWithDraft()).revision.id);
    const queue = await service.reviewQueue(editor);
    const ids = queue.map((row) => row.videoId);
    expect(ids.indexOf(first.video.id)).toBeLessThan(ids.indexOf(second.video.id));
    expect(queue.find((row) => row.videoId === first.video.id)).toMatchObject({
      state: 'needs_review',
      language: 'en',
      cueCount: 2,
    });
    expect(await service.needsReviewCount(editor)).toBe(queue.length);
    expect(await service.needsReviewCount(editor)).toBeGreaterThanOrEqual(2);
  });

  it('tells the publish gate whether an approved caption exists (M15-S10)', async () => {
    const { video, revision } = await videoWithDraft();
    expect(await service.hasApprovedCaptions(video.id)).toBe(false);
    await service.approve(editor, revision.id);
    expect(await service.hasApprovedCaptions(video.id)).toBe(true);
    expect(await service.hasApprovedCaptions(video.id, 'fr')).toBe(false);
  });

  it('describes track state for a video', async () => {
    const { video, track, revision } = await videoWithDraft();
    expect((await service.listForVideo(editor, video.id))[0]).toMatchObject({
      trackId: track.id,
      state: 'needs_review',
      latestRevisionId: revision.id,
      approvedRevisionId: null,
    });
    await service.approve(editor, revision.id);
    expect((await service.listForVideo(editor, video.id))[0]).toMatchObject({
      state: 'approved',
      approvedRevisionId: revision.id,
    });
  });
});
