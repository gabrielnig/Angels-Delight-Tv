import { describe, expect, it } from 'vitest';
import { createFixturePlaybackData } from './playback.fixture';

const adult = { profileId: 'p1', kids: false };
const kid = { profileId: 'p2', kids: true };

describe('fixture playback data', () => {
  const data = createFixturePlaybackData();

  it('returns not-found for an unknown video', async () => {
    expect(await data.getWatchData('nope', adult)).toEqual({ status: 'not-found' });
  });

  it('blocks adult titles on a kids profile', async () => {
    expect(await data.getWatchData('v-adult', kid)).toEqual({ status: 'kids-blocked' });
    expect((await data.getWatchData('v-adult', adult)).status).toBe('ok');
  });

  it('carries a saved position for resume', async () => {
    const r = await data.getWatchData('v-rain', adult);
    expect(r.status === 'ok' && r.data.saved).toEqual({ positionSeconds: 134, finished: false });
  });

  it('includes a not yet approved track so the player gate is exercised', async () => {
    const r = await data.getWatchData('v-rain', adult);
    expect(r.status === 'ok' && r.data.captions.map((c) => c.status)).toEqual([
      'approved',
      'needs_review',
    ]);
  });

  it('has a title without captions', async () => {
    const r = await data.getWatchData('v-magnets', adult);
    expect(r.status === 'ok' && r.data.captions).toEqual([]);
  });

  it('gives an episode a next title and the last episode none', async () => {
    const sky = await data.getWatchData('v-sky', adult);
    const sun = await data.getWatchData('v-sun', adult);
    expect(sky.status === 'ok' && sky.data.next?.id).toBe('v-sun');
    expect(sun.status === 'ok' && sun.data.next).toBeNull();
    expect(sun.status === 'ok' && sun.data.video.series?.lastEpisode).toBe(true);
  });

  it('builds up next tiles without the current video and without adult titles', async () => {
    const r = await data.getWatchData('v-plants', adult);
    const ids = r.status === 'ok' ? r.data.upNext.map((t) => t.id) : [];
    expect(ids).not.toContain('v-plants');
    expect(ids).not.toContain('v-adult');
    expect(ids.length).toBeLessThanOrEqual(5);
  });

  it('turns captions on by default for kids profiles only', async () => {
    const a = await data.getWatchData('v-plants', adult);
    const k = await data.getWatchData('v-plants', kid);
    expect(a.status === 'ok' && a.data.preferences.captionsOn).toBe(false);
    expect(k.status === 'ok' && k.data.preferences.captionsOn).toBe(true);
  });
});
