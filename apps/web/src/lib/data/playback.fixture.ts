import { DEFAULT_PREFERENCES, type CaptionTrack, type RelatedItem } from '@ad/player';
import type {
  PlaybackData,
  Tint,
  UpNextTileData,
  ViewerContext,
  WatchData,
  WatchLookup,
  WatchVideo,
} from './playback';

const DESCRIPTION =
  'A short lesson with simple drawings that show how the idea works, one step at a time.';

const englishApproved: CaptionTrack = {
  id: 'en',
  language: 'en',
  label: 'English',
  src: '/fixtures/captions/en.vtt',
  status: 'approved',
};

function video(
  id: string,
  title: string,
  category: string,
  seconds: number,
  extra: Partial<WatchVideo> = {},
): WatchVideo {
  return {
    id,
    title,
    description: DESCRIPTION,
    durationSeconds: seconds,
    posterUrl: null,
    categoryLabel: category,
    kidsSafe: true,
    series: null,
    backHref: '/',
    ...extra,
  };
}

const CATALOG: Array<{ video: WatchVideo; captions: CaptionTrack[] }> = [
  {
    video: video('v-plants', 'How Plants Make Their Own Food', 'Science Made Simple', 352),
    captions: [englishApproved],
  },
  {
    video: video('v-rain', 'How Rain Is Made', 'Science Made Simple', 262, { posterUrl: null }),
    captions: [
      englishApproved,
      {
        ...englishApproved,
        id: 'yo',
        language: 'yo',
        label: 'Yoruba',
        src: '/fixtures/captions/en.vtt',
        status: 'needs_review',
      },
    ],
  },
  {
    video: video('v-sky', 'Why the Sky Is Blue', 'Everyday Science', 300, {
      series: {
        id: 's-everyday',
        title: 'Everyday Science',
        episodeLabel: 'S1 E4',
        lastEpisode: false,
        href: '/series/s-everyday',
      },
      backHref: '/series/s-everyday',
    }),
    captions: [englishApproved],
  },
  {
    video: video('v-sun', 'Why the Sun Rises', 'Everyday Science', 288, {
      series: {
        id: 's-everyday',
        title: 'Everyday Science',
        episodeLabel: 'S1 E5',
        lastEpisode: true,
        href: '/series/s-everyday',
      },
      backHref: '/series/s-everyday',
    }),
    captions: [englishApproved],
  },
  { video: video('v-magnets', 'Magnets at Work', 'Science Made Simple', 241), captions: [] },
  {
    video: video('v-encrypted', 'Sample with AES-128 keys', 'Test', 24),
    captions: [englishApproved],
  },
  {
    video: video('v-adult', 'Money and Tax Basics for Adults', 'Learn About Money', 410, {
      kidsSafe: false,
    }),
    captions: [englishApproved],
  },
];

const TINTS: Tint[] = ['sky', 'mint', 'lemon', 'peach', 'lavender'];

function durationLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} sec`;
}

function tiles(excludeId: string): UpNextTileData[] {
  return CATALOG.filter((c) => c.video.id !== excludeId && c.video.kidsSafe)
    .slice(0, 5)
    .map((c, i) => ({
      id: c.video.id,
      title: c.video.title,
      tag: c.video.categoryLabel,
      durationLabel: durationLabel(c.video.durationSeconds),
      href: `/watch/${c.video.id}`,
      tint: TINTS[i % TINTS.length] as Tint,
    }));
}

/** Seeded playback data. Saved positions let resume be exercised: v-rain has 2:14 saved. */
export function createFixturePlaybackData(): PlaybackData {
  const saved: Record<string, { positionSeconds: number; finished: boolean }> = {
    'v-rain': { positionSeconds: 134, finished: false },
    'v-magnets': { positionSeconds: 3, finished: false },
  };

  return {
    async getWatchData(videoId: string, viewer: ViewerContext): Promise<WatchLookup> {
      const entry = CATALOG.find((c) => c.video.id === videoId);
      if (!entry) return { status: 'not-found' };
      if (viewer.kids && !entry.video.kidsSafe) return { status: 'kids-blocked' };

      const nextEntry =
        entry.video.id === 'v-sky' ? CATALOG.find((c) => c.video.id === 'v-sun') : undefined;
      const related: RelatedItem[] = tiles(entry.video.id)
        .slice(0, 4)
        .map((t) => ({ id: t.id, title: t.title, href: t.href }));

      const data: WatchData = {
        video: entry.video,
        captions: entry.captions,
        saved: saved[entry.video.id] ?? null,
        next: nextEntry
          ? {
              id: nextEntry.video.id,
              title: nextEntry.video.title,
              meta: `${nextEntry.video.series?.title ?? ''}, ${nextEntry.video.series?.episodeLabel ?? ''}, ${Math.round(nextEntry.video.durationSeconds / 60)} min`,
              href: `/watch/${nextEntry.video.id}`,
            }
          : null,
        upNext: tiles(entry.video.id),
        related,
        preferences: { ...DEFAULT_PREFERENCES, captionsOn: viewer.kids },
        inMyList: false,
      };
      return { status: 'ok', data };
    },
  };
}
