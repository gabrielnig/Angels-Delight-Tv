/** One pre-sized image variant from `assets.variants`, with its public media URL. */
export interface PosterVariant {
  width: number;
  height: number;
  url: string;
}

export interface PosterSources {
  src: string;
  srcSet: string;
  /** Intrinsic size of `src`, for width and height attributes so the page does not shift. */
  width: number;
  height: number;
}

/**
 * Picks the variants to offer. Variants are hash named files made by the pipeline, so this only chooses and
 * orders them. `maxWidth` is the Data saver cap: wider variants are not offered, so the browser cannot fetch them.
 */
export function buildPosterSources(
  variants: PosterVariant[],
  options: { maxWidth?: number | null },
): PosterSources | null {
  const usable = variants
    .filter((v) => v.url && v.width > 0 && v.height > 0)
    .sort((a, b) => a.width - b.width);
  if (usable.length === 0) return null;

  const cap = options.maxWidth ?? null;
  const allowed = cap === null ? usable : usable.filter((v) => v.width <= cap);
  const offered = allowed.length > 0 ? allowed : [usable[0]!];
  const fallback = offered[Math.floor((offered.length - 1) / 2)]!;

  return {
    src: fallback.url,
    srcSet: offered.map((v) => `${v.url} ${v.width}w`).join(', '),
    width: fallback.width,
    height: fallback.height,
  };
}
