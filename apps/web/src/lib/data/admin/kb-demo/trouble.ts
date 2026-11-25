import type { AdminStore } from '../store';
import type { VideoRecord } from '../types';
import { videoStub } from '../video-rules';

const DAY = 24 * 3_600_000;

/**
 * Seeded problem states for the troubleshooting guides (lane C7). The fixture build has no real encoder, speech
 * service or mail service, so a failed caption track, a failed or skipped preview clip and a series with an unpublished
 * lesson are laid over the demo data instead. Everything is additive and keyed by fixed ids, so a reset always gives
 * the same result. Failed encodes and failed background jobs already come from the base fixture.
 */
export function applyTroubleStates(store: AdminStore, now: number): AdminStore {
  const iso = (offset: number) => new Date(now + offset).toISOString();
  const find = (id: string) => store.videos.find((v) => v.id === id);

  const failedCaptions = find('vid_fractions');
  if (failedCaptions) failedCaptions.captionState = 'failed';

  const decimals = find('vid_decimals');
  if (decimals) {
    decimals.preview = {
      state: 'failed',
      mode: 'auto',
      startMs: null,
      note: 'The preview clip could not be cut from this video.',
    };
  }
  const hygiene = find('vid_hygiene');
  if (hygiene) {
    hygiene.preview = {
      state: 'skipped',
      mode: 'auto',
      startMs: null,
      note: 'The video is too short for a preview clip.',
    };
  }

  const lesson = (n: number, title: string, published: boolean): VideoRecord =>
    videoStub({
      id: `vid_demo_garden_${n}`,
      slug: `demo-garden-lesson-${n}`,
      title,
      description: 'A demo lesson about growing food in a small space.',
      categoryIds: ['cat_science'],
      status: 'ready',
      publishState: published ? 'published' : 'draft',
      publishedAt: published ? iso(-6 * DAY) : null,
      captionState: 'approved',
      captionCueCount: 50,
      posterId: `poster_vid_demo_garden_${n}`,
      suitability: 'everyone',
      uploadedBy: 'Demo Editor',
      createdAt: iso(-9 * DAY),
      updatedAt: iso(-1 * DAY),
      durationSeconds: 200 + n * 15,
      seriesId: 'ser_demo_garden',
      seasonNumber: 1,
      episodeNumber: n,
    });
  const known = new Set(store.videos.map((v) => v.id));
  for (const v of [lesson(1, 'Demo garden: pick a spot', true), lesson(2, 'Demo garden: plant seeds', false)]) {
    if (!known.has(v.id)) store.videos.push(v);
  }
  if (!store.series.some((s) => s.id === 'ser_demo_garden')) {
    store.series.push({
      id: 'ser_demo_garden',
      title: 'Demo series: Small space gardening',
      description: 'Demo lessons for the troubleshooting guides.',
      posterId: null,
      published: true,
      labelOverride: { preset: 'part_lesson' },
    });
  }
  return store;
}
