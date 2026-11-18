/** One pre-sized image variant from `assets.variants`, with its public media URL. */
export interface PosterVariant {
  width: number;
  height: number;
  url: string;
  /** Absent means webp, the format of variants made before jpeg copies existed. */
  format?: 'webp' | 'jpeg';
}

export interface PosterSources {
  src: string;
  srcSet: string;
  /** Intrinsic size of `src`, for width and height attributes so the page does not shift. */
  width: number;
  height: number;
  /** jpeg copy for browsers that cannot read webp. Absent when there is only one format. */
  fallback?: { src: string; srcSet: string };
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
  const jpeg = usable.filter((v) => v.format === 'jpeg');
  const webp = usable.filter((v) => v.format !== 'jpeg');
  const main = webp.length > 0 ? webp : jpeg;
  if (main.length === 0) return null;

  const cap = options.maxWidth ?? null;
  const offer = (list: PosterVariant[]) => {
    const allowed = cap === null ? list : list.filter((v) => v.width <= cap);
    return allowed.length > 0 ? allowed : [list[0]!];
  };
  const middle = (list: PosterVariant[]) => list[Math.floor((list.length - 1) / 2)]!;
  const set = (list: PosterVariant[]) => list.map((v) => `${v.url} ${v.width}w`).join(', ');

  const offered = offer(main);
  const chosen = middle(offered);
  const out: PosterSources = {
    src: chosen.url,
    srcSet: set(offered),
    width: chosen.width,
    height: chosen.height,
  };
  if (webp.length > 0 && jpeg.length > 0) {
    const offeredJpeg = offer(jpeg);
    out.fallback = { src: middle(offeredJpeg).url, srcSet: set(offeredJpeg) };
  }
  return out;
}
