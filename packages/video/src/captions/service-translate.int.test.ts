import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeAccount, makeVideo, type TestDatabase } from '@ad/db/testing';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import { Forbidden, ValidationFailed, type Actor } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureTrack, storeRevision } from './revisions';
import { CaptionService, type TranslationCapability } from './service';

const secret = new Uint8Array(32).fill(7);
const cues = [
  { startMs: 0, endMs: 2000, text: 'Welcome to the lesson.' },
  { startMs: 2500, endMs: 4500, text: 'Today we learn fractions.' },
];

describe.skipIf(!integrationEnabled())('CaptionService translation requests', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let boss: FakeBoss;
  let editor: Actor;
  let viewer: Actor;
  let audit: { action: string; targetId?: string | null; metadata?: Record<string, unknown> }[];
  const provider: TranslationCapability = {
    name: 'google',
    supports: (s, tg) => ['en', 'yo', 'ig', 'ha'].includes(s) && ['en', 'yo', 'ig', 'ha'].includes(tg),
    usdPerMillionChars: 20,
  };

  const build = (over: { translation?: TranslationCapability | null; languages?: string[] } = {}) =>
    new CaptionService({
      db: t.db,
      originals,
      media: originals,
      producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      audit: { record: async (e) => void audit.push(e) },
      translation: over.translation === null ? undefined : (over.translation ?? provider),
      captionLanguages: async () => over.languages ?? ['en', 'yo', 'ha'],
    });

  async function account(role: 'viewer' | 'editor'): Promise<Actor> {
    const row = makeAccount({ role });
    await t.db.insert(schema.accounts).values(row);
    return { accountId: row.id, role };
  }
  async function approvedVideo(language = 'en') {
    const video = makeVideo({ createdBy: editor.accountId, status: 'ready', durationMs: 5000 });
    await t.db.insert(schema.videos).values({ ...video, language });
    const track = await ensureTrack(t.db, video.id, language);
    const rev = await storeRevision(t.db, originals, track, { cues, source: 'whisper' });
    await t.db
      .update(schema.captions)
      .set({ status: 'approved', reviewedBy: editor.accountId, reviewedAt: new Date(), publicKey: `cap/${rev.id}.vtt` })
      .where(eq(schema.captions.id, rev.id));
    await t.db.update(schema.captionTracks).set({ approvedCaptionId: rev.id }).where(eq(schema.captionTracks.id, track.id));
    return { video, track, rev };
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-captr-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    boss = new FakeBoss();
    await ensureQueues(boss);
    audit = [];
    editor = await account('editor');
    viewer = await account('viewer');
  });
  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('requestTranslation is Editor and above', async () => {
    const { video } = await approvedVideo();
    await expect(build().requestTranslation(viewer, video.id, 'yo')).rejects.toBeInstanceOf(Forbidden);
    const res = await build().requestTranslation(editor, video.id, 'yo');
    expect(res.deduped).toBe(false);
    expect(audit.some((e) => e.action === 'caption.translate.request' && e.metadata?.language === 'yo')).toBe(true);
  });

  it('a second request for the same video while one is open is deduplicated', async () => {
    const { video } = await approvedVideo();
    const svc = build();
    await svc.requestTranslation(editor, video.id, 'yo');
    expect((await svc.requestTranslation(editor, video.id, 'ha')).deduped).toBe(true);
  });

  it('refuses a language not in content.languages', async () => {
    const { video } = await approvedVideo();
    await expect(build().requestTranslation(editor, video.id, 'ig')).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('refuses a language the provider cannot do', async () => {
    const { video } = await approvedVideo();
    const svc = build({ translation: { ...provider, supports: () => false }, languages: ['en', 'yo'] });
    await expect(svc.requestTranslation(editor, video.id, 'yo')).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('says plainly that no engine is configured', async () => {
    const { video } = await approvedVideo();
    await expect(build({ translation: null }).requestTranslation(editor, video.id, 'yo')).rejects.toThrow(/not set up|not configured/i);
  });

  it('refuses the spoken language and an unapproved source', async () => {
    const { video } = await approvedVideo();
    await expect(build().requestTranslation(editor, video.id, 'en')).rejects.toBeInstanceOf(ValidationFailed);
    const bare = makeVideo({ createdBy: editor.accountId, status: 'ready', durationMs: 5000 });
    await t.db.insert(schema.videos).values(bare);
    await expect(build().requestTranslation(editor, bare.id, 'yo')).rejects.toThrow(/approve/i);
  });

  it('estimate returns characters and the provider cost', async () => {
    const { video } = await approvedVideo();
    const est = await build().estimateTranslation(editor, video.id, 'yo');
    expect(est).toMatchObject({ configured: true, provider: 'google', supported: true, cues: 2, sourceLanguage: 'en' });
    expect(est.characters).toBe(cues.map((c) => c.text).join('').length);
    expect(est.estimatedUsd).toBeCloseTo((est.characters * 20) / 1_000_000, 8);
    expect((await build({ translation: null }).estimateTranslation(editor, video.id, 'yo')).configured).toBe(false);
  });

  it('translationState reports source changed when the source sha differs', async () => {
    const { video, track, rev } = await approvedVideo();
    const target = await ensureTrack(t.db, video.id, 'yo', 'Yorùbá', { kind: 'subtitles', published: false, isDefault: false });
    const tr = await storeRevision(t.db, originals, target, {
      cues,
      source: 'translation',
      sourceCaptionId: rev.id,
      sourceSha256: Buffer.from(rev.sha256),
    });
    await t.db
      .update(schema.captions)
      .set({ status: 'approved', reviewedBy: editor.accountId, reviewedAt: new Date(), publicKey: 'cap/yo.vtt' })
      .where(eq(schema.captions.id, tr.id));
    await t.db.update(schema.captionTracks).set({ approvedCaptionId: tr.id }).where(eq(schema.captionTracks.id, target.id));
    const svc = build();
    expect(await svc.translationState(video.id, 'yo')).toMatchObject({ state: 'approved', sourceChanged: false, published: false });
    const next = await storeRevision(t.db, originals, track, { cues: [{ startMs: 0, endMs: 2000, text: 'Changed.' }], source: 'manual', createdBy: editor.accountId });
    await t.db
      .update(schema.captions)
      .set({ status: 'approved', reviewedBy: editor.accountId, reviewedAt: new Date(), publicKey: 'cap/en2.vtt' })
      .where(eq(schema.captions.id, next.id));
    await t.db.update(schema.captionTracks).set({ approvedCaptionId: next.id }).where(eq(schema.captionTracks.id, track.id));
    expect((await svc.translationState(video.id, 'yo')).sourceChanged).toBe(true);
    expect(await svc.translationState(video.id, 'ha')).toMatchObject({ state: 'none', sourceChanged: false });
  });
});
