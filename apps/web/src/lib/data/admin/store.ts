import { defaultHome } from './home-rules';
import type { HomeState } from './home-rules';
import type {
  AuditRow,
  CaptionTrack,
  CategoryRecord,
  InviteRecord,
  SeriesRecord,
  StaffRecord,
  UserRecord,
  VideoRecord,
} from './types';
import { seedPeople } from './people-seed';
import { videoStub } from './video-rules';

/** In memory fixture data. One copy per server process, shared by every fixture service. */
export interface AdminStore {
  videos: VideoRecord[];
  categories: CategoryRecord[];
  series: SeriesRecord[];
  home: HomeState;
  users: UserRecord[];
  staff: StaffRecord[];
  invites: InviteRecord[];
  audit: AuditRow[];
  captions: Record<string, CaptionTrack>;
  settings: { requireApprovedCaptions: boolean };
  /** Oldest first. Last entry is yesterday. Deterministic so charts are stable. */
  dailyViews: number[];
  [extra: string]: unknown;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const GB = 1024 ** 3;

export function seedStore(now = Date.now()): AdminStore {
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const v = (partial: Partial<VideoRecord> & { id: string; title: string }): VideoRecord =>
    videoStub({
      status: 'ready',
      captionState: 'approved',
      captionCueCount: 80,
      posterId: `poster_${partial.id}`,
      suitability: 'everyone',
      uploadedBy: 'Amina Bello',
      createdAt: iso(-10 * DAY),
      updatedAt: iso(-2 * DAY),
      sizeBytes: 1.1 * GB,
      description: 'A short lesson for curious learners, explained in plain words.',
      ...partial,
    });

  const videos: VideoRecord[] = [
    v({
      id: 'vid_money_data',
      title: 'How to Save Money on Data',
      categoryIds: ['cat_life'],
      publishState: 'published',
      publishedAt: iso(-14 * DAY),
      durationSeconds: 252,
      views: 12400,
      tags: ['data', 'money'],
    }),
    v({
      id: 'vid_sky',
      title: 'Why the Sky Is Blue',
      categoryIds: ['cat_science'],
      publishState: 'published',
      publishedAt: iso(-16 * DAY),
      durationSeconds: 302,
      views: 9800,
      tags: ['light'],
    }),
    v({
      id: 'vid_rivers',
      title: 'Rivers of Africa',
      categoryIds: ['cat_geo'],
      status: 'encoding',
      progress: 62,
      captionState: 'generating',
      posterId: null,
      suitability: null,
      durationSeconds: 311,
      uploadedBy: 'Amina Bello',
      createdAt: iso(-3 * HOUR),
      updatedAt: iso(-10 * MIN),
    }),
    v({
      id: 'vid_time',
      title: 'Telling the Time',
      categoryIds: ['cat_maths'],
      publishState: 'published',
      publishedAt: iso(-20 * DAY),
      durationSeconds: 200,
      views: 6100,
    }),
    v({
      id: 'vid_plants',
      title: 'How Plants Make Food',
      categoryIds: ['cat_science'],
      captionState: 'needs_review',
      captionCueCount: 84,
      durationSeconds: 352,
      uploadedBy: 'Chiamaka Okafor',
      createdAt: iso(-1 * DAY),
      updatedAt: iso(-1 * DAY),
    }),
    v({
      id: 'vid_naira',
      title: 'Counting Money in Naira',
      categoryIds: ['cat_life'],
      captionState: 'none',
      captionCueCount: 0,
      posterId: null,
      suitability: null,
      description: '',
      durationSeconds: 400,
    }),
    v({
      id: 'vid_magnets',
      title: 'Magnets at Work',
      categoryIds: ['cat_science'],
      publishState: 'scheduled',
      publishAt: iso(7 * HOUR),
      durationSeconds: 245,
      uploadedBy: 'Chiamaka Okafor',
    }),
    v({
      id: 'vid_solar',
      title: 'Our Solar System',
      categoryIds: ['cat_science'],
      status: 'failed',
      captionState: 'none',
      captionCueCount: 0,
      posterId: null,
      suitability: null,
      durationSeconds: 438,
      failure: { stage: 'Encoding', reason: 'The audio track could not be read.' },
      updatedAt: iso(-20 * MIN),
    }),
    v({
      id: 'vid_safe_online',
      title: 'Staying Safe Online',
      categoryIds: ['cat_life'],
      durationSeconds: 330,
      createdAt: iso(-2 * HOUR),
      updatedAt: iso(-1 * HOUR),
    }),
    v({
      id: 'vid_fractions',
      title: 'Fractions with Jollof Rice',
      categoryIds: ['cat_maths'],
      publishState: 'published',
      publishedAt: iso(-30 * DAY),
      durationSeconds: 287,
      views: 15200,
      seriesId: 'ser_maths',
      episodeNumber: 1,
    }),
    v({
      id: 'vid_decimals',
      title: 'Decimals at the Market',
      categoryIds: ['cat_maths'],
      publishState: 'published',
      publishedAt: iso(-26 * DAY),
      durationSeconds: 301,
      views: 8300,
      seriesId: 'ser_maths',
      episodeNumber: 2,
    }),
    v({
      id: 'vid_hygiene',
      title: 'Washing Hands the Right Way',
      categoryIds: ['cat_life'],
      publishState: 'published',
      publishedAt: iso(-40 * DAY),
      durationSeconds: 150,
      views: 21000,
      suitability: 'kids',
    }),
    v({
      id: 'vid_old_intro',
      title: 'Welcome Video (old cut)',
      categoryIds: [],
      publishState: 'unpublished',
      deletedAt: iso(-5 * DAY),
      durationSeconds: 60,
    }),
    v({
      id: 'vid_test_clip',
      title: 'Test clip',
      categoryIds: [],
      deletedAt: iso(-27 * DAY),
      durationSeconds: 15,
      description: '',
    }),
  ];

  const categories: CategoryRecord[] = [
    { id: 'cat_life', name: 'Life Skills', hidden: false, position: 0 },
    { id: 'cat_science', name: 'Science', hidden: false, position: 1 },
    { id: 'cat_maths', name: 'Maths', hidden: false, position: 2 },
    { id: 'cat_geo', name: 'Geography', hidden: false, position: 3 },
    { id: 'cat_health', name: 'Health', hidden: true, position: 4 },
  ];

  const series: SeriesRecord[] = [
    {
      id: 'ser_maths',
      title: 'Maths Made Simple',
      description: 'Everyday maths with food, money and markets.',
      posterId: 'poster_ser_maths',
      published: true,
    },
    {
      id: 'ser_life',
      title: 'Life Skills for Teens',
      description: 'Practical skills for growing up.',
      posterId: null,
      published: false,
    },
  ];

  // Gentle weekly rhythm with a slow climb, last 90 days.
  const dailyViews = Array.from({ length: 90 }, (_, day) => {
    const weekday = day % 7;
    const rhythm = [0.9, 1, 1.05, 1.1, 1.15, 0.85, 0.8][weekday]!;
    return Math.round((1500 + day * 9) * rhythm);
  });

  const home = defaultHome();
  const pubs = videos.filter((v) => v.publishState === 'published');
  home.heroIds = pubs.slice(0, 1).map((v) => v.id);
  const homeState: HomeState = {
    draft: home,
    published: structuredClone(home),
    previous: null,
    publishedAt: null,
  };
  return {
    videos,
    categories,
    series,
    home: homeState,
    ...seedPeople(now),
    captions: {},
    settings: { requireApprovedCaptions: true },
    dailyViews,
  };
}

const GLOBAL_KEY = Symbol.for('ad.admin.fixture.store');

export function getStore(): AdminStore {
  const holder = globalThis as unknown as Record<symbol, AdminStore | undefined>;
  // A store from an older build (dev hot reload) lacks newer collections, so reseed it.
  const existing = holder[GLOBAL_KEY];
  if (
    existing &&
    Array.isArray(existing.series) &&
    existing.captions &&
    existing.home &&
    existing.audit
  )
    return existing;
  return (holder[GLOBAL_KEY] = seedStore());
}

/** Tests build a fresh store and pass it in. */
export function resetStore(store: AdminStore = seedStore()): AdminStore {
  (globalThis as unknown as Record<symbol, AdminStore>)[GLOBAL_KEY] = store;
  return store;
}
