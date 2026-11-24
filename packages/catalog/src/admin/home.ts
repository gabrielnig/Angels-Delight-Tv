import { createHash } from 'node:crypto';
import { eq, notInArray, sql } from 'drizzle-orm';
import { categories, rowItems, rows, series, settings, withAccount } from '@ad/db';
import { writeAudit } from '../audit';
import {
  Forbidden,
  VIEW_ALL_URL_MESSAGE,
  isUuid,
  isStaffRole,
  slugifyRowName,
  viewAllUrlProblem,
  type Actor,
  type RowKind,
  type ViewAllMode,
} from '@ad/shared';
import { rowsOf } from '../sql';
import type { Tx } from '../types';
import { OK, fail, type AdminContext, type CommandResult } from './types';

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

export interface HomeRowConfig {
  id: string;
  type: HomeRowType;
  name: string;
  visible: boolean;
  /** manual: video ids in order. */
  videoIds: string[];
  /** category and series: the id of the source. */
  sourceId: string | null;
  /** Address of a manual section, /browse/row/{slug}. Kept when the section is renamed so links keep working. */
  slug?: string | null;
  /** Older saved layouts have none of these, and read as automatic, the type default and kids visible. */
  viewAllMode?: ViewAllMode;
  viewAllUrl?: string | null;
  minItems?: number;
  kidsVisible?: boolean;
}

/** Optional words on a hero slide. Empty fields fall back to the title's own text. */
export interface HeroText {
  headline?: string;
  blurb?: string;
  buttonLabel?: string;
}

export const MAX_HERO_TEXT = 80;

export interface HomeConfig {
  heroIds: string[];
  /** Keyed by video id. Only titles that are in heroIds keep an entry. */
  heroText?: Record<string, HeroText>;
  rows: HomeRowConfig[];
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
export const MAX_ROW_NAME = 60;
export const MIN_ITEMS_RANGE = [1, 20] as const;
const SERIES_ROW_MAX = 50;

const KEYS = {
  draft: 'home.draft',
  published: 'home.published',
  previous: 'home.previous',
  at: 'home.published_at',
} as const;

function assertStaff(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Editors only');
}

const plain = (id: string, type: HomeRowType, name: string): HomeRowConfig => ({
  id,
  type,
  name,
  visible: true,
  videoIds: [],
  sourceId: null,
});

export const defaultHomeConfig = (): HomeConfig => ({
  heroIds: [],
  rows: [
    plain('row_continue', 'continue_watching', 'Continue learning'),
    plain('row_list', 'my_list', 'My List'),
    plain('row_newest', 'newest', 'New this week'),
    plain('row_smart', 'smart', 'Most watched this week'),
  ],
});

/** The sections a new site starts with, in page order (M41-S09). Names are the defaults the client can override. */
export const LAUNCH_HOME_SECTIONS: ReadonlyArray<{
  id: string;
  type: HomeRowType;
  name: string;
  minItems: number;
}> = [
  { id: 'row_continue', type: 'continue_watching', name: 'Continue learning', minItems: 1 },
  { id: 'row_list', type: 'my_list', name: 'My List', minItems: 1 },
  { id: 'row_newest', type: 'newest', name: 'New this week', minItems: 1 },
  { id: 'row_smart', type: 'smart', name: 'Most watched this week', minItems: 4 },
  { id: 'row_each_category', type: 'each_category', name: 'Browse by subject', minItems: 4 },
  { id: 'row_all_series', type: 'all_series', name: 'Series', minItems: 2 },
];

export interface LaunchHomeTitles {
  continueTitle?: string;
  newTitle?: string;
  trendingTitle?: string;
}

/** The launch layout with the client's titles. Every section is visible, automatic and kids visible. */
export function launchHomeConfig(titles: LaunchHomeTitles = {}): HomeConfig {
  const override: Partial<Record<HomeRowType, string | undefined>> = {
    continue_watching: titles.continueTitle,
    newest: titles.newTitle,
    smart: titles.trendingTitle,
  };
  return {
    heroIds: [],
    rows: LAUNCH_HOME_SECTIONS.map((section) => ({
      ...plain(section.id, section.type, cleanRowName(override[section.type] ?? '') || section.name),
      viewAllMode: 'auto' as const,
      viewAllUrl: null,
      minItems: section.minItems,
      kidsVisible: true,
    })),
  };
}

/** Titles a section needs before it shows. Trending and Each category need 4, All series 2 (M41-S05). */
export function defaultMinItems(type: HomeRowType): number {
  return type === 'smart' || type === 'each_category' ? 4 : type === 'all_series' ? 2 : 1;
}

/** Names are trimmed and double spaces collapse (M41-S06 Edge). */
export const cleanRowName = (name: string): string => name.trim().replace(/\s+/g, ' ');

export function validateHomeConfig(config: HomeConfig): string | null {
  if (config.rows.length > MAX_ROWS) return `Home can have up to ${MAX_ROWS} sections.`;
  if (config.heroIds.length > MAX_HERO) return `Choose up to ${MAX_HERO} hero titles.`;
  for (const text of Object.values(config.heroText ?? {}))
    for (const value of [text.headline, text.blurb, text.buttonLabel])
      if ((value ?? '').length > MAX_HERO_TEXT)
        return `Keep hero text to ${MAX_HERO_TEXT} characters`;
  for (const row of config.rows) {
    const name = cleanRowName(row.name);
    if (!name) return 'Give the section a name';
    if (name.length > MAX_ROW_NAME) return `Keep the name to ${MAX_ROW_NAME} characters`;
    if (row.viewAllMode === 'custom' && viewAllUrlProblem(row.viewAllUrl ?? ''))
      return VIEW_ALL_URL_MESSAGE;
    if (
      row.minItems !== undefined &&
      (!Number.isInteger(row.minItems) ||
        row.minItems < MIN_ITEMS_RANGE[0] ||
        row.minItems > MIN_ITEMS_RANGE[1])
    )
      return `Use a minimum from ${MIN_ITEMS_RANGE[0]} to ${MIN_ITEMS_RANGE[1]} titles`;
  }
  return null;
}

/** Row ids from the editor screen can be any string. The table wants a uuid, so map them the same way every time. */
export function rowUuid(id: string): string {
  if (isUuid(id)) return id;
  const bytes = createHash('sha256').update(`home-row:${id}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const HERO_ID = rowUuid('home-hero');

const KIND_OF: Record<HomeRowType, RowKind> = {
  manual: 'curated',
  category: 'category',
  newest: 'recently_added',
  series: 'curated',
  smart: 'popular',
  each_category: 'each_category',
  all_series: 'all_series',
  continue_watching: 'continue_watching',
  my_list: 'my_list',
};
const TYPE_OF: Partial<Record<RowKind, HomeRowType>> = {
  curated: 'manual',
  category: 'category',
  recently_added: 'newest',
  popular: 'smart',
  each_category: 'each_category',
  all_series: 'all_series',
  continue_watching: 'continue_watching',
  my_list: 'my_list',
};

async function readSetting<T>(tx: Tx, key: string): Promise<T | null> {
  const [row] = await tx
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key));
  return (row?.value as T | undefined) ?? null;
}

async function writeSetting(tx: Tx, actor: Actor, key: string, value: unknown) {
  await tx
    .insert(settings)
    .values({ key, value: value as never, updatedBy: actor.accountId })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as never, updatedBy: actor.accountId, updatedAt: new Date() },
    });
}

/** Builds a config from rows that were seeded or written outside the admin screen. */
async function configFromRows(tx: Tx): Promise<HomeConfig | null> {
  const all = await tx.select().from(rows).orderBy(rows.position);
  if (!all.length) return null;
  const items = await tx.select().from(rowItems).orderBy(rowItems.position);
  const config: HomeConfig = { heroIds: [], rows: [] };
  for (const row of all) {
    const ids = items
      .filter((i) => i.rowId === row.id && i.videoId)
      .map((i) => i.videoId as string);
    if (row.kind === 'hero') {
      config.heroIds = ids.slice(0, MAX_HERO);
      const heroText: Record<string, HeroText> = {};
      for (const i of items) {
        if (i.rowId !== row.id || !i.videoId || !config.heroIds.includes(i.videoId)) continue;
        const text: HeroText = {};
        if (i.heroHeadline) text.headline = i.heroHeadline;
        if (i.heroBlurb) text.blurb = i.heroBlurb;
        if (i.heroButtonLabel) text.buttonLabel = i.heroButtonLabel;
        if (Object.keys(text).length) heroText[i.videoId] = text;
      }
      if (Object.keys(heroText).length) config.heroText = heroText;
      continue;
    }
    const type = row.kind === 'curated' && row.seriesId ? 'series' : TYPE_OF[row.kind];
    if (!type) continue;
    config.rows.push({
      id: row.id,
      type,
      name: row.title,
      visible: row.isPublished,
      videoIds: type === 'manual' ? ids : [],
      sourceId: type === 'category' ? row.categoryId : type === 'series' ? row.seriesId : null,
      slug: row.slug,
      viewAllMode: row.viewAllMode as ViewAllMode,
      viewAllUrl: row.viewAllUrl,
      minItems: row.minItems,
      kidsVisible: row.kidsVisible,
    });
  }
  return config;
}

async function readState(tx: Tx): Promise<HomeState> {
  const stored = await readSetting<HomeConfig>(tx, KEYS.published);
  const published = stored ?? (await configFromRows(tx)) ?? defaultHomeConfig();
  return {
    published,
    draft: (await readSetting<HomeConfig>(tx, KEYS.draft)) ?? published,
    previous: await readSetting<HomeConfig>(tx, KEYS.previous),
    publishedAt: await readSetting<string>(tx, KEYS.at),
  };
}

/** True when a home layout was ever published or seeded, so tools never overwrite an edited one. */
export async function hasPublishedHome(ctx: AdminContext, actor: Actor): Promise<boolean> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    if ((await readSetting<HomeConfig>(tx, KEYS.published)) !== null) return true;
    return (await configFromRows(tx)) !== null;
  });
}

export async function getAdminHome(ctx: AdminContext, actor: Actor): Promise<{ state: HomeState }> {
  assertStaff(actor);
  return { state: await withAccount(ctx.db, actor, readState) };
}

export async function saveAdminHomeDraft(
  ctx: AdminContext,
  actor: Actor,
  config: HomeConfig,
): Promise<CommandResult> {
  assertStaff(actor);
  const problem = validateHomeConfig(config);
  if (problem) return fail(problem);
  await withAccount(ctx.db, actor, (tx) => writeSetting(tx, actor, KEYS.draft, config));
  return OK;
}

/** Makes the `rows` table match a config, in one transaction, so viewers never see a half written home page. */
async function syncRows(tx: Tx, config: HomeConfig): Promise<void> {
  type Target = {
    id: string;
    title: string;
    kind: RowKind;
    categoryId: string | null;
    seriesId?: string | null;
    published: boolean;
    videoIds: string[];
    slug: string | null;
    viewAllMode: ViewAllMode;
    viewAllUrl: string | null;
    minItems: number;
    kidsVisible: boolean;
    heroText?: Record<string, HeroText>;
  };
  const usedSlugs = new Set<string>();
  const slugFor = (row: HomeRowConfig): string | null => {
    if (row.type !== 'manual') return null;
    const base = row.slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug) ? row.slug : slugifyRowName(row.name);
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    usedSlugs.add(slug);
    return slug;
  };
  const existingVideos = async (ids: string[]) => {
    if (!ids.length) return [];
    const found = rowsOf<{ id: string }>(
      await tx.execute(
        sql`SELECT id FROM videos WHERE deleted_at IS NULL AND id IN (${sql.join(
          ids.filter(isUuid).map((i) => sql`${i}::uuid`),
          sql`, `,
        )})`,
      ),
    ).map((r) => r.id);
    const set = new Set(found);
    return ids.filter((id) => set.has(id));
  };

  const targets: Target[] = [];
  const heroIds = await existingVideos(config.heroIds.filter(isUuid));
  if (heroIds.length)
    targets.push({
      id: HERO_ID,
      title: 'Featured',
      kind: 'hero',
      categoryId: null,
      published: true,
      videoIds: heroIds,
      heroText: config.heroText,
      slug: null,
      viewAllMode: 'none',
      viewAllUrl: null,
      minItems: 1,
      kidsVisible: true,
    });

  for (const row of config.rows) {
    let categoryId: string | null = null;
    let seriesId: string | null = null;
    let videoIds: string[] = [];
    if (row.type === 'category') {
      if (!row.sourceId || !isUuid(row.sourceId)) continue;
      const [found] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, row.sourceId));
      if (!found) continue;
      categoryId = found.id;
    } else if (row.type === 'manual') {
      videoIds = await existingVideos(row.videoIds.slice(0, MAX_ROW_TITLES));
    } else if (row.type === 'series') {
      // Not a copy of the episodes: the viewer side reads them from the series each time, so the row follows it.
      if (!row.sourceId || !isUuid(row.sourceId)) continue;
      const [found] = await tx
        .select({ id: series.id })
        .from(series)
        .where(eq(series.id, row.sourceId));
      if (!found) continue;
      seriesId = found.id;
    }
    targets.push({
      seriesId,
      id: rowUuid(row.id),
      title: cleanRowName(row.name).slice(0, 80),
      kind: KIND_OF[row.type],
      categoryId,
      published: row.visible,
      videoIds,
      slug: slugFor(row),
      viewAllMode: row.viewAllMode ?? 'auto',
      viewAllUrl: row.viewAllMode === 'custom' ? (row.viewAllUrl ?? null) : null,
      minItems: row.minItems ?? defaultMinItems(row.type),
      // Every row is filtered for the audience when it is read. The editor can still keep one from kids profiles.
      kidsVisible: row.kidsVisible ?? true,
    });
  }

  const ids = targets.map((t) => t.id);
  if (ids.length) await tx.delete(rows).where(notInArray(rows.id, ids));
  else await tx.delete(rows);
  for (const [position, target] of targets.entries()) {
    const values = {
      id: target.id,
      title: target.title,
      kind: target.kind,
      categoryId: target.categoryId,
      seriesId: target.seriesId ?? null,
      position,
      isPublished: target.published,
      slug: target.slug,
      viewAllMode: target.viewAllMode,
      viewAllUrl: target.viewAllUrl,
      minItems: target.minItems,
      kidsVisible: target.kidsVisible,
      maxItems:
        target.kind === 'hero' ? MAX_HERO : target.seriesId ? SERIES_ROW_MAX : MAX_ROW_TITLES,
    };
    await tx.insert(rows).values(values).onConflictDoUpdate({ target: rows.id, set: values });
    await tx.delete(rowItems).where(eq(rowItems.rowId, target.id));
    if (target.videoIds.length)
      await tx
        .insert(rowItems)
        .values(
          target.videoIds.map((videoId, i) => {
            const text = target.kind === 'hero' ? target.heroText?.[videoId] : undefined;
            return {
              rowId: target.id,
              position: i,
              videoId,
              heroHeadline: text?.headline?.trim() || null,
              heroBlurb: text?.blurb?.trim() || null,
              heroButtonLabel: text?.buttonLabel?.trim() || null,
            };
          }),
        );
  }
}

async function audit(tx: Tx, actor: Actor, action: string, summary: string) {
  await writeAudit(tx, {
    action,
    outcome: 'success',
    actorAccountId: actor.accountId,
    actorRole: actor.role,
    targetType: 'home',
    targetId: null,
    summary,
  });
}

export async function publishAdminHome(
  ctx: AdminContext,
  actor: Actor,
  config: HomeConfig,
): Promise<CommandResult> {
  assertStaff(actor);
  const problem = validateHomeConfig(config);
  if (problem) return fail(problem);
  await withAccount(ctx.db, actor, async (tx) => {
    const state = await readState(tx);
    await writeSetting(tx, actor, KEYS.previous, state.published);
    await writeSetting(tx, actor, KEYS.draft, config);
    await writeSetting(tx, actor, KEYS.published, config);
    await writeSetting(tx, actor, KEYS.at, (ctx.now?.() ?? new Date()).toISOString());
    await syncRows(tx, config);
    await audit(tx, actor, 'home.publish', 'Published the home page');
  });
  return OK;
}

export async function restorePreviousAdminHome(
  ctx: AdminContext,
  actor: Actor,
): Promise<CommandResult> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const state = await readState(tx);
    if (!state.previous) return fail('There is no earlier version to restore.');
    await writeSetting(tx, actor, KEYS.published, state.previous);
    await writeSetting(tx, actor, KEYS.draft, state.previous);
    await writeSetting(tx, actor, KEYS.previous, state.published);
    await writeSetting(tx, actor, KEYS.at, (ctx.now?.() ?? new Date()).toISOString());
    await syncRows(tx, state.previous);
    await audit(tx, actor, 'home.restore', 'Restored the earlier home page');
    return OK;
  });
}
