import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveRow, type RowDescriptor } from './rows';
import { DEFAULT_TRENDING_RULES, trendingTitles } from './trending';
import {
  createViewerTestDb,
  integrationEnabled,
  NOW,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from './testing';

const ctx = { mediaOrigin: 'https://media.test', now: () => NOW };

describe.skipIf(!integrationEnabled())('trending read path (M44-S07 to S09)', () => {
  let t: ViewerTestDb;
  beforeAll(async () => {
    t = await createViewerTestDb();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const run = <T>(fn: (tx: Parameters<Parameters<typeof t.app.transaction>[0]>[0]) => Promise<T>) =>
    t.app.transaction(fn);

  async function snapshot(
    kind: 'trending' | 'popular',
    items: Array<{ video?: string; series?: string; plays?: number }>,
    computedAt = NOW,
  ) {
    await t.setup.execute(sql`DELETE FROM title_scores WHERE kind = ${kind}`);
    let rank = 1;
    for (const item of items) {
      await t.setup.execute(sql`
        INSERT INTO title_scores (kind, video_id, series_id, score, plays, rank, computed_at)
        VALUES (${kind}, ${item.video ?? null}::uuid, ${item.series ?? null}::uuid,
          ${100 - rank}, ${item.plays ?? 20}, ${rank}, ${computedAt}::timestamptz)`);
      rank++;
    }
  }
  async function videos(n: number, over = {}) {
    return Promise.all(Array.from({ length: n }, () => seedVideo(t.setup, over)));
  }
  const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

  it('drops unpublished, kids unsafe and above limit titles and keeps order', async () => {
    const good = await videos(5, { kidsSafe: true, maturityRank: 0 });
    const draft = await seedVideo(t.setup, { publishState: 'draft' });
    const adult = await seedVideo(t.setup, { maturityRank: 3 });
    await snapshot('trending', [
      { video: good[0]!.id },
      { video: draft.id },
      { video: adult.id },
      ...good.slice(1).map((v) => ({ video: v.id })),
    ]);
    const all = await run((tx) =>
      trendingTitles(tx, ctx, { kids: false }, { kind: 'trending', limit: 20 }),
    );
    expect(ids(all)).toEqual([good[0]!.id, adult.id, ...good.slice(1).map((v) => v.id)]);
    const kids = await run((tx) =>
      trendingTitles(tx, ctx, { kids: true, maxRank: 0 }, { kind: 'trending', limit: 20 }),
    );
    expect(ids(kids)).toEqual(good.map((v) => v.id));
    const limited = await run((tx) =>
      trendingTitles(tx, ctx, { kids: false, maxRank: 2 }, { kind: 'trending', limit: 20 }),
    );
    expect(ids(limited)).not.toContain(adult.id);
  });

  it('is not returned below minTitles or minSitePlays, and series appear', async () => {
    const few = await videos(3);
    await snapshot('trending', few.map((v) => ({ video: v.id })));
    expect(
      await run((tx) => trendingTitles(tx, ctx, { kids: false }, { kind: 'trending', limit: 20 })),
    ).toEqual([]);
    const enough = await videos(4);
    const s = await seedSeries(t.setup);
    await snapshot('trending', [...enough.map((v) => ({ video: v.id, plays: 10 })), { series: s.id, plays: 10 }]);
    const cards = await run((tx) =>
      trendingTitles(tx, ctx, { kids: false }, { kind: 'trending', limit: 20 }),
    );
    expect(ids(cards)).toContain(s.id);
    expect(cards).toHaveLength(5);
    await snapshot('trending', [
      ...enough.map((v) => ({ video: v.id, plays: 1 })),
      { series: s.id, plays: 1 },
    ]);
    expect(
      await run((tx) => trendingTitles(tx, ctx, { kids: false }, { kind: 'trending', limit: 20 })),
    ).toEqual([]);
  });

  it('treats a stale snapshot as empty', async () => {
    const vs = await videos(6);
    const old = new Date(NOW.getTime() - (DEFAULT_TRENDING_RULES.maxAgeHours + 1) * 3_600_000);
    await snapshot('trending', vs.map((v) => ({ video: v.id })), old);
    expect(
      await run((tx) => trendingTitles(tx, ctx, { kids: false }, { kind: 'trending', limit: 20 })),
    ).toEqual([]);
  });

  it('Top 10 needs ten titles for the profile and ranks by position after filtering', async () => {
    const vs = await videos(12, { maturityRank: 0, kidsSafe: true });
    const adult = await seedVideo(t.setup, { maturityRank: 4 });
    await snapshot('trending', [{ video: adult.id }, ...vs.map((v) => ({ video: v.id }))]);
    const ten = await run((tx) =>
      trendingTitles(tx, ctx, { kids: true, maxRank: 0 }, { kind: 'top_ten', limit: 10 }),
    );
    expect(ids(ten)).toEqual(vs.slice(0, 10).map((v) => v.id));
    await snapshot('trending', vs.slice(0, 9).map((v) => ({ video: v.id })));
    expect(
      await run((tx) => trendingTitles(tx, ctx, { kids: false }, { kind: 'top_ten', limit: 10 })),
    ).toEqual([]);
  });

  it('popular needs at least 3 titles with 5 views each', async () => {
    const vs = await videos(3);
    await snapshot('popular', vs.map((v) => ({ video: v.id, plays: 5 })));
    expect(
      await run((tx) => trendingTitles(tx, ctx, { kids: false }, { kind: 'popular', limit: 20 })),
    ).toHaveLength(3);
    await snapshot('popular', vs.map((v) => ({ video: v.id, plays: 4 })));
    expect(
      await run((tx) => trendingTitles(tx, ctx, { kids: false }, { kind: 'popular', limit: 20 })),
    ).toEqual([]);
  });

  it('resolveRow handles trending, top_ten and most_liked rows', async () => {
    const vs = await videos(11, { maturityRank: 0, kidsSafe: true });
    await snapshot('trending', vs.map((v) => ({ video: v.id })));
    const row = (kind: RowDescriptor['kind']): RowDescriptor => ({
      id: 'r',
      title: 'Row',
      kind,
      categorySlug: null,
      seriesId: null,
      seriesSlug: null,
      slug: null,
      viewAllMode: 'auto',
      viewAllUrl: null,
      minItems: 1,
      maxItems: 20,
    });
    const trending = await run((tx) => resolveRow(tx, ctx, { kids: false }, row('trending')));
    expect(trending.cards).toHaveLength(11);
    const top = await run((tx) => resolveRow(tx, ctx, { kids: false }, row('top_ten')));
    expect(top.cards).toHaveLength(10);
    await t.setup.execute(
      sql`INSERT INTO title_rating_stats (video_id, likes, loves, dislikes, most_liked) VALUES (${vs[2]!.id}, 9, 3, 0, true)`,
    );
    const liked = await run((tx) => resolveRow(tx, ctx, { kids: false }, row('most_liked')));
    expect(ids(liked.cards)).toEqual([vs[2]!.id]);
  });
});
