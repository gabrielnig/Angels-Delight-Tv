import type { SeriesRecord, VideoRecord } from './types';

export type HomeRowType =
  'manual' | 'category' | 'newest' | 'series' | 'smart' | 'continue_watching' | 'my_list';

export interface HomeRow {
  id: string;
  type: HomeRowType;
  name: string;
  visible: boolean;
  /** manual: video ids in order. category and series: the id of the source. */
  videoIds: string[];
  sourceId: string | null;
}

export interface HomeConfig {
  heroIds: string[];
  rows: HomeRow[];
}

export interface HomeState {
  draft: HomeConfig;
  published: HomeConfig;
  previous: HomeConfig | null;
  publishedAt: string | null;
}

export const MAX_HERO = 5;
export const MAX_ROWS = 12;
export const MAX_ROW_TITLES = 20;
export const FIXED_TYPES: HomeRowType[] = ['continue_watching', 'my_list'];
export const ROW_TYPE_LABELS: Record<HomeRowType, string> = {
  manual: 'Manual list',
  category: 'Category',
  newest: 'Newest',
  series: 'Series',
  smart: 'Most watched this week',
  continue_watching: 'Continue Watching',
  my_list: 'My List',
};

export type HomeResult = { ok: true; config: HomeConfig } | { ok: false; error: string };
const fail = (error: string): HomeResult => ({ ok: false, error });
const ok = (config: HomeConfig): HomeResult => ({ ok: true, config });

export const isFixed = (row: HomeRow) => FIXED_TYPES.includes(row.type);
export const isShown = (video: VideoRecord) =>
  video.deletedAt === null && video.publishState === 'published';

export function moveRow(config: HomeConfig, id: string, delta: -1 | 1): HomeConfig {
  const rows = [...config.rows];
  const from = rows.findIndex((r) => r.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= rows.length) return config;
  [rows[from], rows[to]] = [rows[to]!, rows[from]!];
  return { ...config, rows };
}

export function toggleRow(config: HomeConfig, id: string): HomeConfig {
  return {
    ...config,
    rows: config.rows.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)),
  };
}

export function addRow(
  config: HomeConfig,
  type: HomeRowType,
  name: string,
  sourceId: string | null,
  newId: () => string,
): HomeResult {
  if (isFixed({ type } as HomeRow))
    return fail('Continue Watching and My List are already on the page.');
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return fail('Give the row a name.');
  if (config.rows.length >= MAX_ROWS)
    return fail(`Home can have up to ${MAX_ROWS} rows. Remove one first.`);
  if ((type === 'category' || type === 'series') && !sourceId)
    return fail(type === 'category' ? 'Choose a category.' : 'Choose a series.');
  return ok({
    ...config,
    rows: [
      ...config.rows,
      {
        id: newId(),
        type,
        name: clean.slice(0, 60),
        visible: true,
        videoIds: [],
        sourceId: type === 'category' || type === 'series' ? sourceId : null,
      },
    ],
  });
}

export function renameRow(config: HomeConfig, id: string, name: string): HomeResult {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return fail('Give the row a name.');
  return ok({
    ...config,
    rows: config.rows.map((r) => (r.id === id ? { ...r, name: clean.slice(0, 60) } : r)),
  });
}

export function removeRow(config: HomeConfig, id: string): HomeResult {
  const row = config.rows.find((r) => r.id === id);
  if (!row) return fail('Row not found.');
  if (isFixed(row)) return fail('This row is built in. Hide it instead.');
  return ok({ ...config, rows: config.rows.filter((r) => r.id !== id) });
}

export function addTitle(config: HomeConfig, rowId: string, videoId: string): HomeResult {
  const row = config.rows.find((r) => r.id === rowId);
  if (!row || row.type !== 'manual') return fail('Titles can only be added to a manual list.');
  if (row.videoIds.includes(videoId)) return fail('That title is already in this row.');
  if (row.videoIds.length >= MAX_ROW_TITLES)
    return fail(`A row holds up to ${MAX_ROW_TITLES} titles.`);
  return ok({
    ...config,
    rows: config.rows.map((r) =>
      r.id === rowId ? { ...r, videoIds: [...r.videoIds, videoId] } : r,
    ),
  });
}

export function removeTitle(config: HomeConfig, rowId: string, videoId: string): HomeConfig {
  return {
    ...config,
    rows: config.rows.map((r) =>
      r.id === rowId ? { ...r, videoIds: r.videoIds.filter((v) => v !== videoId) } : r,
    ),
  };
}

export function moveTitle(
  config: HomeConfig,
  rowId: string,
  videoId: string,
  delta: -1 | 1,
): HomeConfig {
  return {
    ...config,
    rows: config.rows.map((r) => {
      if (r.id !== rowId) return r;
      const ids = [...r.videoIds];
      const from = ids.indexOf(videoId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return r;
      [ids[from], ids[to]] = [ids[to]!, ids[from]!];
      return { ...r, videoIds: ids };
    }),
  };
}

export function setHero(config: HomeConfig, videoIds: string[]): HomeResult {
  const unique = [...new Set(videoIds)];
  if (unique.length > MAX_HERO) return fail(`Choose up to ${MAX_HERO} hero titles.`);
  return ok({ ...config, heroIds: unique });
}

export interface ResolvedPreviewRow {
  id: string;
  name: string;
  type: HomeRowType;
  items: VideoRecord[];
  /** Titles chosen for this row that cannot be shown because they are not published. */
  skipped: VideoRecord[];
  empty: boolean;
}

export interface Preview {
  hero: VideoRecord[];
  skippedHero: VideoRecord[];
  rows: ResolvedPreviewRow[];
}

/** What viewers would see. Kids mode keeps only titles marked for kids or everyone. */
export function resolvePreview(
  config: HomeConfig,
  videos: VideoRecord[],
  _series: SeriesRecord[],
  kids: boolean,
): Preview {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const allowed = (v: VideoRecord) =>
    kids ? v.suitability === 'kids' || v.suitability === 'everyone' : true;
  const shown = videos.filter((v) => isShown(v) && allowed(v));
  const hero = config.heroIds.map((id) => byId.get(id)).filter((v): v is VideoRecord => !!v);
  const rows = config.rows
    .filter((r) => r.visible)
    .map((r): ResolvedPreviewRow => {
      let chosen: VideoRecord[] = [];
      if (r.type === 'manual')
        chosen = r.videoIds.map((id) => byId.get(id)).filter((v): v is VideoRecord => !!v);
      const items =
        r.type === 'manual'
          ? chosen.filter((v) => isShown(v) && allowed(v))
          : r.type === 'category'
            ? shown.filter((v) => r.sourceId && v.categoryIds.includes(r.sourceId))
            : r.type === 'series'
              ? shown.filter((v) => v.seriesId === r.sourceId)
              : r.type === 'newest'
                ? [...shown]
                    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
                    .slice(0, 12)
                : r.type === 'smart'
                  ? [...shown].sort((a, b) => b.views - a.views).slice(0, 12)
                  : [];
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        items,
        skipped: chosen.filter((v) => !isShown(v)),
        empty: !isFixed(r) && items.length === 0,
      };
    });
  return {
    hero: hero.filter((v) => isShown(v) && allowed(v)),
    skippedHero: hero.filter((v) => !isShown(v)),
    rows,
  };
}

export function validateConfig(config: HomeConfig): string | null {
  if (config.rows.length > MAX_ROWS) return `Home can have up to ${MAX_ROWS} rows.`;
  if (config.heroIds.length > MAX_HERO) return `Choose up to ${MAX_HERO} hero titles.`;
  if (config.rows.some((r) => !r.name.trim())) return 'Every row needs a name.';
  return null;
}

export const defaultHome = (): HomeConfig => ({
  heroIds: [],
  rows: [
    {
      id: 'row_continue',
      type: 'continue_watching',
      name: 'Continue Watching',
      visible: true,
      videoIds: [],
      sourceId: null,
    },
    {
      id: 'row_newest',
      type: 'newest',
      name: 'New this week',
      visible: true,
      videoIds: [],
      sourceId: null,
    },
    {
      id: 'row_smart',
      type: 'smart',
      name: 'Most watched this week',
      visible: true,
      videoIds: [],
      sourceId: null,
    },
    {
      id: 'row_list',
      type: 'my_list',
      name: 'My List',
      visible: true,
      videoIds: [],
      sourceId: null,
    },
  ],
});
