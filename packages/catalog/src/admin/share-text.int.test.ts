import { eq, sql } from 'drizzle-orm';
import { series, videos } from '@ad/db';
import { ValidationFailed, type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import { getShareText, setShareText } from './share-text';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('share text per title (L15b)', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let viewer: Actor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup, 'viewer')).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('saves a share title and description for a video, reads them back and audits it', async () => {
    const v = await seedVideo(t.setup, { slug: 'share-me' });
    await setShareText(ctx, editor, 'video', v.id, { title: ' Rivers, told well ', description: 'A short film.' });
    expect(await getShareText(ctx, editor, 'video', v.id)).toEqual({ title: 'Rivers, told well', description: 'A short film.' });
    const row = (await t.setup.select().from(videos).where(eq(videos.id, v.id)))[0]!;
    expect(row.shareTitle).toBe('Rivers, told well');
    const audit = await t.setup.execute(
      sql`SELECT action FROM audit_log WHERE target_id = ${v.id} AND action = 'video.share_text'`,
    );
    expect((audit as unknown as { rows?: unknown[] }).rows?.length ?? (audit as unknown as unknown[]).length).toBe(1);
  });

  it('clears the share words with empty text, for a series too', async () => {
    const s = await seedSeries(t.setup, { series: { slug: 'share-series' }, seasonSizes: [1] });
    await setShareText(ctx, editor, 'series', s.id, { title: 'Hello', description: 'World' });
    await setShareText(ctx, editor, 'series', s.id, { title: '', description: '' });
    expect(await getShareText(ctx, editor, 'series', s.id)).toEqual({ title: null, description: null });
    const row = (await t.setup.select().from(series).where(eq(series.id, s.id)))[0]!;
    expect(row.shareDescription).toBeNull();
  });

  it('refuses too long text and markup, and refuses a viewer', async () => {
    const v = await seedVideo(t.setup, { slug: 'share-bad' });
    await expect(setShareText(ctx, editor, 'video', v.id, { title: 'x'.repeat(91) })).rejects.toBeInstanceOf(ValidationFailed);
    await expect(setShareText(ctx, editor, 'video', v.id, { description: '<b>x</b>' })).rejects.toBeInstanceOf(ValidationFailed);
    await expect(setShareText(ctx, viewer, 'video', v.id, { title: 'x' })).rejects.toThrow();
  });
});
