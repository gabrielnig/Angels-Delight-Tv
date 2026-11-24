import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeAccount, makeVideo, type TestDatabase } from '@ad/db/testing';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import { Conflict, Forbidden, type Actor } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureTrack, storeRevision } from './revisions';
import { CaptionService } from './service';

const secret = new Uint8Array(32).fill(8);
const cues = [{ startMs: 0, endMs: 2000, text: 'Welcome.' }];

describe.skipIf(!integrationEnabled())('caption language publishing', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let editor: Actor;
  let admin: Actor;
  let languages: string[];
  let audit: { action: string; metadata?: Record<string, unknown> }[];
  let service: CaptionService;

  async function account(role: 'editor' | 'admin'): Promise<Actor> {
    const row = makeAccount({ role });
    await t.db.insert(schema.accounts).values(row);
    return { accountId: row.id, role };
  }
  /** A video with English approved plus a Yoruba translation in the given state. */
  async function video(yo: 'approved' | 'in_review' | 'none' = 'approved', published = false) {
    const v = makeVideo({ createdBy: editor.accountId, status: 'ready', durationMs: 5000 });
    await t.db.insert(schema.videos).values(v);
    const approve = async (trackId: string, revId: string, key: string) => {
      await t.db
        .update(schema.captions)
        .set({ status: 'approved', reviewedBy: editor.accountId, reviewedAt: new Date(), publicKey: key })
        .where(eq(schema.captions.id, revId));
      await t.db.update(schema.captionTracks).set({ approvedCaptionId: revId }).where(eq(schema.captionTracks.id, trackId));
    };
    const en = await ensureTrack(t.db, v.id, 'en');
    const enRev = await storeRevision(t.db, originals, en, { cues, source: 'whisper' });
    await approve(en.id, enRev.id, `cap/${v.id}/en.vtt`);
    let yoTrack = null;
    if (yo !== 'none') {
      yoTrack = await ensureTrack(t.db, v.id, 'yo', 'Yorùbá', { kind: 'subtitles', published, isDefault: false });
      const rev = await storeRevision(t.db, originals, yoTrack, { cues, source: 'translation', sourceCaptionId: enRev.id });
      if (yo === 'approved') await approve(yoTrack.id, rev.id, `cap/${v.id}/yo.vtt`);
    }
    return { v, yoTrack };
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-pub-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    const boss = new FakeBoss();
    await ensureQueues(boss);
    audit = [];
    languages = ['en', 'yo'];
    editor = await account('editor');
    admin = await account('admin');
    service = new CaptionService({
      db: t.db,
      originals,
      media: originals,
      producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      audit: { record: async (e) => void audit.push(e) },
      captionLanguages: async () => languages,
    });
  });
  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('publicCaptions omits approved but unpublished tracks', async () => {
    const { v } = await video('approved', false);
    expect((await service.publicCaptions(v.id)).map((c) => c.language)).toEqual(['en']);
  });

  it('publicCaptions lists a published approved translation', async () => {
    const { v } = await video('approved', true);
    expect((await service.publicCaptions(v.id)).map((c) => c.language).sort()).toEqual(['en', 'yo']);
  });

  it('publicCaptions omits a language removed from content.languages', async () => {
    const { v } = await video('approved', true);
    languages = ['en'];
    try {
      expect((await service.publicCaptions(v.id)).map((c) => c.language)).toEqual(['en']);
    } finally {
      languages = ['en', 'yo'];
    }
  });

  it('publicCaptions never lists draft, in_review or rejected tracks', async () => {
    const { v } = await video('in_review', true);
    expect((await service.publicCaptions(v.id)).map((c) => c.language)).toEqual(['en']);
  });

  it('only an Admin can publish, an Editor gets Forbidden', async () => {
    const { v } = await video('approved', false);
    await expect(service.setPublished(editor, v.id, 'yo', true)).rejects.toBeInstanceOf(Forbidden);
  });

  it('publishing makes the track visible and unpublishing takes effect on the next read', async () => {
    const { v } = await video('approved', false);
    await service.setPublished(admin, v.id, 'yo', true);
    expect((await service.publicCaptions(v.id)).map((c) => c.language).sort()).toEqual(['en', 'yo']);
    await service.setPublished(admin, v.id, 'yo', false);
    expect((await service.publicCaptions(v.id)).map((c) => c.language)).toEqual(['en']);
    expect(audit.filter((e) => e.action.startsWith('caption.language.')).map((e) => e.action).slice(-2)).toEqual([
      'caption.language.publish',
      'caption.language.unpublish',
    ]);
  });

  it('refuses to publish a track that has no approved revision', async () => {
    const { v } = await video('in_review', false);
    await expect(service.setPublished(admin, v.id, 'yo', true)).rejects.toBeInstanceOf(Conflict);
    await expect(service.setPublished(admin, v.id, 'ha', true)).rejects.toBeInstanceOf(Conflict);
  });
});
