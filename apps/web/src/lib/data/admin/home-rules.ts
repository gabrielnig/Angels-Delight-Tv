import {
  VIEW_ALL_URL_MESSAGE,
  resolveViewAll,
  slugifyRowName,
  viewAllUrlProblem,
  type ViewAllMode,
} from '@ad/shared/view-all';
import type { RowKind } from '@ad/shared';
import type { CategoryRecord, SeriesRecord, VideoRecord } from './types';

export type HomeRowType =
  | 'manual'
  | 'category'
  | 'newest'
  | 'series'
  | 'smart'
  | 'trending'
  | 'top_ten'
  | 'most_liked'
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
  /** Popular only: show the newest titles under fallbackTitle when too few qualify. */
  fallbackToNewest?: boolean;
  fallbackTitle?: string | null;
}

export interface HeroText {
  headline?: string;
  blurb?: string;
  buttonLabel?: string;
}

export const MAX_HERO_TEXT = 80;

export interface HomeConfig {
  heroIds: string[];
  heroText?: Record<string, HeroText>;
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
export const MAX_FALLBACK_TITLE = 80;
export const FIXED_TYPES: HomeRowType[] = ['continue_watching', 'my_list'];
export const ROW_TYPE_LABELS: Record<HomeRowType, string> = {
  manual: 'Manual list',
  category: 'Category',
  newest: 'New',
  series: 'Series',
  smart: 'Popular',
  trending: 'Trending now',
  top_ten: 'Top 10',
  most_liked: 'Most liked',
  each_category: 'Each category (automatic)',
  all_series: 'All series (automatic)',
  continue_watching: 'Continue learning',
  my_list: 'My List',
};

/** Titles a section needs before it shows. Same numbers as the real service (M41-S05). */
export const defaultMinItems = (type: HomeRowType): number =>
  type === 'trending' || type === 'top_ten' || type === 'most_liked'
    ? 5
    : type === 'smart'
      ? 3
      : type === 'each_category'
        ? 4
        : type === 'all_series'
          ? 2
          : 1;

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
  const heroText = Object.fromEntries(
    Object.entries(config.heroText ?? {}).filter(([id]) => unique.includes(id)),
  );
  return ok({ ...config, heroIds: unique, heroText });
}

export function setHeroText(config: HomeConfig, videoId: string, text: HeroText): HomeResult {
  if (!config.heroIds.includes(videoId)) return fail('That title is not in the hero');
  const clean: HeroText = {};
  for (const key of ['headline', 'blurb', 'buttonLabel'] as const) {
    // Kept as typed so a space between words survives. Saving trims it.
    const value = text[key] ?? '';
    if (value.length > MAX_HERO_TEXT) return fail(`Keep hero text to ${MAX_HERO_TEXT} characters`);
    if (value.trim()) clean[key] = value;
  }
  const heroText = { ...config.heroText };
  if (Object.keys(clean).length) heroText[videoId] = clean;
  else delete heroText[videoId];
  return ok({ ...config, heroText });
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

/** What a viewer gets for the hero clip of one title, in words (M41-S11). */
export function clipStatus(v: VideoRecord): string {
  const p = v.preview;
  if (p?.mode === 'off') return 'Clip off';
  if (p?.state === 'ready') return 'Clip plays';
  if (p?.state === 'queued') return 'Clip being made';
  if (p?.state === 'failed' || p?.state === 'skipped') return 'No clip, photo only';
  return 'No clip yet, photo only';
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
                : r.type === 'smart' || r.type === 'trending' || r.type === 'top_ten' || r.type === 'most_liked'
                  ? trending(shown, r.minItems ?? defaultMinItems(r.type))
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
  for (const text of Object.values(config.heroText ?? {}))
    for (const value of [text.headline, text.blurb, text.buttonLabel])
      if ((value ?? '').length > MAX_HERO_TEXT)
        return `Keep hero text to ${MAX_HERO_TEXT} characters`;
  for (const row of config.rows) {
    const name = cleanName(row.name);
    if (!name) return 'Give the section a name';
    if (name.length > MAX_ROW_NAME) return `Keep the name to ${MAX_ROW_NAME} characters`;
    if ((row.fallbackTitle ?? '').trim().length > MAX_FALLBACK_TITLE)
      return `Keep the fallback title to ${MAX_FALLBACK_TITLE} characters`;
    if (row.viewAllMode === 'custom' && viewAllUrlProblem(row.viewAllUrl ?? ''))
      return VIEW_ALL_URL_MESSAGE;
    if (row.minItems !== undefined && (!Number.isInteger(row.minItems) || row.minItems < 1 || row.minItems > 20))
      return 'Use a minimum from 1 to 20 titles';
  }
  return null;
}

const plainRow = (id: string, type: HomeRowType, name: string): HomeRow => ({
  id,
  type,
  name,
  visible: true,
  videoIds: [],
  sourceId: null,
});

export const defaultHome = (): HomeConfig => ({
  heroIds: [],
  rows: [
    plainRow('row_continue', 'continue_watching', 'Continue learning'),
    plainRow('row_list', 'my_list', 'My List'),
    plainRow('row_newest', 'newest', 'New this week'),
    plainRow('row_smart', 'smart', 'Most watched this week'),
  ],
});

export interface LaunchTitles {
  continueTitle?: string;
  newTitle?: string;
  trendingTitle?: string;
}

/** The launch layout (M41-S09). The real service has the same list, and the parity test keeps them equal. */
export function launchHome(titles: LaunchTitles = {}): HomeConfig {
  const named = (fallback: string, own?: string) => cleanName(own ?? '') || fallback;
  const section = (id: string, type: HomeRowType, name: string, minItems: number): HomeRow => ({
    ...plainRow(id, type, name),
    viewAllMode: 'auto',
    viewAllUrl: null,
    minItems,
    kidsVisible: true,
  });
  return {
    heroIds: [],
    rows: [
      section('row_continue', 'continue_watching', named('Continue learning', titles.continueTitle), 1),
      section('row_list', 'my_list', 'My List', 1),
      section('row_trending', 'trending', named('Trending now', titles.trendingTitle), 5),
      section('row_newest', 'newest', named('Newly added', titles.newTitle), 1),
      section('row_each_category', 'each_category', 'Browse by subject', 4),
      section('row_all_series', 'all_series', 'Series', 2),
    ],
  };
}

/** One line meanings for the Add section dialog (S97 state 3). Built in sections are not offered. */
export const ADD_TYPE_HINTS: Record<
  | 'manual'
  | 'category'
  | 'newest'
  | 'series'
  | 'smart'
  | 'trending'
  | 'top_ten'
  | 'most_liked'
  | 'each_category'
  | 'all_series',
  string
> = {
  manual: 'You pick the titles and their order.',
  category: 'The newest titles from one subject.',
  newest: 'The newest titles. Updates by itself.',
  smart: 'Most watched this month. Hidden until 3 titles qualify, or shows the newest titles if you tick the fallback.',
  trending: 'What is being watched right now. Hidden until 5 titles qualify.',
  top_ten: 'The ten most watched titles, numbered one to ten.',
  most_liked: 'The titles viewers rated Like or Love the most.',
  series: 'The videos of one series.',
  each_category: 'One section for every subject with enough titles.',
  all_series: 'Series cards, newest first.',
};

/** Names in the Add section dialog, a little fuller than the list labels (S97 state 3). */
export const ADD_TYPE_LABELS: Record<keyof typeof ADD_TYPE_HINTS, string> = {
  manual: 'Manual list',
  category: 'Category',
  newest: 'New',
  smart: 'Popular (most watched)',
  trending: 'Trending now',
  top_ten: 'Top 10',
  most_liked: 'Most liked',
  series: 'Series (one series)',
  each_category: 'Each category (automatic)',
  all_series: 'All series (automatic)',
};

const KIND_OF: Record<HomeRowType, RowKind> = {
  manual: 'curated',
  category: 'category',
  newest: 'recently_added',
  series: 'curated',
  smart: 'popular',
  trending: 'trending',
  top_ten: 'top_ten',
  most_liked: 'most_liked',
  each_category: 'each_category',
  all_series: 'all_series',
  continue_watching: 'continue_watching',
  my_list: 'my_list',
};

export interface SectionSources {
  categories: CategoryRecord[];
  series: SeriesRecord[];
}

function viewAllTarget(row: HomeRow, src: SectionSources) {
  if (row.type === 'continue_watching') return null;
  const category = row.type === 'category' ? src.categories.find((c) => c.id === row.sourceId) : undefined;
  const series = row.type === 'series' ? src.series.find((s) => s.id === row.sourceId) : undefined;
  return resolveViewAll({
    kind: KIND_OF[row.type],
    mode: row.viewAllMode ?? 'auto',
    url: row.viewAllUrl ?? null,
    categorySlug: category ? slugifyRowName(category.name) : null,
    seriesSlug: series ? slugifyRowName(series.title) : null,
    rowSlug: row.type === 'manual' ? (row.slug ?? null) : null,
  });
}

/** The short View all line under a section name in the list (S97 state 1). */
export function viewAllSummary(row: HomeRow, src: SectionSources): string {
  const mode = row.viewAllMode ?? 'auto';
  if (row.type === 'continue_watching' || mode === 'none') return 'No View all link';
  if (mode === 'custom') return `View all: Custom, ${row.viewAllUrl || 'enter a link'}`;
  if (row.type === 'each_category') return 'View all: Automatic, one per category';
  const target = viewAllTarget(row, src);
  return target ? `View all: Automatic, ${target.href}` : 'No View all link';
}

/** What an automatic link opens, in words, or null when the section has none (M41-S08 AC1). */
export function viewAllOpens(row: HomeRow, src: SectionSources): string | null {
  const target = viewAllTarget(row, src);
  if (!target) return null;
  const words: Partial<Record<HomeRowType, string>> = {
    newest: 'All new videos',
    smart: 'All popular videos',
    trending: 'All trending videos',
    top_ten: 'The top ten list',
    most_liked: 'All most liked videos',
    all_series: 'All series',
    my_list: 'Your My List',
    series: 'The series page',
    category: `The ${row.name} list`,
    manual: `The ${row.name} list`,
  };
  return `${words[row.type] ?? 'This list'} (${target.href})`;
}

/** A duplicate name is allowed. The editor only says so, and says how a manual link ends (M41-S06 edge). */
export function duplicateNameNote(config: HomeConfig, id: string): string | null {
  const row = config.rows.find((r) => r.id === id);
  if (!row) return null;
  const name = cleanName(row.name);
  const twin = config.rows.some((r) => r.id !== id && cleanName(r.name).toLowerCase() === name.toLowerCase());
  if (!twin) return null;
  const ending = row.type === 'manual' ? /-(\d+)$/.exec(row.slug ?? '') : null;
  return `Another section is called ${name}. That is allowed.${ending ? ` This link will end in -${ending[1]}.` : ''}`;
}
