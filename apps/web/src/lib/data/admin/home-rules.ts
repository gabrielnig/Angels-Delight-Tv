import {
  VIEW_ALL_URL_MESSAGE,
  slugifyRowName,
  viewAllUrlProblem,
  type ViewAllMode,
} from '@ad/shared/view-all';
import type { SeriesRecord, VideoRecord } from './types';

export type HomeRowType =
  | 'manual'
  | 'category'
  | 'newest'
  | 'series'
  | 'smart'
  | 'each_category'
  | 'all_series'
  | 'continue_watching'
  | 'my_list';

export interface HomeRow {
  id: string;
  type: HomeRowType;
  name: string;
  visible: boolean;
  /** manual: video ids in order. category and series: the id of the source. */
  videoIds: string[];
  sourceId: string | null;
  /** Address of a manual section, /browse/row/{slug}. Kept on rename. */
  slug?: string | null;
  viewAllMode?: ViewAllMode;
  viewAllUrl?: string | null;
  minItems?: number;
  kidsVisible?: boolean;
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
/** Titles Home shows as the hero when none are chosen (M41-S03). */
export const HERO_FALLBACK_COUNT = 5;
export const MAX_ROW_TITLES = 20;
export const MAX_ROW_NAME = 60;
export const FIXED_TYPES: HomeRowType[] = ['continue_watching', 'my_list'];
export const ROW_TYPE_LABELS: Record<HomeRowType, string> = {
  manual: 'Manual list',
  category: 'Category',
  newest: 'New',
  series: 'Series',
  smart: 'Trending',
  each_category: 'Each category (automatic)',
  all_series: 'All series (automatic)',
  continue_watching: 'Continue learning',
  my_list: 'My List',
};

/** Titles a section needs before it shows. Same numbers as the real service (M41-S05). */
export const defaultMinItems = (type: HomeRowType): number =>
  type === 'smart' || type === 'each_category' ? 4 : type === 'all_series' ? 2 : 1;

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

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
    return fail('Continue learning and My List are already on the page.');
  const clean = cleanName(name);
  if (!clean) return fail('Give the section a name');
  if (clean.length > MAX_ROW_NAME) return fail(`Keep the name to ${MAX_ROW_NAME} characters`);
  if (config.rows.length >= MAX_ROWS)
    return fail(`Home can have up to ${MAX_ROWS} sections. Remove one first.`);
  if ((type === 'category' || type === 'series') && !sourceId)
    return fail(type === 'category' ? 'Choose a category.' : 'Choose a series.');
  const taken = new Set(config.rows.flatMap((r) => (r.slug ? [r.slug] : [])));
  let slug: string | null = null;
  if (type === 'manual') {
    const base = slugifyRowName(clean);
    slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  }
  return ok({
    ...config,
    rows: [
      ...config.rows,
      {
        id: newId(),
        type,
        name: clean,
        visible: true,
        videoIds: [],
        sourceId: type === 'category' || type === 'series' ? sourceId : null,
        slug,
        viewAllMode: 'auto',
        viewAllUrl: null,
        minItems: defaultMinItems(type),
        kidsVisible: true,
      },
    ],
  });
}

export function renameRow(config: HomeConfig, id: string, name: string): HomeResult {
  const clean = cleanName(name);
  if (!clean) return fail('Give the section a name');
  if (clean.length > MAX_ROW_NAME) return fail(`Keep the name to ${MAX_ROW_NAME} characters`);
  // The slug stays, so a link to /browse/row/{slug} keeps working after a rename.
  return ok({
    ...config,
    rows: config.rows.map((r) => (r.id === id ? { ...r, name: clean } : r)),
  });
}

/** Sets how a section's View all link behaves (M41-S08). A custom link must be a path or an https link. */
export function setViewAll(
  config: HomeConfig,
  id: string,
  mode: ViewAllMode,
  url: string | null,
): HomeResult {
  if (mode === 'custom' && viewAllUrlProblem(url ?? '')) return fail(VIEW_ALL_URL_MESSAGE);
  return ok({
    ...config,
    rows: config.rows.map((r) =>
      r.id === id ? { ...r, viewAllMode: mode, viewAllUrl: mode === 'custom' ? url : null } : r,
    ),
  });
}

export function setMinItems(config: HomeConfig, id: string, minItems: number): HomeResult {
  if (!Number.isInteger(minItems) || minItems < 1 || minItems > 20)
    return fail('Use a minimum from 1 to 20 titles');
  return ok({ ...config, rows: config.rows.map((r) => (r.id === id ? { ...r, minItems } : r)) });
}

export function setKidsVisible(config: HomeConfig, id: string, kidsVisible: boolean): HomeConfig {
  return { ...config, rows: config.rows.map((r) => (r.id === id ? { ...r, kidsVisible } : r)) };
}

/** Moves a section to a place in the list (drag and drop). Out of range places clamp. */
export function reorderRows(config: HomeConfig, id: string, toIndex: number): HomeConfig {
  const from = config.rows.findIndex((r) => r.id === id);
  if (from < 0) return config;
  const rows = [...config.rows];
  const [moved] = rows.splice(from, 1);
  rows.splice(Math.max(0, Math.min(rows.length, toIndex)), 0, moved!);
  return { ...config, rows };
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
  /** True when no chosen hero title is live, so Home shows the newest titles instead (M41-S03). */
  heroFallback: boolean;
  skippedHero: VideoRecord[];
  rows: ResolvedPreviewRow[];
}

/** Trending shows only titles with views and hides under its minimum, it never borrows from New (M41-S05 AC2). */
function trending(shown: VideoRecord[], min: number): VideoRecord[] {
  const viewed = shown.filter((v) => v.views > 0).sort((a, b) => b.views - a.views);
  return viewed.length >= min ? viewed.slice(0, 12) : [];
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
                  ? trending(shown, r.minItems ?? defaultMinItems('smart'))
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
  const liveHero = hero.filter((v) => isShown(v) && allowed(v));
  const newest = [...shown]
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, HERO_FALLBACK_COUNT);
  return {
    hero: liveHero.length > 0 ? liveHero : newest,
    heroFallback: liveHero.length === 0,
    skippedHero: hero.filter((v) => !isShown(v)),
    rows,
  };
}

export function validateConfig(config: HomeConfig): string | null {
  if (config.rows.length > MAX_ROWS) return `Home can have up to ${MAX_ROWS} sections.`;
  if (config.heroIds.length > MAX_HERO) return `Choose up to ${MAX_HERO} hero titles.`;
  for (const row of config.rows) {
    const name = cleanName(row.name);
    if (!name) return 'Give the section a name';
    if (name.length > MAX_ROW_NAME) return `Keep the name to ${MAX_ROW_NAME} characters`;
    if (row.viewAllMode === 'custom' && viewAllUrlProblem(row.viewAllUrl ?? ''))
      return VIEW_ALL_URL_MESSAGE;
    if (row.minItems !== undefined && (!Number.isInteger(row.minItems) || row.minItems < 1 || row.minItems > 20))
      return 'Use a minimum from 1 to 20 titles';
  }
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
