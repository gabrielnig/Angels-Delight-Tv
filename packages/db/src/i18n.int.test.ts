import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { captionTracks, captions, uiTranslations, videos } from './schema';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from './testing';

describe.skipIf(!integrationEnabled())('i18n tables and caption language columns', () => {
  let t: TestDatabase;
  let videoId: string;
  let editorId: string;
  beforeAll(async () => {
    t = await createTestDatabase();
    const video = makeVideo();
    await t.db.insert(videos).values(video);
    videoId = video.id;
    const editor = makeAccount({ role: 'editor' });
    await t.pool.query(
      'INSERT INTO accounts (id, email_hash, email_enc, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
      [editor.id, editor.emailHash, editor.emailEnc, editor.passwordHash, 'editor'],
    );
    editorId = editor.id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  const row = (key: string, extra: Partial<typeof uiTranslations.$inferInsert> = {}) => ({
    locale: 'yo',
    key,
    text: 'Bẹ̀rẹ̀',
    ...extra,
  });

  it('ui_translations is unique per locale and key', async () => {
    await t.db.insert(uiTranslations).values(row('nav.home'));
    await expect(t.db.insert(uiTranslations).values(row('nav.home'))).rejects.toThrow();
    await t.db.insert(uiTranslations).values(row('nav.home', { locale: 'ha' }));
  });
  it('ui_translations rejects an unknown locale', async () => {
    await expect(t.db.insert(uiTranslations).values(row('nav.a', { locale: 'fr' }))).rejects.toThrow();
  });
  it('ui_translations rejects a key over 120 characters', async () => {
    await expect(t.db.insert(uiTranslations).values(row('k'.repeat(121)))).rejects.toThrow();
  });

  it('caption_tracks.published defaults to true for existing rows', async () => {
    await t.db.insert(captionTracks).values({ videoId, language: 'en', label: 'English', kind: 'captions' });
    const [track] = await t.db.select().from(captionTracks).where(eq(captionTracks.videoId, videoId));
    expect(track?.published).toBe(true);
  });

  const caption = (trackId: string, revision: number, extra: Record<string, unknown> = {}) => ({
    trackId,
    revision,
    source: 'manual' as const,
    storageKey: `k/${revision}`,
    sha256: randomBytes(32),
    bytes: 10,
    cueCount: 1,
    ...extra,
  });

  it('a translation caption may reference its source revision', async () => {
    const [en] = await t.db.select().from(captionTracks).where(eq(captionTracks.videoId, videoId));
    const [src] = await t.db.insert(captions).values(caption(en!.id, 1)).returning();
    const [yo] = await t.db
      .insert(captionTracks)
      .values({ videoId, language: 'yo', label: 'Yorùbá', kind: 'subtitles', published: false })
      .returning();
    const [tr] = await t.db
      .insert(captions)
      .values(caption(yo!.id, 1, { source: 'translation', sourceCaptionId: src!.id, sourceSha256: src!.sha256 }))
      .returning();
    expect(tr?.sourceCaptionId).toBe(src!.id);
  });
  it('a non translation caption may not carry a source revision', async () => {
    const [en] = await t.db.select().from(captionTracks).where(eq(captionTracks.language, 'en'));
    const [src] = await t.db.select().from(captions).where(eq(captions.trackId, en!.id));
    await expect(
      t.db.insert(captions).values(caption(en!.id, 2, { sourceCaptionId: src!.id })),
    ).rejects.toThrow();
  });

  it('recording a missing key twice increments hits', async () => {
    await asRole(t.pool, 'ad_app', {}, async (c) => {
      await c.query("SELECT record_missing_key('yo', 'nav.home', 1)");
      await c.query("SELECT record_missing_key('yo', 'nav.home', 4)");
    });
    const r = await t.pool.query("SELECT hits FROM ui_missing_keys WHERE locale='yo' AND key='nav.home'");
    expect(r.rows[0].hits).toBe(5);
  });
  it('the missing key table is capped at 10000 keys per locale', async () => {
    await t.pool.query(
      "INSERT INTO ui_missing_keys (locale, key, hits) SELECT 'ig', 'k.' || g, 1 FROM generate_series(1, 10000) g",
    );
    await asRole(t.pool, 'ad_app', {}, (c) => c.query("SELECT record_missing_key('ig', 'k.new', 1)"));
    const r = await t.pool.query("SELECT count(*)::int AS n FROM ui_missing_keys WHERE locale='ig'");
    expect(r.rows[0].n).toBe(10000);
  });

  it('a viewer role can record a missing key but cannot read ui_translations drafts', async () => {
    await t.pool.query("INSERT INTO ui_translations (locale, key, text, status) VALUES ('ha','a.draft','\"x\"','draft'), ('ha','a.live','\"y\"','approved')");
    await asRole(t.pool, 'ad_app', {}, async (c) => {
      const keys = (await c.query("SELECT key FROM ui_translations WHERE locale='ha'")).rows.map((r) => r.key);
      expect(keys).toContain('a.live');
      expect(keys).not.toContain('a.draft');
      expect((await c.query('SELECT * FROM ui_missing_keys')).rows).toHaveLength(0);
    });
    await asRole(t.pool, 'ad_app', { accountId: editorId, actorRole: 'editor' }, async (c) => {
      const keys = (await c.query("SELECT key FROM ui_translations WHERE locale='ha'")).rows.map((r) => r.key);
      expect(keys).toContain('a.draft');
    });
  });
});
