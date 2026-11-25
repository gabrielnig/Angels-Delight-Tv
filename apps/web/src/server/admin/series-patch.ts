import type { SeriesPatch } from '@/lib/data/admin/collection-commands';

/** Coerces what a browser sent to a series edit. Words and ranks are validated again by the service. */
export function cleanSeriesPatch(patch: SeriesPatch): SeriesPatch {
  return {
    title: patch.title === undefined ? undefined : String(patch.title),
    description: patch.description === undefined ? undefined : String(patch.description),
    published: patch.published === undefined ? undefined : Boolean(patch.published),
    maturityRank: patch.maturityRank === undefined ? undefined : Number(patch.maturityRank),
    applyToEpisodes: patch.applyToEpisodes === undefined ? undefined : Boolean(patch.applyToEpisodes),
    labels: patch.labels === undefined ? undefined : patch.labels,
  };
}
