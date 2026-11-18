export interface ArtworkVariant {
  width: number;
  height: number;
  url: string;
  /** Absent on rows made before jpeg variants existed, which are webp. */
  format?: 'avif' | 'webp' | 'jpeg';
}

/** What the UI needs to draw an image without layout shift: sized variants, a placeholder colour and alt text (M36). */
export interface ArtworkDto {
  id: string;
  alt: string | null;
  placeholderColor: string | null;
  /** A webp data url under 1 KB to draw blurred while the image loads. Null on rows made before it existed. */
  placeholderBlur?: string | null;
  width: number | null;
  height: number | null;
  variants: ArtworkVariant[];
}

export interface ArtworkRow {
  poster_id: string | null;
  poster_alt: string | null;
  poster_color: string | null;
  poster_blur?: string | null;
  poster_width: number | null;
  poster_height: number | null;
  poster_variants:
    | {
        width: number;
        height: number;
        key: string;
        bytes: number;
        format?: 'avif' | 'webp' | 'jpeg';
      }[]
    | null;
}

export const ARTWORK_COLUMNS = `pa.id AS poster_id, pa.alt_text AS poster_alt, pa.placeholder_color AS poster_color, pa.placeholder_blur AS poster_blur,
  pa.width AS poster_width, pa.height AS poster_height, pa.variants AS poster_variants`;

export function mediaUrl(mediaOrigin: string, key: string): string {
  return `${mediaOrigin.replace(/\/+$/, '')}/${key}`;
}

/** Variants are listed smallest first, so the first one is the data saver choice (320 wide). */
export function artworkFromRow(row: ArtworkRow, mediaOrigin: string): ArtworkDto | null {
  if (row.poster_id === null) return null;
  const variants = [...(row.poster_variants ?? [])]
    .sort((a, b) => a.width - b.width || (a.format ?? 'webp').localeCompare(b.format ?? 'webp'))
    .map((variant) => ({
      width: variant.width,
      height: variant.height,
      url: mediaUrl(mediaOrigin, variant.key),
      ...(variant.format ? { format: variant.format } : {}),
    }));
  return {
    id: row.poster_id,
    alt: row.poster_alt,
    placeholderColor: row.poster_color,
    placeholderBlur: row.poster_blur ?? null,
    width: row.poster_width,
    height: row.poster_height,
    variants,
  };
}
