import { safePlaceholderBlur, safePlaceholderColor } from '@ad/ui';
import type { ArtworkDto } from '@ad/catalog';
import type { Thumb } from '../data/types';

const PREFERRED_WIDTH = 480;

export function toThumb(poster: ArtworkDto | null): Thumb | undefined {
  const all = poster?.variants ?? [];
  const jpeg = all.filter((v) => v.format === 'jpeg');
  const webp = all.filter((v) => v.format !== 'jpeg' && v.format !== 'avif');
  // Rows without webp (not produced today) still work from jpeg alone.
  const main = webp.length > 0 ? webp : jpeg;
  if (main.length === 0) return undefined;
  const pick = (list: ArtworkDto['variants']) =>
    list.find((v) => v.width >= PREFERRED_WIDTH) ?? list[list.length - 1]!;
  const set = (list: ArtworkDto['variants']) => list.map((v) => `${v.url} ${v.width}w`).join(', ');
  const thumb: Thumb = { src: pick(main).url, srcSet: set(main) };
  const blur = safePlaceholderBlur(poster?.placeholderBlur);
  const color = safePlaceholderColor(poster?.placeholderColor);
  if (blur) thumb.placeholderBlur = blur;
  if (color) thumb.placeholderColor = color;
  if (webp.length > 0 && jpeg.length > 0) {
    thumb.fallbackSrc = pick(jpeg).url;
    thumb.fallbackSrcSet = set(jpeg);
  }
  return thumb;
}
