import type { VideoPatch } from '@/lib/data/admin/video-commands';

export type UploadSuitability = '' | 'everyone' | 'kids' | 'older';

/** Details shared by every file in an upload batch (L3-D15). Blank suitability means not set. */
export interface UploadDetails {
  categoryIds: string[];
  seriesId: string | null;
  /** Number episodes in file order. Off by default. */
  numberEpisodes: boolean;
  startEpisode: number;
  suitability: UploadSuitability;
  tags: string[];
}

/** What one file can change on its own (L3-15). Anything left out follows the shared details. */
export interface FileOverride {
  title?: string;
  categoryIds?: string[];
  seriesId?: string | null;
  episodeNumber?: number | null;
  suitability?: UploadSuitability;
}

export interface ResolvedDetails {
  title?: string;
  categoryIds: string[];
  seriesId: string | null;
  episodeNumber: number | null;
  suitability: UploadSuitability;
  tags: string[];
}

export const EMPTY_DETAILS: UploadDetails = {
  categoryIds: [],
  seriesId: null,
  numberEpisodes: false,
  startEpisode: 1,
  suitability: '',
  tags: [],
};

/**
 * The details one file gets: shared values with its own overrides on top. `index` is the file's place in the
 * batch, used for episode numbering. Returns null for a replace upload, which never takes details.
 */
export function resolveDetails(
  shared: UploadDetails,
  override: FileOverride | undefined,
  index: number,
  options: { replace?: boolean } = {},
): ResolvedDetails | null {
  if (options.replace) return null;
  const seriesId = override?.seriesId !== undefined ? override.seriesId : shared.seriesId;
  const auto = seriesId && shared.numberEpisodes ? shared.startEpisode + index : null;
  return {
    ...(override?.title !== undefined ? { title: override.title } : {}),
    categoryIds: override?.categoryIds ?? shared.categoryIds,
    seriesId,
    episodeNumber: override?.episodeNumber !== undefined ? override.episodeNumber : auto,
    suitability: override?.suitability ?? shared.suitability,
    tags: shared.tags,
  };
}

/** Drops categories and series that no longer exist and reports it in plain words. */
export function validateDetails(
  details: UploadDetails,
  categoryIds: ReadonlySet<string>,
  seriesIds: ReadonlySet<string>,
): { details: UploadDetails; errors: string[] } {
  const errors: string[] = [];
  const kept = details.categoryIds.filter((id) => categoryIds.has(id));
  if (kept.length !== details.categoryIds.length)
    errors.push('Some categories no longer exist and were dropped.');
  let seriesId = details.seriesId;
  if (seriesId && !seriesIds.has(seriesId)) {
    seriesId = null;
    errors.push('That series no longer exists and was dropped.');
  }
  return { details: { ...details, categoryIds: kept, seriesId }, errors };
}

const SUITABILITY_WORDS = { everyone: 'Everyone', kids: 'Kids', older: 'Older viewers' } as const;

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** One line for the collapsed form: "Details for all 8 files: Science, Series X, Everyone." */
export function summarizeDetails(
  details: UploadDetails,
  count: number,
  categories: ReadonlyArray<{ id: string; name: string }>,
  series: ReadonlyArray<{ id: string; title: string }>,
): string {
  const parts: string[] = [];
  const names = details.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean) as string[];
  if (names.length) parts.push(joinNames(names));
  const title = series.find((s) => s.id === details.seriesId)?.title;
  if (title) parts.push(title);
  if (details.suitability) parts.push(SUITABILITY_WORDS[details.suitability]);
  if (details.tags.length) parts.push(`${details.tags.length} ${details.tags.length === 1 ? 'tag' : 'tags'}`);
  const who = count === 1 ? 'this file' : `all ${count} files`;
  return `Details for ${who}: ${parts.length ? parts.join(', ') : 'none set'}.`;
}

/** The patch to send once the draft exists. Blank values are left out so they never overwrite the draft. */
export function toVideoPatch(details: ResolvedDetails): VideoPatch {
  const patch: VideoPatch = {};
  if (details.title !== undefined && details.title.trim()) patch.title = details.title.trim();
  if (details.categoryIds.length) patch.categoryIds = details.categoryIds;
  if (details.suitability) patch.suitability = details.suitability;
  if (details.tags.length) patch.tags = details.tags;
  if (details.seriesId) {
    patch.seriesId = details.seriesId;
    if (details.episodeNumber !== null) patch.episodeNumber = details.episodeNumber;
  }
  return patch;
}
