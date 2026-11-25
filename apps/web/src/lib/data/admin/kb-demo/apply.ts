import type { AdminStore } from '../store';
import { videoStub } from '../video-rules';
import type { VideoRecord } from '../types';
import { DEMO_DATASET, type DemoDataset } from './dataset';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Lays the demo dataset over a fresh fixture store (`seedStore(now)`): fake names for every person, a Part and Lesson
 * series, a video that is still uploading, and test sponsors and donations. Pure and deterministic for a given `now`,
 * so a reset always gives the same state.
 */
export function applyDemo(
  store: AdminStore,
  ds: DemoDataset = DEMO_DATASET,
  now: number,
): AdminStore {
  const iso = (offset: number) => new Date(now + offset).toISOString();

  // People: every name is clearly fake.
  const byRole = new Map(ds.staff.map((s) => [s.role, s.name]));
  for (const s of store.staff) s.name = byRole.get(s.role) ?? 'Demo Staff';
  store.users.forEach((u, i) => {
    const n = String(i + 1).padStart(2, '0');
    u.profiles.forEach((p, j) => {
      p.name = `Demo Viewer ${n}${p.kids ? ' Kids' : j > 0 ? ' Two' : ''}`;
    });
  });
  const uploaders = ['Demo Editor', 'Demo Admin'];
  store.videos.forEach((v, i) => {
    v.uploadedBy = uploaders[i % uploaders.length]!;
  });
  for (const row of store.audit) {
    row.actorName = byRole.get(row.actorRole as DemoStaffRole) ?? 'Demo Admin';
  }

  // One video still uploading, so the status list is complete.
  const uploading: VideoRecord = videoStub({
    id: 'vid_demo_uploading',
    slug: 'demo-upload-in-progress',
    title: 'Demo upload in progress',
    status: 'uploading',
    publishState: 'draft',
    captionState: 'none',
    captionCueCount: 0,
    posterId: null,
    suitability: null,
    uploadedBy: 'Demo Editor',
    createdAt: iso(-5 * 60_000),
    updatedAt: iso(-60_000),
    durationSeconds: 0,
    progress: 40,
  });

  // A series that reads Part and Lesson, with two lessons.
  const lesson = (n: number, title: string): VideoRecord =>
    videoStub({
      id: `vid_demo_budget_${n}`,
      slug: `demo-budget-lesson-${n}`,
      title,
      description: 'A demo lesson about planning a small budget.',
      categoryIds: ['cat_life'],
      status: 'ready',
      publishState: 'published',
      publishedAt: iso(-(9 - n) * DAY),
      captionState: 'approved',
      captionCueCount: 60,
      posterId: `poster_vid_demo_budget_${n}`,
      suitability: 'everyone',
      uploadedBy: 'Demo Editor',
      createdAt: iso(-12 * DAY),
      updatedAt: iso(-2 * DAY),
      durationSeconds: 180 + n * 20,
      views: 300 * n,
      seriesId: 'ser_demo_parts',
      seasonNumber: 1,
      episodeNumber: n,
    });

  const known = new Set(store.videos.map((v) => v.id));
  for (const v of [
    uploading,
    lesson(1, 'Demo lesson: what a budget is'),
    lesson(2, 'Demo lesson: needs and wants'),
  ]) {
    if (!known.has(v.id)) store.videos.push(v);
  }
  const demoSeries = ds.series.find((s) => s.id === 'ser_demo_parts');
  if (demoSeries && !store.series.some((s) => s.id === demoSeries.id)) {
    store.series.push({
      id: demoSeries.id,
      title: demoSeries.title,
      description: 'Demo lessons about money, for the help videos.',
      posterId: null,
      published: true,
      labelOverride: demoSeries.labels ?? null,
    });
  }

  // Monetization examples, all marked as test. The sponsor and donation screens read these collections.
  store.sponsors = ds.sponsors.map((s) => ({ ...s }));
  store.donations = ds.donations.map((d) => ({ ...d }));
  return store;
}

type DemoStaffRole = 'editor' | 'admin' | 'super_admin';
