import { schema } from '@ad/db';
import { MarkerService } from '@ad/video';
import { saveProgress, addToMyList } from '@ad/viewer';
import {
  categorize,
  createHarness,
  integrationEnabled,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RealPlaybackData } from './real-playback';
import { DEFAULT_PLAYBACK } from './real-account-data';

type User = Awaited<ReturnType<ViewerHarness['makeUser']>>;

describe.skipIf(!integrationEnabled())('real playback data', () => {
  let h: ViewerHarness;
  let playback: RealPlaybackData;
  let settings = { ...DEFAULT_PLAYBACK };
  let captioned = '';
  const adult = (u: User) => ({ accountId: u.accountId, profileId: u.profileId, kids: false });
  const kids = (u: User) => ({ accountId: u.accountId, profileId: u.kidsProfileId, kids: true });

  beforeAll(async () => {
    h = await createHarness();
    playback = new RealPlaybackData(
      h.ctx,
      async () => settings,
      async (videoId) =>
        videoId === captioned
          ? [{ language: 'en', label: 'English', isDefault: true, key: 'cap/p/en/abcd1234.vtt' }]
          : [],
      async (videoId) => (videoId === captioned ? 'cap/p/sprites/map-1234abcd.vtt' : null),
      (videoId) => new MarkerService({ db: h.db.setup }).getPublished(videoId),
    );
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('attaches approved caption tracks from the media origin, and none when there are none', async () => {
    const u = await h.makeUser();
    const withTrack = await seedVideo(h.db.setup, { title: 'Has captions', kidsSafe: true });
    const without = await seedVideo(h.db.setup, { title: 'No captions', kidsSafe: true });
    captioned = withTrack.id;
    const a = await playback.getWatchData(withTrack.id, adult(u));
    if (a.status !== 'ok') throw new Error(a.status);
    expect(a.data.captions).toEqual([
      {
        id: 'en',
        language: 'en',
        label: 'English',
        src: 'https://media.test/cap/p/en/abcd1234.vtt',
        status: 'approved',
      },
    ]);
    const b = await playback.getWatchData(without.id, adult(u));
    if (b.status !== 'ok') throw new Error(b.status);
    expect(b.data.captions).toEqual([]);
    expect(a.data.spriteUrl).toBe('https://media.test/cap/p/sprites/map-1234abcd.vtt');
    expect(b.data.spriteUrl).toBeUndefined();
  });

  it('describes a standalone video with saved progress, related tiles and list state', async () => {
    const u = await h.makeUser();
    const cat = await seedCategory(h.db.setup, 'Playback science');
    const v = await seedVideo(h.db.setup, {
      title: 'Watch me',
      slug: 'watch-me',
      durationMs: 300_000,
      kidsSafe: true,
    });
    const other = await seedVideo(h.db.setup, {
      title: 'Up next one',
      durationMs: 90_000,
      kidsSafe: true,
    });
    await categorize(h.db.setup, { videoId: v.id }, cat.id);
    await categorize(h.db.setup, { videoId: other.id }, cat.id);
    await saveProgress(h.ctx, u.actor, {
      profileId: u.profileId,
      videoId: v.id,
      positionMs: 90_000,
      seek: true,
    });
    await addToMyList(h.ctx, u.actor, {
      profileId: u.profileId,
      target: { kind: 'video', id: v.id },
    });

    const result = await playback.getWatchData(v.id, adult(u));
    if (result.status !== 'ok') throw new Error(result.status);
    const { data } = result;
    expect(data.video).toMatchObject({
      id: v.id,
      title: 'Watch me',
      durationSeconds: 300,
      categoryLabel: 'Playback science',
      kidsSafe: true,
      series: null,
      backHref: '/title/watch-me',
    });
    expect(data.saved).toEqual({ positionSeconds: 90, finished: false });
    expect(data.inMyList).toBe(true);
    expect(data.next).toMatchObject({ id: other.id, title: 'Up next one', href: `/watch/${other.id}` });
    expect(data.upNext.map((t) => [t.title, t.href, t.durationLabel])).toEqual([
      ['Up next one', `/watch/${other.id}`, '1 min 30 sec'],
    ]);
    expect(data.related.map((r) => r.title)).toEqual(['Up next one']);
    expect(data.preferences).toMatchObject({
      autoplayNext: true,
      dataSaver: false,
      rate: 1,
      captionsOn: true,
    });
    expect(data.captionStyle).toEqual({ size: 'medium', background: 'dark', contrast: 'standard', edge: 'shadow' });
  });

  it('has no saved position for a video that was not watched and uses the profile settings', async () => {
    const u = await h.makeUser();
    const v = await seedVideo(h.db.setup, { durationMs: 60_000 });
    settings = {
      ...DEFAULT_PLAYBACK,
      dataSaver: true,
      autoplayNext: false,
      speed: 1.5,
      captionsDefault: false,
    };
    const result = await playback.getWatchData(v.id, adult(u));
    settings = { ...DEFAULT_PLAYBACK };
    if (result.status !== 'ok') throw new Error(result.status);
    expect(result.data.saved).toBeNull();
    expect(result.data.preferences).toMatchObject({
      dataSaver: true,
      autoplayNext: false,
      rate: 1.5,
      captionsOn: false,
    });
  });

  it('turns captions on by default for a kids profile', async () => {
    const u = await h.makeUser();
    const v = await seedVideo(h.db.setup, { kidsSafe: true });
    settings = { ...DEFAULT_PLAYBACK, captionsDefault: false };
    const result = await playback.getWatchData(v.id, kids(u));
    settings = { ...DEFAULT_PLAYBACK };
    if (result.status !== 'ok') throw new Error(result.status);
    expect(result.data.preferences.captionsOn).toBe(true);
  });

  it('describes an episode with its series, the next episode and the series list state', async () => {
    const u = await h.makeUser();
    const s = await seedSeries(h.db.setup, {
      series: { title: 'Everyday Science', slug: 'everyday-science' },
      seasonSizes: [3],
      episode: { durationMs: 120_000 },
    });
    await addToMyList(h.ctx, u.actor, {
      profileId: u.profileId,
      target: { kind: 'series', id: s.id },
    });
    const second = s.episodes[1]!;
    const third = s.episodes[2]!;
    await saveProgress(h.ctx, u.actor, {
      profileId: u.profileId,
      videoId: second.id,
      positionMs: 30_000,
      seek: true,
    });

    const result = await playback.getWatchData(second.id, adult(u));
    if (result.status !== 'ok') throw new Error(result.status);
    const { data } = result;
    expect(data.video.series).toEqual({
      id: s.id,
      title: 'Everyday Science',
      episodeLabel: 'S1 E2',
      lastEpisode: false,
      href: '/series/everyday-science',
    });
    expect(data.video.backHref).toBe('/series/everyday-science');
    expect(data.next).toMatchObject({ id: third.id, href: `/watch/${third.id}` });
    expect(data.next?.meta).toBe('Everyday Science, S1 E3, 2 min');
    expect(data.saved).toEqual({ positionSeconds: 30, finished: false });
    expect(data.inMyList).toBe(true);

    const last = await playback.getWatchData(third.id, adult(u));
    if (last.status !== 'ok') throw new Error(last.status);
    expect(last.data.video.series).toMatchObject({ episodeLabel: 'S1 E3', lastEpisode: true });
    expect(last.data.next).toBeNull();
  });

  it('answers not found for unknown, malformed and foreign ids without leaking', async () => {
    const u = await h.makeUser();
    const other = await h.makeUser();
    const v = await seedVideo(h.db.setup);
    expect(await playback.getWatchData('0198a000-0000-7000-8000-0000000000aa', adult(u))).toEqual({
      status: 'not-found',
    });
    expect(await playback.getWatchData('not-a-uuid', adult(u))).toEqual({ status: 'not-found' });
    expect(await playback.getWatchData(v.id, { ...adult(u), profileId: other.profileId })).toEqual({
      status: 'not-found',
    });
    expect(await playback.getWatchData(v.id, { profileId: u.profileId, kids: false })).toEqual({
      status: 'not-found',
    });
  });

  it('blocks grown-up titles on a kids profile and keeps unpublished ones not found', async () => {
    const u = await h.makeUser();
    const adultsOnly = await seedVideo(h.db.setup, { kidsSafe: false });
    const draft = await seedVideo(h.db.setup, { publishState: 'draft', publishedAt: null });
    expect(await playback.getWatchData(adultsOnly.id, kids(u))).toEqual({ status: 'kids-blocked' });
    expect((await playback.getWatchData(adultsOnly.id, adult(u))).status).toBe('ok');
    expect(await playback.getWatchData(draft.id, kids(u))).toEqual({ status: 'not-found' });
    expect(await playback.getWatchData(draft.id, adult(u))).toEqual({ status: 'not-found' });
  });

  it('treats a kids profile claim that does not match the stored profile as the stored value', async () => {
    const u = await h.makeUser();
    const adultsOnly = await seedVideo(h.db.setup, { kidsSafe: false });
    const lying = { accountId: u.accountId, profileId: u.kidsProfileId, kids: false };
    // The stored profile is a kids profile, so the grown-up title is blocked whatever the caller claims.
    expect(await playback.getWatchData(adultsOnly.id, lying)).toEqual({ status: 'kids-blocked' });
  });

  describe('guest branch (M40-S02, S04)', () => {
    const guest = (kidsMode = false) => ({
      profileId: 'none',
      kids: kidsMode,
      guest: true as const,
    });

    it('describes a published video for a guest with no saved place, no list state, default preferences', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, {
        title: 'Guest watch',
        durationMs: 120_000,
        kidsSafe: true,
      });
      await saveProgress(h.ctx, u.actor, {
        profileId: u.profileId,
        videoId: v.id,
        positionMs: 50_000,
      });
      await addToMyList(h.ctx, u.actor, {
        profileId: u.profileId,
        target: { kind: 'video', id: v.id },
      });
      captioned = v.id;
      const res = await playback.getWatchData(v.id, guest());
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.video).toMatchObject({
        id: v.id,
        title: 'Guest watch',
        durationSeconds: 120,
      });
      expect(res.data.saved).toBeNull();
      expect(res.data.inMyList).toBe(false);
      expect(res.data.captions).toHaveLength(1);
      expect(res.data.spriteUrl).toContain('cap/p/sprites');
      expect(res.data.preferences.dataSaver).toBe(false);
      expect(res.data.preferences.autoplayNext).toBe(true);
    });

    it('does not find a draft, a malformed id or a missing video', async () => {
      const draft = await seedVideo(h.db.setup, { publishState: 'draft' });
      expect((await playback.getWatchData(draft.id, guest())).status).toBe('not-found');
      expect((await playback.getWatchData('nope', guest())).status).toBe('not-found');
    });

    it('answers kids-blocked for a Kids mode guest on a non kids video, and plays kids videos', async () => {
      const adultOnly = await seedVideo(h.db.setup, { title: 'Adult guest', kidsSafe: false });
      const child = await seedVideo(h.db.setup, { title: 'Child guest', kidsSafe: true });
      expect((await playback.getWatchData(adultOnly.id, guest(true))).status).toBe('kids-blocked');
      expect((await playback.getWatchData(adultOnly.id, guest(false))).status).toBe('ok');
      expect((await playback.getWatchData(child.id, guest(true))).status).toBe('ok');
    });

    it('follows an episode through its series with a next episode and no progress', async () => {
      const s = await seedSeries(h.db.setup, { seasonSizes: [2], episode: { kidsSafe: true } });
      const first = s.episodes[0]!;
      const res = await playback.getWatchData(first.id, guest());
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.video.series).toMatchObject({ episodeLabel: 'S1 E1', lastEpisode: false });
      expect(res.data.next?.href).toBe(`/watch/${s.episodes[1]!.id}`);
      expect(res.data.saved).toBeNull();
    });
  });

  describe('skip markers and chapters (M43)', () => {
    const guest = { profileId: 'none', kids: false, guest: true as const };

    async function withMarkers() {
      const v = await seedVideo(h.db.setup, { title: 'Marked', durationMs: 300_000, kidsSafe: true });
      await h.db.setup.insert(schema.videoMarkers).values([
        { videoId: v.id, kind: 'intro', startMs: 12_000, endMs: 48_000 },
        { videoId: v.id, kind: 'credits', startMs: 240_000 },
      ]);
      await h.db.setup.insert(schema.videoChapters).values([
        { videoId: v.id, startMs: 0, title: 'Welcome' },
        { videoId: v.id, startMs: 60_000, title: 'Mixing colours' },
      ]);
      return v;
    }

    it('returns markers and chapters in seconds for a published video', async () => {
      const u = await h.makeUser();
      const v = await withMarkers();
      const res = await playback.getWatchData(v.id, adult(u));
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.markers).toEqual({
        intro: { start: 12, end: 48 },
        credits: { start: 240, end: null },
      });
      expect(res.data.chapters).toEqual([
        { start: 0, title: 'Welcome' },
        { start: 60, title: 'Mixing colours' },
      ]);
    });

    it('returns the same markers for a guest viewer', async () => {
      const u = await h.makeUser();
      const v = await withMarkers();
      const a = await playback.getWatchData(v.id, adult(u));
      const g = await playback.getWatchData(v.id, guest);
      if (a.status !== 'ok' || g.status !== 'ok') throw new Error('not ok');
      expect(g.data.markers).toEqual(a.data.markers);
      expect(g.data.chapters).toEqual(a.data.chapters);
    });

    it('returns empty markers for a video with none', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, { title: 'Plain', durationMs: 90_000, kidsSafe: true });
      const res = await playback.getWatchData(v.id, adult(u));
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.markers).toEqual({});
      expect(res.data.chapters).toEqual([]);
    });

    it('drops a marker that falls past the duration instead of failing the page', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, { title: 'Shortened', durationMs: 100_000, kidsSafe: true });
      await h.db.setup.insert(schema.videoMarkers).values([
        { videoId: v.id, kind: 'intro', startMs: 5_000, endMs: 20_000 },
        { videoId: v.id, kind: 'recap', startMs: 150_000, endMs: 170_000 },
      ]);
      await h.db.setup.insert(schema.videoChapters).values([
        { videoId: v.id, startMs: 0, title: 'One' },
        { videoId: v.id, startMs: 150_000, title: 'Gone' },
      ]);
      const res = await playback.getWatchData(v.id, adult(u));
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.markers).toEqual({ intro: { start: 5, end: 20 } });
      expect(res.data.chapters).toEqual([{ start: 0, title: 'One' }]);
    });
  });

  describe('standalone Up next (M08-S13 AC4)', () => {
    async function pair(title: string, kidsSafeOther = true) {
      const cat = await seedCategory(h.db.setup, `Cat ${title}`);
      const a = await seedVideo(h.db.setup, { title: `${title} A`, durationMs: 120_000, kidsSafe: true });
      const b = await seedVideo(h.db.setup, { title: `${title} B`, durationMs: 90_000, kidsSafe: kidsSafeOther });
      const c = await seedVideo(h.db.setup, { title: `${title} C`, durationMs: 60_000, kidsSafe: true });
      for (const v of [a, b, c]) await categorize(h.db.setup, { videoId: v.id }, cat.id);
      return { a, b, c };
    }

    it('gives a standalone video the best related next title', async () => {
      const u = await h.makeUser();
      const { a } = await pair('Best');
      const res = await playback.getWatchData(a.id, adult(u));
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.next).not.toBeNull();
      expect(res.data.next?.id).not.toBe(a.id);
      expect(res.data.next?.href).toBe(`/watch/${res.data.next?.id}`);
      expect(res.data.next?.meta).toMatch(/^Cat Best, \d/);
    });

    it('skips titles this profile has finished', async () => {
      const u = await h.makeUser();
      const { a } = await pair('Finished');
      const first = await playback.getWatchData(a.id, adult(u));
      if (first.status !== 'ok' || !first.data.next) throw new Error('no next');
      await saveProgress(h.ctx, u.actor, {
        profileId: u.profileId,
        videoId: first.data.next.id,
        positionMs: 119_000,
        ended: true,
      });
      const second = await playback.getWatchData(a.id, adult(u));
      if (second.status !== 'ok') throw new Error(second.status);
      expect(second.data.next?.id).not.toBe(first.data.next.id);
      expect(second.data.next).not.toBeNull();
    });

    it('never picks a title that is not kids safe on a kids profile', async () => {
      const u = await h.makeUser();
      const { a, b, c } = await pair('Kids', false);
      const res = await playback.getWatchData(a.id, kids(u));
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.next?.id).toBe(c.id);
      expect(res.data.next?.id).not.toBe(b.id);
    });

    it('gives no next title when none qualifies', async () => {
      const u = await h.makeUser();
      const lone = await seedVideo(h.db.setup, { title: 'Lonely', durationMs: 60_000, kidsSafe: true });
      const res = await playback.getWatchData(lone.id, adult(u));
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.next).toBeNull();
    });

    it('gives a guest the candidates so the device can skip finished titles', async () => {
      const { a } = await pair('Guest');
      const res = await playback.getWatchData(a.id, { profileId: 'none', kids: false, guest: true });
      if (res.status !== 'ok') throw new Error(res.status);
      expect(res.data.next).not.toBeNull();
      expect((res.data.nextCandidates ?? []).length).toBeGreaterThanOrEqual(2);
      expect(res.data.nextCandidates?.[0]?.id).toBe(res.data.next?.id);
    });
  });
});
