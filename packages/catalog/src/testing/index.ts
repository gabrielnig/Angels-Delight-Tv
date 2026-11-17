import { uuidv7 } from '@ad/shared';
import {
  accounts,
  assets,
  categories,
  createDb,
  episodes,
  profiles,
  seasons,
  series,
  videoCategories,
  seriesCategories,
  videos,
  type Database,
} from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import pg from 'pg';

export { integrationEnabled };

export interface ViewerTestDb {
  admin: TestDatabase;
  /** Superuser handle for arranging data. Bypasses row level security. */
  setup: Database;
  /** Connects as ad_app, like production, so grants and row level security apply. */
  app: Database;
  drop(): Promise<void>;
}

export async function createViewerTestDb(): Promise<ViewerTestDb> {
  const admin = await createTestDatabase();
  const appPool = new pg.Pool({ connectionString: admin.url, max: 4, options: '-c role=ad_app' });
  return {
    admin,
    setup: admin.db,
    app: createDb(appPool),
    async drop() {
      await appPool.end();
      await admin.drop();
    },
  };
}

export const NOW = new Date('2026-06-15T12:00:00Z');
export const PAST = new Date('2026-05-01T09:00:00Z');
export const FUTURE = new Date('2026-07-01T09:00:00Z');

export async function seedAccount(setup: Database, role: 'viewer' | 'editor' | 'admin' = 'viewer') {
  const account = makeAccount({ role });
  await setup.insert(accounts).values(account);
  return account;
}

export async function seedProfile(
  setup: Database,
  accountId: string,
  overrides: Partial<typeof profiles.$inferInsert> = {},
) {
  const profile = makeProfile(accountId, overrides);
  await setup.insert(profiles).values(profile);
  return profile;
}

type VideoOverrides = Partial<typeof videos.$inferInsert>;

/** A ready, published, general audience video that is visible at NOW. */
export async function seedVideo(setup: Database, overrides: VideoOverrides = {}) {
  const video = makeVideo({
    status: 'ready',
    durationMs: 120_000,
    publishState: 'published',
    publishedAt: PAST,
    ...overrides,
  });
  await setup.insert(videos).values(video);
  return video;
}

export async function seedCategory(setup: Database, name: string, overrides = {}) {
  const id = uuidv7();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await setup.insert(categories).values({ id, slug, name, ...overrides });
  return { id, slug, name };
}

export async function categorize(
  setup: Database,
  target: { videoId: string } | { seriesId: string },
  categoryId: string,
) {
  if ('videoId' in target) {
    await setup.insert(videoCategories).values({ videoId: target.videoId, categoryId });
  } else {
    await setup.insert(seriesCategories).values({ seriesId: target.seriesId, categoryId });
  }
}

export interface SeededSeries {
  id: string;
  slug: string;
  episodes: { id: string; number: number; season: number }[];
}

/** A series with one season per entry of `seasonSizes`. Episode videos use the same overrides as seedVideo. */
export async function seedSeries(
  setup: Database,
  options: {
    series?: Partial<typeof series.$inferInsert>;
    seasonSizes?: number[];
    episode?: VideoOverrides;
  } = {},
): Promise<SeededSeries> {
  const id = uuidv7();
  const slug = `series-${id.slice(-12)}`;
  await setup.insert(series).values({
    id,
    slug,
    title: 'Sample series',
    publishState: 'published',
    publishedAt: PAST,
    ...options.series,
  });
  const created: SeededSeries['episodes'] = [];
  const seasonSizes = options.seasonSizes ?? [3];
  for (const [seasonIndex, size] of seasonSizes.entries()) {
    const seasonId = uuidv7();
    await setup.insert(seasons).values({ id: seasonId, seriesId: id, number: seasonIndex + 1 });
    for (let number = 1; number <= size; number++) {
      const video = await seedVideo(setup, {
        kind: 'episode',
        title: `Episode ${seasonIndex + 1}.${number}`,
        ...options.episode,
      });
      await setup.insert(episodes).values({ seasonId, videoId: video.id, number });
      created.push({ id: video.id, number, season: seasonIndex + 1 });
    }
  }
  return { id, slug: options.series?.slug ?? slug, episodes: created };
}

export async function seedAsset(
  setup: Database,
  overrides: Partial<typeof assets.$inferInsert> = {},
) {
  const id = uuidv7();
  await setup.insert(assets).values({
    id,
    purpose: 'thumbnail',
    status: 'ready',
    mime: 'image/webp',
    mediaKeyBase: `img/${id}`,
    width: 960,
    height: 540,
    placeholderColor: '#1F6FB5',
    altText: 'Poster',
    variants: [
      { width: 320, height: 180, key: `img/${id}/320-aaaaaaaa.webp`, bytes: 9000 },
      { width: 640, height: 360, key: `img/${id}/640-bbbbbbbb.webp`, bytes: 24000 },
      { width: 960, height: 540, key: `img/${id}/960-cccccccc.webp`, bytes: 52000 },
    ],
    ...overrides,
  });
  return id;
}
