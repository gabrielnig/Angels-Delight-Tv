import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { annotateCards } from './annotate';
import { withAccount } from '@ad/db';
import { getRatings, listMyRatings, setRating } from './ratings';
import { fetchCards } from '@ad/catalog';
import { catalogContext } from './context';
import { updateProfile } from './profiles';
import { createHarness, NOW, seedSeries, seedVideo, type ViewerHarness } from './testing';

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('ratings service', () => {
  let h: ViewerHarness;
  let video: { id: string };
  beforeAll(async () => {
    h = await createHarness();
    h.setNow(NOW);
    video = await seedVideo(h.db.setup, { kidsSafe: true, maturityRank: 0 });
  });
  afterAll(async () => {
    await h?.drop();
  });

  const target = () => ({ kind: 'video' as const, id: video.id });

  it('a profile can like, love, dislike and clear a title, and setting the same value twice is idempotent', async () => {
    const u = await h.makeUser();
    const p = u.profileId;
    expect((await setRating(h.ctx, u.actor, { profileId: p, target: target(), value: 1 })).value).toBe(1);
    expect((await setRating(h.ctx, u.actor, { profileId: p, target: target(), value: 1 })).value).toBe(1);
    expect((await setRating(h.ctx, u.actor, { profileId: p, target: target(), value: 2 })).value).toBe(2);
    expect((await setRating(h.ctx, u.actor, { profileId: p, target: target(), value: -1 })).value).toBe(-1);
    const got = await getRatings(h.ctx, u.actor, { profileId: p, targets: [target()] });
    expect(got.get(video.id)).toBe(-1);
    expect((await setRating(h.ctx, u.actor, { profileId: p, target: target(), value: null })).value).toBeNull();
    expect((await getRatings(h.ctx, u.actor, { profileId: p, targets: [target()] })).size).toBe(0);
    const count = await h.db.setup.execute(sql`SELECT count(*)::int AS n FROM title_ratings WHERE profile_id = ${p}`);
    expect((count.rows[0] as { n: number }).n).toBe(0);
  });

  it('ratings belong to the profile, another profile on the account has its own', async () => {
    const u = await h.makeUser();
    await setRating(h.ctx, u.actor, { profileId: u.profileId, target: target(), value: 2 });
    const mine = await listMyRatings(h.ctx, u.actor);
    expect(mine).toEqual([expect.objectContaining({ profileId: u.profileId, value: 2 })]);
    // The kids profile of the same account has none.
    expect(mine.some((r) => r.profileId === u.kidsProfileId)).toBe(false);
  });

  it('an episode id is rejected, the series is rated instead', async () => {
    const u = await h.makeUser();
    const s = await seedSeries(h.db.setup, { series: { maturityRank: 0 }, episode: { maturityRank: 0 } });
    await expect(
      setRating(h.ctx, u.actor, { profileId: u.profileId, target: { kind: 'video', id: s.episodes[0]!.id }, value: 1 }),
    ).rejects.toMatchObject({ status: 422 });
    const ok = await setRating(h.ctx, u.actor, {
      profileId: u.profileId,
      target: { kind: 'series', id: s.id },
      value: 2,
    });
    expect(ok.value).toBe(2);
  });

  it('a kids profile cannot rate', async () => {
    const u = await h.makeUser();
    await expect(
      setRating(h.ctx, u.actor, { profileId: u.kidsProfileId, target: target(), value: 1 }),
    ).rejects.toMatchObject({ status: 403, message: 'kids_no_rating' });
  });

  it('a title hidden for the profile audience returns NotFound, and a foreign profile is not found', async () => {
    const u = await h.makeUser();
    const high = await seedVideo(h.db.setup, { maturityRank: 3 });
    await updateProfile(h.ctx, u.actor, u.profileId, { maxMaturityRank: 2 });
    await expect(
      setRating(h.ctx, u.actor, { profileId: u.profileId, target: { kind: 'video', id: high.id }, value: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    const other = await h.makeUser();
    await expect(
      setRating(h.ctx, other.actor, { profileId: u.profileId, target: target(), value: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('annotateCards returns rating and mostLiked for videos and series', async () => {
    const u = await h.makeUser();
    const s = await seedSeries(h.db.setup, { series: { maturityRank: 0 }, episode: { maturityRank: 0 } });
    await setRating(h.ctx, u.actor, { profileId: u.profileId, target: target(), value: 2 });
    await h.db.setup.execute(
      sql`INSERT INTO title_rating_stats (series_id, likes, loves, dislikes, most_liked) VALUES (${s.id}, 8, 4, 0, true)`,
    );
    const cards = await withAccount(h.ctx.db, u.actor, async (tx) => {
      const found = await fetchCards(tx, catalogContext(h.ctx), { kids: false }, [
        { kind: 'video', id: video.id },
        { kind: 'series', id: s.id },
      ]);
      return annotateCards(tx, u.profileId, found);
    });
    const byId = new Map(cards.map((c) => [c.id, c]));
    expect(byId.get(video.id)).toMatchObject({ rating: 2, mostLiked: false });
    expect(byId.get(s.id)).toMatchObject({ rating: null, mostLiked: true });
  });

  it('rating writes are rate limited', async () => {
    let spent = 0;
    const limited = await createHarness({
      rateLimit: async (bucket) => {
        if (bucket === 'engage') spent += 1;
        return { allowed: spent <= 2, retryAfterSeconds: 30 };
      },
    });
    try {
      limited.setNow(NOW);
      const v = await seedVideo(limited.db.setup, { maturityRank: 0 });
      const u = await limited.makeUser();
      const t = { kind: 'video' as const, id: v.id };
      await setRating(limited.ctx, u.actor, { profileId: u.profileId, target: t, value: 1 });
      await setRating(limited.ctx, u.actor, { profileId: u.profileId, target: t, value: 2 });
      await expect(
        setRating(limited.ctx, u.actor, { profileId: u.profileId, target: t, value: -1 }),
      ).rejects.toMatchObject({ status: 429 });
    } finally {
      await limited.drop();
    }
  });
});
