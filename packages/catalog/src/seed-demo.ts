import { like, sql } from 'drizzle-orm';
import {
  assets,
  categories,
  episodes,
  rowItems,
  rows,
  seasons,
  series,
  seriesCategories,
  videoCategories,
  videos,
  type Database,
} from '@ad/db';
import { mediaPrefix, uuidv7 } from '@ad/shared';

/** Every demo record has a slug starting with this, so the seed can find and replace its own data. */
export const DEMO_PREFIX = 'demo-';

const CATEGORY_NAMES = ['Science', 'History', 'Languages', 'Health', 'Arts'];
const COLORS = ['#1F6FB5', '#B5541F', '#2F8F5B', '#7A3FA0', '#B59B1F', '#1F8FA0'];
const SERIES_TITLES = ['Rivers of Africa', 'Everyday Chemistry', 'Learn Yoruba'];
const VIDEO_TOPICS = [
  'How plants make food',
  'The water cycle',
  'Mansa Musa and the Mali Empire',
  'Counting in Igbo',
  'Washing hands well',
  'Drawing with shapes',
  'Why the sky is blue',
  'The Benin Bronzes',
  'Greetings in Hausa',
  'A balanced plate',
  'Making paper masks',
  'Volcanoes explained',
  'The Sahel trade routes',
  'Pidgin proverbs',
  'Sleep and the growing brain',
  'Clay pot basics',
  'Magnets at home',
  'Kingdoms of the Niger',
  'Telling the time in French',
  'Fruit and vitamins',
  'Rhythm with drums',
  'Simple machines',
  'The Lagos lagoon',
  'Numbers in Swahili',
  'Safe water at home',
  'Colour mixing',
  'Seeds and soil',
  'Ancient Nok art',
  'Days of the week in Twi',
  'Stretching for school kids',
];

export interface DemoSeedResult {
  created: boolean;
  videos: number;
  series: number;
  categories: number;
  rows: number;
}

async function placeholderAsset(db: Database, index: number): Promise<string> {
  const id = uuidv7();
  await db.insert(assets).values({
    id,
    purpose: 'thumbnail',
    status: 'ready',
    mime: 'image/webp',
    mediaKeyBase: `img/${id}`,
    width: 960,
    height: 540,
    placeholderColor: COLORS[index % COLORS.length]!,
    altText: 'Placeholder artwork',
    variants: [
      { width: 320, height: 180, key: `img/${id}/320-aaaaaaaa.webp`, bytes: 9000 },
      { width: 640, height: 360, key: `img/${id}/640-bbbbbbbb.webp`, bytes: 24000 },
      { width: 960, height: 540, key: `img/${id}/960-cccccccc.webp`, bytes: 52000 },
    ],
  });
  return id;
}

/**
 * Fills an empty or development database with 30 placeholder titles, 3 series, categories and home rows. It does
 * nothing when demo data is already there, so it is safe to run twice. It never touches records it did not make.
 */
export async function seedDemo(db: Database, now: Date = new Date()): Promise<DemoSeedResult> {
  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(videos)
    .where(like(videos.slug, `${DEMO_PREFIX}%`));
  if ((existing[0]?.n ?? 0) > 0)
    return { created: false, videos: 0, series: 0, categories: 0, rows: 0 };

  const day = 86_400_000;
  const categoryIds: string[] = [];
  for (const [i, name] of CATEGORY_NAMES.entries()) {
    const id = uuidv7();
    categoryIds.push(id);
    await db.insert(categories).values({
      id,
      slug: `${DEMO_PREFIX}${name.toLowerCase()}`,
      name: `${name}`,
      position: i,
    });
  }

  const videoIds: string[] = [];
  for (const [i, title] of VIDEO_TOPICS.entries()) {
    const id = uuidv7();
    videoIds.push(id);
    await db.insert(videos).values({
      id,
      slug: `${DEMO_PREFIX}${i + 1}-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+$/, '')}`.slice(0, 80),
      title,
      description: `A short placeholder lesson about ${title.toLowerCase()}.`,
      mediaPrefix: mediaPrefix(),
      status: 'ready',
      durationMs: (3 + (i % 9)) * 60_000,
      kidsSafe: i % 3 !== 0,
      posterAssetId: await placeholderAsset(db, i),
      heroAssetId: i < 5 ? await placeholderAsset(db, i + 1) : null,
      publishState: 'published',
      publishedAt: new Date(now.getTime() - (i + 1) * day),
    });
    await db
      .insert(videoCategories)
      .values({ videoId: id, categoryId: categoryIds[i % categoryIds.length]! });
  }

  const seriesIds: string[] = [];
  for (const [s, title] of SERIES_TITLES.entries()) {
    const id = uuidv7();
    seriesIds.push(id);
    await db.insert(series).values({
      id,
      slug: `${DEMO_PREFIX}series-${s + 1}`,
      title,
      description: `A placeholder series: ${title}.`,
      kidsSafe: true,
      posterAssetId: await placeholderAsset(db, s + 2),
      heroAssetId: await placeholderAsset(db, s + 3),
      publishState: 'published',
      publishedAt: new Date(now.getTime() - (s + 1) * day),
    });
    await db.insert(seriesCategories).values({ seriesId: id, categoryId: categoryIds[s]! });
    const seasonId = uuidv7();
    await db.insert(seasons).values({ id: seasonId, seriesId: id, number: 1 });
    for (let n = 1; n <= 4; n++) {
      const videoId = uuidv7();
      await db.insert(videos).values({
        id: videoId,
        slug: `${DEMO_PREFIX}series-${s + 1}-episode-${n}`,
        kind: 'episode',
        title: `${title}: part ${n}`,
        description: `Part ${n} of ${title}.`,
        mediaPrefix: mediaPrefix(),
        status: 'ready',
        durationMs: 6 * 60_000,
        kidsSafe: true,
        posterAssetId: await placeholderAsset(db, n),
        publishState: 'published',
        publishedAt: new Date(now.getTime() - (s + 1) * day),
      });
      await db.insert(episodes).values({ seasonId, videoId, number: n });
    }
  }

  const plan: {
    title: string;
    kind: 'hero' | 'curated' | 'recently_added' | 'popular' | 'category';
    categoryId?: string;
  }[] = [
    { title: 'Featured', kind: 'hero' },
    { title: 'Start here', kind: 'curated' },
    { title: 'Recently added', kind: 'recently_added' },
    { title: 'Popular this week', kind: 'popular' },
    { title: CATEGORY_NAMES[0]!, kind: 'category', categoryId: categoryIds[0] },
    { title: CATEGORY_NAMES[1]!, kind: 'category', categoryId: categoryIds[1] },
  ];
  for (const [position, row] of plan.entries()) {
    const id = uuidv7();
    await db.insert(rows).values({
      id,
      title: row.title,
      kind: row.kind,
      categoryId: row.categoryId ?? null,
      position: 1000 + position,
      isPublished: true,
      kidsVisible: true,
    });
    if (row.kind === 'hero' || row.kind === 'curated') {
      const targets =
        row.kind === 'hero'
          ? [{ seriesId: seriesIds[0]! }, { videoId: videoIds[1]! }, { videoId: videoIds[2]! }]
          : [
              ...seriesIds.map((seriesId) => ({ seriesId })),
              ...videoIds.slice(3, 11).map((videoId) => ({ videoId })),
            ];
      for (const [i, target] of targets.entries()) {
        await db.insert(rowItems).values({ id: uuidv7(), rowId: id, position: i, ...target });
      }
    }
  }
  return {
    created: true,
    videos: VIDEO_TOPICS.length,
    series: SERIES_TITLES.length,
    categories: CATEGORY_NAMES.length,
    rows: plan.length,
  };
}

/** Removes everything seedDemo made. Used by tests and by developers resetting their database. */
export async function clearDemo(db: Database): Promise<void> {
  await db.delete(rows).where(sql`${rows.position} >= 1000`);
  await db.delete(series).where(like(series.slug, `${DEMO_PREFIX}%`));
  await db.delete(videos).where(like(videos.slug, `${DEMO_PREFIX}%`));
  await db.delete(categories).where(like(categories.slug, `${DEMO_PREFIX}%`));
}
