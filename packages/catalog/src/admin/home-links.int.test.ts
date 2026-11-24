import { eq } from 'drizzle-orm';
import { schema } from '@ad/db';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listPublishedRows } from '../rows';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import { getAdminHome, publishAdminHome, restorePreviousAdminHome, type HomeConfig, type HomeRowConfig } from './home';
import type { AdminContext } from './types';

const row = (extra: Partial<HomeRowConfig> & { id: string }): HomeRowConfig => ({
  type: 'manual',
  name: 'Row',
  visible: true,
  videoIds: [],
  sourceId: null,
  ...extra,
});

describe.skipIf(!integrationEnabled())('admin home links (M41-S06, S08)', () => {
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
  const live = () => t.setup.transaction((tx) => listPublishedRows(tx, { kids: false }));

  it('writes slug, View all, minimum and kids visibility to the rows and reads them back', async () => {
    const v = await seedVideo(t.setup, { title: 'One' });
    const config: HomeConfig = {
      heroIds: [],
      rows: [
        row({ id: 'a', name: 'Start   here', videoIds: [v.id], slug: 'start-here', viewAllMode: 'custom', viewAllUrl: 'https://example.org/x', minItems: 3, kidsVisible: false }),
        row({ id: 'b', type: 'newest', name: 'New', viewAllMode: 'none' }),
        row({ id: 'c', type: 'each_category', name: 'Subjects' }),
        row({ id: 'd', type: 'all_series', name: 'Series' }),
      ],
    };
    expect(await publishAdminHome(ctx, editor, config)).toEqual({ ok: true });
    const rows = await t.setup.select().from(schema.rows).orderBy(schema.rows.position);
    expect(rows.map((r) => r.kind)).toEqual(['curated', 'recently_added', 'each_category', 'all_series']);
    expect(rows[0]).toMatchObject({ title: 'Start here', slug: 'start-here', viewAllMode: 'custom', viewAllUrl: 'https://example.org/x', minItems: 3, kidsVisible: false });
    expect(rows[1]).toMatchObject({ viewAllMode: 'none', minItems: 1, kidsVisible: true });
    expect(rows[2]).toMatchObject({ minItems: 4 });
    expect(rows[3]).toMatchObject({ minItems: 2 });
    expect((await live()).map((r) => r.slug)).toEqual(['start-here', null, null, null]);

    const back = (await getAdminHome(ctx, editor)).state.published.rows;
    expect(back[0]).toMatchObject({ slug: 'start-here', viewAllMode: 'custom', minItems: 3, kidsVisible: false });
  });

  it('hides a section that is not kids visible from a kids audience', async () => {
    const kidsRows = await t.setup.transaction((tx) => listPublishedRows(tx, { kids: true }));
    expect(kidsRows.map((r) => r.title)).not.toContain('Start here');
  });

  it('gives a manual section without a slug one from its name, unique among sections', async () => {
    await publishAdminHome(ctx, editor, {
      heroIds: [],
      rows: [row({ id: 'x', name: 'Farm tips' }), row({ id: 'y', name: 'Farm tips' })],
    });
    expect((await live()).map((r) => r.slug)).toEqual(['farm-tips', 'farm-tips-2']);
  });

  it('refuses an invalid custom link and a missing name before writing', async () => {
    const bad = await publishAdminHome(ctx, editor, {
      heroIds: [],
      rows: [row({ id: 'z', viewAllMode: 'custom', viewAllUrl: '//x.com' })],
    });
    expect(bad).toEqual({ ok: false, error: 'Use a path on this site or an https link' });
    const none = await publishAdminHome(ctx, editor, { heroIds: [], rows: [row({ id: 'z', name: ' ' })] });
    expect(none).toEqual({ ok: false, error: 'Give the section a name' });
  });

  it('restores the earlier version with its link fields', async () => {
    await publishAdminHome(ctx, editor, { heroIds: [], rows: [row({ id: 'p', name: 'First', slug: 'first', viewAllMode: 'none', minItems: 5 })] });
    await publishAdminHome(ctx, editor, { heroIds: [], rows: [row({ id: 'q', name: 'Second' })] });
    expect(await restorePreviousAdminHome(ctx, editor)).toEqual({ ok: true });
    const [r] = await t.setup.select().from(schema.rows).where(eq(schema.rows.title, 'First'));
    expect(r).toMatchObject({ slug: 'first', viewAllMode: 'none', minItems: 5 });
  });
});
