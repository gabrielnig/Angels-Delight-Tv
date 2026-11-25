import type { AdminStore } from '../store';
import { videoStub } from '../video-rules';
import type { VideoRecord } from '../types';
import { DEMO_DATASET, type DemoDataset } from './dataset';
import { applyTroubleStates } from './trouble';

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

  // Bible teaching examples for the series articles (lane C4): a tidy Genesis series with two Parts, three
  // unassigned Genesis lessons to bundle from the Videos list, and a Proverbs series with a gap and a duplicate.
  const bible = (
    id: string,
    title: string,
    ageDays: number,
    place?: { series: string; group: number; number: number },
  ): VideoRecord =>
    videoStub({
      id,
      slug: id.replace(/_/g, '-'),
      title,
      description: 'A demo Bible lesson for the help videos.',
      categoryIds: ['cat_life'],
      status: 'ready',
      publishState: 'published',
      publishedAt: iso(-ageDays * DAY),
      captionState: 'approved',
      captionCueCount: 60,
      posterId: `poster_${id}`,
      suitability: 'everyone',
      maturityRank: 0,
      uploadedBy: 'Demo Editor',
      createdAt: iso(-(ageDays + 2) * DAY),
      updatedAt: iso(-ageDays * DAY),
      durationSeconds: 600,
      views: 100,
      ...(place
        ? { seriesId: place.series, seasonNumber: place.group, episodeNumber: place.number }
        : {}),
    });
  const gen = (n: string) => `vid_demo_gen_${n}`;
  const bibleVideos = [
    bible(gen('1'), 'Demo lesson: Genesis 1, God makes the world', 40, {
      series: 'ser_demo_genesis',
      group: 1,
      number: 1,
    }),
    bible(gen('3'), 'Demo lesson: Genesis 3, Adam and Eve', 39, {
      series: 'ser_demo_genesis',
      group: 1,
      number: 2,
    }),
    bible(gen('6'), 'Demo lesson: Genesis 6, Noah and the ark', 38, {
      series: 'ser_demo_genesis',
      group: 1,
      number: 3,
    }),
    bible(gen('12'), 'Demo lesson: Genesis 12, Abraham is called', 37, {
      series: 'ser_demo_genesis',
      group: 2,
      number: 1,
    }),
    bible(gen('22'), 'Demo lesson: Genesis 22, Abraham and Isaac', 36, {
      series: 'ser_demo_genesis',
      group: 2,
      number: 2,
    }),
    bible(gen('37'), 'Demo lesson: Genesis 37, Joseph and his brothers', 35),
    bible(gen('41'), 'Demo lesson: Genesis 41, Joseph in Egypt', 34),
    bible(gen('45'), 'Demo lesson: Genesis 45, Joseph forgives', 33),
    bible('vid_demo_prov_1', 'Demo lesson: Proverbs 1, the start of wisdom', 32, {
      series: 'ser_demo_proverbs',
      group: 1,
      number: 1,
    }),
    bible('vid_demo_prov_3', 'Demo lesson: Proverbs 10, wise words', 31, {
      series: 'ser_demo_proverbs',
      group: 1,
      number: 3,
    }),
    bible('vid_demo_prov_3b', 'Demo lesson: Proverbs 15, a gentle answer', 30, {
      series: 'ser_demo_proverbs',
      group: 1,
      number: 3,
    }),
  ];
  for (const v of bibleVideos) if (!known.has(v.id)) store.videos.push(v);
  for (const s of ds.series) {
    if (s.id === 'ser_demo_parts' || store.series.some((x) => x.id === s.id)) continue;
    store.series.push({
      id: s.id,
      title: s.title,
      description: s.description ?? 'Demo Bible lessons for the help videos.',
      posterId: null,
      published: true,
      maturityRank: 0,
      labelOverride: s.labels ?? null,
      ...(s.groupTitles ? { groupTitles: s.groupTitles } : {}),
    });
  }

  // Monetization examples, all marked as test. The sponsor and donation screens read these collections.
  store.sponsors = ds.sponsors.map((s) => ({ ...s }));
  store.donations = ds.donations.map((d) => ({ ...d }));
  return applyTroubleStates(store, now);
}

type DemoStaffRole = 'editor' | 'admin' | 'super_admin';
