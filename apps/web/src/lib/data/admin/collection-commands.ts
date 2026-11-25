import {
  effectiveSeriesLabels,
  itemWord,
  resolveSeriesLabels,
  validateSeriesLabels,
  type SeriesLabelSetting,
} from '@ad/shared/series-labels';
import type { AdminStore as Store } from './store';
import type { CommandResult } from './video-commands';

/** A command that made something and says which id it got (M51-S04). */
export type CreatedResult = { ok: true; id: string } | { ok: false; error: string };

const fail = (error: string): CommandResult => ({ ok: false, error });
const OK: CommandResult = { ok: true };
const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const live = (s: Store) => s.videos.filter((v) => v.deletedAt === null);

function nameProblem(s: Store, name: string, exceptId?: string): string | null {
  if (!name) return 'Give the category a name.';
  if (name.length > 40) return 'Use 40 characters or fewer.';
  const clash = s.categories.some(
    (c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase(),
  );
  return clash ? 'A category with that name already exists.' : null;
}

function renumber(s: Store) {
  s.categories.sort((a, b) => a.position - b.position).forEach((c, i) => (c.position = i));
}

export function createCategory(s: Store, rawName: string): CommandResult {
  const name = clean(rawName);
  const problem = nameProblem(s, name);
  if (problem) return fail(problem);
  s.categories.push({
    id: `cat_${Date.now().toString(36)}${s.categories.length}`,
    name,
    hidden: false,
    position: s.categories.length,
  });
  return OK;
}

export function renameCategory(s: Store, id: string, rawName: string): CommandResult {
  const category = s.categories.find((c) => c.id === id);
  if (!category) return fail('Category not found.');
  const name = clean(rawName);
  const problem = nameProblem(s, name, id);
  if (problem) return fail(problem);
  category.name = name;
  return OK;
}

export function setCategoryHidden(s: Store, id: string, hidden: boolean): CommandResult {
  const category = s.categories.find((c) => c.id === id);
  if (!category) return fail('Category not found.');
  category.hidden = hidden;
  return OK;
}

export function moveCategory(s: Store, id: string, delta: -1 | 1): CommandResult {
  renumber(s);
  const index = s.categories.findIndex((c) => c.id === id);
  const target = index + delta;
  if (index < 0) return fail('Category not found.');
  if (target < 0 || target >= s.categories.length) return OK;
  const a = s.categories[index]!;
  const b = s.categories[target]!;
  [a.position, b.position] = [b.position, a.position];
  renumber(s);
  return OK;
}

export function categoryVideoCount(s: Store, id: string): number {
  return live(s).filter((v) => v.categoryIds.includes(id)).length;
}

export function deleteCategory(s: Store, id: string): CommandResult {
  if (!s.categories.some((c) => c.id === id)) return fail('Category not found.');
  const count = categoryVideoCount(s, id);
  if (count > 0)
    return fail(
      `${count} ${count === 1 ? 'video uses' : 'videos use'} this category. Move them first, or hide the category instead.`,
    );
  s.categories = s.categories.filter((c) => c.id !== id);
  renumber(s);
  return OK;
}

export interface SeriesPatch {
  title?: string;
  description?: string;
  published?: boolean;
  /** 0 (G) to 4 (18) (M44-S13). */
  maturityRank?: number;
  /** With maturityRank: every episode gets the same rating. The editor confirms this first. */
  applyToEpisodes?: boolean;
  /** Own group and item names (M51). Null goes back to the site default. */
  labels?: SeriesLabelSetting | null;
}

export function createSeries(
  s: Store,
  input: { title: string; description: string },
): CreatedResult {
  const title = clean(input.title);
  if (!title) return { ok: false, error: 'Give the series a title.' };
  if (title.length > 80) return { ok: false, error: 'Use 80 characters or fewer.' };
  const id = `ser_${Date.now().toString(36)}${s.series.length}`;
  s.series.push({
    id,
    title,
    description: input.description.trim().slice(0, 500),
    posterId: null,
    published: false,
  });
  return { ok: true, id };
}

export function updateSeries(s: Store, id: string, patch: SeriesPatch): CommandResult {
  const series = s.series.find((x) => x.id === id);
  if (!series) return fail('Series not found.');
  if (patch.title !== undefined) {
    const title = clean(patch.title);
    if (!title) return fail('Give the series a title.');
    series.title = title.slice(0, 80);
  }
  if (patch.description !== undefined) series.description = patch.description.trim().slice(0, 500);
  if (patch.labels !== undefined) {
    const checked = validateSeriesLabels(patch.labels);
    if (!checked.ok) return fail(`Series names: ${Object.values(checked.errors)[0]}.`);
    series.labelOverride = checked.value;
    series.labels = effectiveSeriesLabels(null, checked.value);
  }
  if (patch.maturityRank !== undefined) {
    if (!Number.isInteger(patch.maturityRank) || patch.maturityRank < 0 || patch.maturityRank > 4)
      return fail('Choose one of the five ratings.');
    series.maturityRank = patch.maturityRank;
    if (patch.applyToEpisodes)
      for (const v of s.videos)
        if (v.seriesId === id && v.deletedAt === null) v.maturityRank = patch.maturityRank;
  }
  if (
    patch.published === true &&
    !live(s).some((v) => v.seriesId === id && v.publishState === 'published')
  )
    return fail(publishRefusal(series.labelOverride ?? null));
  if (patch.published !== undefined) series.published = patch.published;
  return OK;
}

function publishRefusal(override: SeriesLabelSetting | null): string {
  const words = resolveSeriesLabels(effectiveSeriesLabels(null, override), null);
  const item = itemWord(words, 1);
  return `Publish at least one ${words.typed ? item : item.toLowerCase()} before publishing the series.`;
}

export function moveEpisode(s: Store, seriesId: string, videoId: string, direction: 'up' | 'down'): CommandResult {
  const own = s.videos.find((v) => v.id === videoId && v.seriesId === seriesId && v.deletedAt === null);
  if (!own) return fail('That video is not in this series.');
  const group = s.videos
    .filter((v) => v.seriesId === seriesId && v.deletedAt === null && (v.seasonNumber ?? 1) === (own.seasonNumber ?? 1))
    .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
  const at = group.indexOf(own);
  const other = group[direction === 'up' ? at - 1 : at + 1];
  if (!other) return fail(direction === 'up' ? 'It is already first in its group.' : 'It is already last in its group.');
  [own.episodeNumber, other.episodeNumber] = [other.episodeNumber, own.episodeNumber];
  return OK;
}

export function renameGroup(s: Store, seriesId: string, group: number, rawTitle: string): CommandResult {
  const series = s.series.find((x) => x.id === seriesId);
  if (!series) return fail('Series not found.');
  const title = clean(rawTitle);
  if (title.length > 60) return fail('Use 60 characters or fewer.');
  if (!s.videos.some((v) => v.seriesId === seriesId && (v.seasonNumber ?? 1) === group && v.deletedAt === null))
    return fail('That group does not exist yet.');
  const titles = { ...(series.groupTitles ?? {}) };
  if (title === '') delete titles[group];
  else titles[group] = title;
  series.groupTitles = titles;
  return OK;
}

export function deleteSeries(s: Store, id: string): CommandResult {
  if (!s.series.some((x) => x.id === id)) return fail('Series not found.');
  s.series = s.series.filter((x) => x.id !== id);
  for (const v of s.videos)
    if (v.seriesId === id)
      Object.assign(v, { seriesId: null, seasonNumber: null, episodeNumber: null });
  return OK;
}

export function setEpisode(
  s: Store,
  videoId: string,
  seriesId: string | null,
  season: number | null,
  episode: number | null,
): CommandResult {
  const video = s.videos.find((v) => v.id === videoId && v.deletedAt === null);
  if (!video) return fail('Video not found.');
  if (seriesId && !s.series.some((x) => x.id === seriesId)) return fail('Series not found.');
  video.seriesId = seriesId;
  video.seasonNumber = seriesId ? season : null;
  video.episodeNumber = seriesId ? episode : null;
  return OK;
}
