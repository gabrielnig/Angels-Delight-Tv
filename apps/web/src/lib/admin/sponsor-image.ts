import sharp from 'sharp';

export const SPONSOR_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const SPONSOR_SQUARE_MIN = 400;
export const SPONSOR_WIDE_MIN_WIDTH = 1200;
export const SPONSOR_WIDE_MIN_HEIGHT = 400;

export type SponsorImageKind = 'square' | 'wide';
export type SponsorImageCheck =
  { ok: true; mime: 'image/jpeg' | 'image/png'; width: number; height: number } | { ok: false; error: string };

function sniff(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  return null;
}

/** Server side check of a sponsor picture. Only JPG and PNG, never SVG or GIF, and a size cap before decoding. */
export async function checkSponsorImage(bytes: Uint8Array, kind: SponsorImageKind): Promise<SponsorImageCheck> {
  const mime = sniff(bytes);
  if (!mime) return { ok: false, error: 'Use a JPG or PNG picture.' };
  if (bytes.length > SPONSOR_IMAGE_MAX_BYTES) return { ok: false, error: 'That picture is over 2 MB. Choose a smaller one.' };
  const minW = kind === 'square' ? SPONSOR_SQUARE_MIN : SPONSOR_WIDE_MIN_WIDTH;
  const minH = kind === 'square' ? SPONSOR_SQUARE_MIN : SPONSOR_WIDE_MIN_HEIGHT;
  try {
    const meta = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < minW || height < minH) {
      return { ok: false, error: `That picture is ${width} by ${height}. Use one at least ${minW} by ${minH} pixels.` };
    }
    return { ok: true, mime, width, height };
  } catch {
    return { ok: false, error: 'That file could not be read as a picture.' };
  }
}
