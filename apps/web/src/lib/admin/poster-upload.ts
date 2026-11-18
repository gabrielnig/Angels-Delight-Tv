import sharp from 'sharp';
import { POSTER_MAX_BYTES, POSTER_MIN_HEIGHT, POSTER_MIN_WIDTH } from './poster-rules';

export type PosterUploadCheck =
  | { ok: true; mime: 'image/jpeg' | 'image/png'; width: number; height: number }
  | { ok: false; error: string };

function sniff(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  return null;
}

/** Server side check of an uploaded poster. The browser checks too, but only these results count. */
export async function checkPosterUpload(bytes: Uint8Array): Promise<PosterUploadCheck> {
  const mime = sniff(bytes);
  if (!mime) return { ok: false, error: 'Use a JPG or PNG image.' };
  if (bytes.length > POSTER_MAX_BYTES)
    return { ok: false, error: 'That image is over 5 MB. Choose a smaller one.' };
  try {
    const meta = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < POSTER_MIN_WIDTH || height < POSTER_MIN_HEIGHT)
      return {
        ok: false,
        error: `That image is ${width} by ${height}. Use at least ${POSTER_MIN_WIDTH} by ${POSTER_MIN_HEIGHT}.`,
      };
    return { ok: true, mime, width, height };
  } catch {
    return { ok: false, error: 'That file could not be read as an image.' };
  }
}
