import { eq, sql } from 'drizzle-orm';
import { series, slugRedirects, videos } from '@ad/db';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import { updateAdminSeries } from './series';
import { updateAdminVideo } from './videos';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('slug changes leave redirects (M04-S02)', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  const redirects = (column: 'videoId' | 'seriesId', id: string) =>
    t.setup
      .select({ old: slugRedirects.oldSlug })
      .from(slugRedirects)
      .where(eq(slugRedirects[column], id));

  it('keeps the old video address as a redirect when the address changes', async () => {
    const v = await seedVideo(t.setup, { slug: 'old-address' });
    const out = await updateAdminVideo(ctx, editor, v.id, { slug: 'new-address' });
    expect(out.slug).toBe('new-address');
    expect(await redirects('videoId', v.id)).toEqual([{ old: 'old-address' }]);
  });

  it('does nothing when the address is unchanged', async () => {
    const v = await seedVideo(t.setup, { slug: 'same-one' });
    await updateAdminVideo(ctx, editor, v.id, { slug: 'same-one', title: 'Renamed' });
    expect(await redirects('videoId', v.id)).toEqual([]);
  });

  it('refuses an address another live video uses, and one that is not a valid slug', async () => {
    await seedVideo(t.setup, { slug: 'taken-address' });
    const v = await seedVideo(t.setup, { slug: 'mine-address' });
    await expect(updateAdminVideo(ctx, editor, v.id, { slug: 'taken-address' })).rejects.toMatchObject({
      fields: { slug: [expect.stringMatching(/already/i)] },
    });
    await expect(updateAdminVideo(ctx, editor, v.id, { slug: 'Not Valid!' })).rejects.toMatchObject({
      fields: { slug: [expect.any(String)] },
    });
    const [row] = await t.setup.select({ slug: videos.slug }).from(videos).where(eq(videos.id, v.id));
    expect(row!.slug).toBe('mine-address');
  });

  it('drops the redirect when the video moves back to an old address, and chains stay one hop', async () => {
    const v = await seedVideo(t.setup, { slug: 'first-name' });
    await updateAdminVideo(ctx, editor, v.id, { slug: 'second-name' });
    await updateAdminVideo(ctx, editor, v.id, { slug: 'third-name' });
    expect((await redirects('videoId', v.id)).map((r) => r.old).sort()).toEqual([
      'first-name',
      'second-name',
    ]);
    await updateAdminVideo(ctx, editor, v.id, { slug: 'first-name' });
    expect((await redirects('videoId', v.id)).map((r) => r.old).sort()).toEqual([
      'second-name',
      'third-name',
    ]);
  });

  it('leaves a redirect for a series address change too', async () => {
    const s = await seedSeries(t.setup, { series: { slug: 'series-before' } });
    const result = await updateAdminSeries(ctx, editor, s.id, { slug: 'series-after' });
    expect(result.ok).toBe(true);
    const [row] = await t.setup.select({ slug: series.slug }).from(series).where(eq(series.id, s.id));
    expect(row!.slug).toBe('series-after');
    expect(await redirects('seriesId', s.id)).toEqual([{ old: 'series-before' }]);
    const other = await seedSeries(t.setup, { series: { slug: 'series-other' } });
    const clash = await updateAdminSeries(ctx, editor, other.id, { slug: 'series-after' });
    expect(clash.ok).toBe(false);
  });

  it('writes the change to the audit log', async () => {
    const v = await seedVideo(t.setup, { slug: 'audit-before' });
    await updateAdminVideo(ctx, editor, v.id, { slug: 'audit-after' });
    const rows = await t.setup.execute(
      sql`SELECT metadata FROM audit_log WHERE target_id = ${v.id} AND action = 'video.update'`,
    );
    expect(JSON.stringify(rows)).toContain('audit-after');
  });
});
