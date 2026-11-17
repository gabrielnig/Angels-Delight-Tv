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
    expect(data.next).toBeNull();
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
});
