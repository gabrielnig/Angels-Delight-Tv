import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeAccount, makeVideo, type TestDatabase } from '@ad/db/testing';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseVtt, validateCues, type Cue } from '../vtt';
import { ensureTrack, storeRevision } from './revisions';
import { FakeTranslator } from './translate/fake';
import type { Translator } from './translate/types';
import { CaptionTranslator } from './translator-job';

const secret = new Uint8Array(32).fill(3);
const cues: Cue[] = [
  { startMs: 500, endMs: 2500, text: 'Welcome to Angels Delight TV.' },
  { startMs: 3000, endMs: 5200, text: 'Today we learn\nabout fractions.' },
];

describe.skipIf(!integrationEnabled())('CaptionTranslator against Postgres and local storage', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  const progress = async () => undefined;

  /** A ready video whose spoken language track has one approved revision. */
  async function videoWithSource(opts: { language?: string; approve?: boolean; cues?: Cue[] } = {}) {
    const owner = makeAccount({ role: 'editor' });
    await t.db.insert(schema.accounts).values(owner);
    const video = makeVideo({ createdBy: owner.id, status: 'ready', durationMs: 6000 });
    await t.db.insert(schema.videos).values({ ...video, language: opts.language ?? 'en' });
    const track = await ensureTrack(t.db, video.id, opts.language ?? 'en');
    const rev = await storeRevision(t.db, originals, track, { cues: opts.cues ?? cues, source: 'whisper' });
    if (opts.approve !== false) {
      await t.db
        .update(schema.captions)
        .set({ status: 'approved', reviewedBy: owner.id, reviewedAt: new Date(), publicKey: `cap/x/${rev.id}.vtt` })
        .where(eq(schema.captions.id, rev.id));
      await t.db.update(schema.captionTracks).set({ approvedCaptionId: rev.id }).where(eq(schema.captionTracks.id, track.id));
    }
    return { video, owner, track, rev };
  }
  const make = (translator: Translator = new FakeTranslator(), extra: Record<string, unknown> = {}) =>
    new CaptionTranslator({ db: t.db, originals, translator, ...extra });
  const trackOf = async (videoId: string, language: string) => {
    const [track] = await t.db.select().from(schema.captionTracks).where(eq(schema.captionTracks.videoId, videoId));
    const all = await t.db.select().from(schema.captionTracks).where(eq(schema.captionTracks.videoId, videoId));
    return all.find((x) => x.language === language) ?? track;
  };
  const revisionsOf = async (trackId: string) =>
    t.db.select().from(schema.captions).where(eq(schema.captions.trackId, trackId)).orderBy(schema.captions.revision);
  const read = async (key: string) => {
    const chunks: Buffer[] = [];
    for await (const c of await originals.get(key)) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  };

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-translate-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
  });
  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('creates an in_review revision with source translation on an unpublished subtitles track', async () => {
    const { video } = await videoWithSource();
    await make().translate(video.id, 'yo', {}, progress);
    const track = await trackOf(video.id, 'yo');
    expect(track).toMatchObject({ language: 'yo', label: 'Yorùbá', kind: 'subtitles', published: false, isDefault: false });
    const [row] = await revisionsOf(track!.id);
    expect(row).toMatchObject({ revision: 1, source: 'translation', status: 'in_review', cueCount: 2 });
  });

  it('copies cue timings unchanged', async () => {
    const { video } = await videoWithSource();
    await make().translate(video.id, 'ha', {}, progress);
    const track = await trackOf(video.id, 'ha');
    const [row] = await revisionsOf(track!.id);
    const out = parseVtt(await read(row!.storageKey));
    expect(out.map((c) => [c.startMs, c.endMs])).toEqual(cues.map((c) => [c.startMs, c.endMs]));
    expect(out[0]!.text).toContain('[ha]');
  });

  it('reflows to 2 lines of 42 characters and keeps validation warnings', async () => {
    const long: Translator = {
      name: 'long',
      supports: () => true,
      async translate(req) {
        return { texts: req.texts.map(() => 'ọrọ gígùn jùlọ tí a kọ síbí fún ìdánwò àti àtúnṣe àwọn ìlà tó pọ̀ jù'), model: 'long', chars: 10 };
      },
    };
    const { video } = await videoWithSource();
    await make(long).translate(video.id, 'yo', {}, progress);
    const track = await trackOf(video.id, 'yo');
    const [row] = await revisionsOf(track!.id);
    const out = parseVtt(await read(row!.storageKey));
    for (const c of out) {
      const lines = c.text.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines.every((l) => l.length <= 42)).toBe(true);
    }
    const unbreakable: Translator = { ...long, async translate(req) { return { texts: req.texts.map(() => 'a'.repeat(60)), model: 'x', chars: 1 }; } };
    const second = await videoWithSource();
    await make(unbreakable).translate(second.video.id, 'yo', {}, progress);
    const t2 = await trackOf(second.video.id, 'yo');
    const [r2] = await revisionsOf(t2!.id);
    expect(validateCues(parseVtt(await read(r2!.storageKey))).map((w) => w.kind)).toContain('line_too_long');
  });

  it('records source_caption_id and source_sha256', async () => {
    const { video, rev } = await videoWithSource();
    await make().translate(video.id, 'ig', {}, progress);
    const track = await trackOf(video.id, 'ig');
    const [row] = await revisionsOf(track!.id);
    expect(row!.sourceCaptionId).toBe(rev.id);
    expect(Buffer.from(row!.sourceSha256!).equals(Buffer.from(rev.sha256))).toBe(true);
  });

  it('model records the engine', async () => {
    const { video } = await videoWithSource();
    await make().translate(video.id, 'yo', {}, progress);
    const track = await trackOf(video.id, 'yo');
    expect((await revisionsOf(track!.id))[0]!.model).toBe('fake');
  });

  it('protects glossary terms', async () => {
    const { video } = await videoWithSource();
    const tr: Translator = {
      name: 'swap',
      supports: () => true,
      async translate(req) {
        return { texts: req.texts.map((x) => x.replace('Welcome to', 'Kaabo si')), model: 'swap', chars: 5 };
      },
    };
    await make(tr, { glossary: async () => 'Angels Delight TV' }).translate(video.id, 'yo', {}, progress);
    const track = await trackOf(video.id, 'yo');
    const out = parseVtt(await read((await revisionsOf(track!.id))[0]!.storageKey));
    expect(out[0]!.text).toBe('Kaabo si Angels Delight TV.');
  });

  it('no speech in the source gives a clear permanent error', async () => {
    const { video } = await videoWithSource({ cues: [] });
    await expect(make().translate(video.id, 'yo', {}, progress)).rejects.toMatchObject({ permanent: true, message: expect.stringMatching(/no speech|nothing to translate/i) });
  });

  it('an unapproved source is refused', async () => {
    const { video } = await videoWithSource({ approve: false });
    await expect(make().translate(video.id, 'yo', {}, progress)).rejects.toMatchObject({ permanent: true, message: expect.stringMatching(/approved/i) });
  });

  it('refuses a target equal to the spoken language', async () => {
    const { video } = await videoWithSource();
    await expect(make().translate(video.id, 'en', {}, progress)).rejects.toMatchObject({ permanent: true });
  });

  it('a Yoruba spoken video can be translated into English', async () => {
    const { video } = await videoWithSource({ language: 'yo' });
    await make().translate(video.id, 'en', {}, progress);
    const track = await trackOf(video.id, 'en');
    expect(track).toMatchObject({ language: 'en', label: 'English', published: false });
  });

  it('a rerun adds a revision and keeps the approved one live until approved', async () => {
    const { video, owner } = await videoWithSource();
    await make().translate(video.id, 'yo', {}, progress);
    const track = await trackOf(video.id, 'yo');
    const [first] = await revisionsOf(track!.id);
    await t.db
      .update(schema.captions)
      .set({ status: 'approved', reviewedBy: owner.id, reviewedAt: new Date(), publicKey: 'cap/x/yo.vtt' })
      .where(eq(schema.captions.id, first!.id));
    await t.db.update(schema.captionTracks).set({ approvedCaptionId: first!.id, published: true }).where(eq(schema.captionTracks.id, track!.id));
    await make().translate(video.id, 'yo', {}, progress);
    const rows = await revisionsOf(track!.id);
    expect(rows.map((r) => [r.revision, r.status])).toEqual([[1, 'approved'], [2, 'in_review']]);
    const after = await trackOf(video.id, 'yo');
    expect(after).toMatchObject({ approvedCaptionId: first!.id, published: true });
  });

  it('refuses a job over the character limit before any call', async () => {
    const { video } = await videoWithSource();
    await expect(make(new FakeTranslator(), { maxChars: 10 }).translate(video.id, 'yo', {}, progress)).rejects.toMatchObject({ permanent: true });
  });
});
