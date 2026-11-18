import sharp from 'sharp';

export type ImagePreset = 'poster' | 'hero' | 'thumbnail';
export type ImageFormat = 'avif' | 'webp' | 'jpeg';

export interface PresetSpec {
  /** Output widths, smallest first. Widths above the source width are skipped, nothing is upscaled. */
  widths: readonly number[];
  /** Width over height of the cropped frame. */
  ratio: number;
  /** Narrowest source we accept. Below this the picture would look soft. */
  minWidth: number;
}

/** The widths are the contract with the viewer: 320 is the Data saver size (M25-S03). */
export const IMAGE_PRESETS: Record<ImagePreset, PresetSpec> = {
  poster: { widths: [320, 480, 640, 960, 1280], ratio: 16 / 9, minWidth: 320 },
  hero: { widths: [320, 640, 960, 1280, 1920], ratio: 16 / 9, minWidth: 640 },
  thumbnail: { widths: [160, 240, 320, 480], ratio: 16 / 9, minWidth: 160 },
};

export interface CropFocus {
  /** Percent from the left and from the top of the picture. */
  x: number;
  y: number;
  /** 100 shows the whole crop frame, 200 zooms in twice as far. */
  zoom?: number;
}

export interface ProcessOptions {
  focus?: CropFocus;
  /** Refuses pictures with more pixels than this (decompression bombs). Defaults to 50 megapixels. */
  maxPixels?: number;
}

export interface ProcessedVariant {
  width: number;
  height: number;
  format: ImageFormat;
  bytes: Uint8Array;
}

export interface ProcessedImage {
  variants: ProcessedVariant[];
  /**
   * Small webp of the whole picture, only when the source is not 16 by 9 (the cut variants then lose the edges) and
   * not a recut. The admin poster picker shows it so the crop preview uses the real picture (M36-S03).
   */
  full?: ProcessedVariant;
  placeholderColor: string;
  /** A tiny webp as a data url, under 1 KB, drawn blurred while the real image loads (M36-S02). */
  placeholderBlur: string;
  source: { width: number; height: number };
}

/** The file is unusable. The queue treats this as permanent, because trying again cannot help. */
export class ImageRejected extends Error {
  readonly plain: string;
  readonly detail: string;
  constructor(plain: string, detail?: string) {
    super(plain);
    this.name = 'ImageRejected';
    this.plain = plain;
    this.detail = detail ?? plain;
  }
}

/** Base64 grows by a third, so 700 bytes keeps the whole data url under 1 KB. */
const BLUR_MAX_BYTES = 700;
const FULL_PREVIEW_WIDTH = 480;
const DEFAULT_MAX_PIXELS = 50_000_000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

/** Region of the source to keep: the largest frame of the wanted ratio, shrunk by zoom, centred on the focus. */
export function cropRect(
  source: { width: number; height: number },
  ratio: number,
  focus: CropFocus = { x: 50, y: 50 },
): { left: number; top: number; width: number; height: number } {
  let width = source.width;
  let height = Math.round(width / ratio);
  if (height > source.height) {
    height = source.height;
    width = Math.round(height * ratio);
  }
  const zoom = clamp(focus.zoom ?? 100, 100, 200) / 100;
  width = Math.max(1, Math.round(width / zoom));
  height = Math.max(1, Math.round(height / zoom));
  const left = clamp(
    Math.round((source.width * clamp(focus.x, 0, 100)) / 100 - width / 2),
    0,
    source.width - width,
  );
  const top = clamp(
    Math.round((source.height * clamp(focus.y, 0, 100)) / 100 - height / 2),
    0,
    source.height - height,
  );
  return { left, top, width, height };
}

export async function processImage(
  input: Uint8Array,
  preset: ImagePreset,
  options: ProcessOptions = {},
): Promise<ProcessedImage> {
  const spec = IMAGE_PRESETS[preset];
  const limit = options.maxPixels ?? DEFAULT_MAX_PIXELS;
  let oriented: Buffer;
  let size: { width: number; height: number };
  try {
    const result = await sharp(input, { limitInputPixels: limit, failOn: 'error' })
      .rotate()
      .toBuffer({ resolveWithObject: true });
    oriented = result.data;
    size = { width: result.info.width, height: result.info.height };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/pixel limit/i.test(detail))
      throw new ImageRejected('That picture is too large to process.', detail);
    throw new ImageRejected('That file could not be read as a picture.', detail);
  }
  if (size.width < spec.minWidth) {
    throw new ImageRejected(
      `That picture is too small. Use one at least ${spec.minWidth} pixels wide.`,
      `${size.width}x${size.height} below ${spec.minWidth}`,
    );
  }

  const rect = cropRect(size, spec.ratio, options.focus);
  const cropped = await sharp(oriented).extract(rect).toBuffer();
  const widths = spec.widths.filter((w) => w <= rect.width);
  if (widths.length === 0) widths.push(Math.min(...spec.widths, rect.width));

  const variants: ProcessedVariant[] = [];
  for (const width of widths) {
    const height = Math.round(width / spec.ratio);
    const resized = () => sharp(cropped).resize(width, height, { fit: 'fill' });
    const avif = await resized().avif({ quality: 50, effort: 2 }).toBuffer();
    const webp = await resized().webp({ quality: 78, effort: 4 }).toBuffer();
    const jpeg = await resized().jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
    variants.push({ width, height, format: 'avif', bytes: new Uint8Array(avif) });
    variants.push({ width, height, format: 'webp', bytes: new Uint8Array(webp) });
    variants.push({ width, height, format: 'jpeg', bytes: new Uint8Array(jpeg) });
  }

  const pixel = await sharp(cropped).resize(1, 1, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const odd = Math.abs(size.width / size.height / spec.ratio - 1) > 0.01;
  let full: ProcessedVariant | undefined;
  if (odd && !options.focus) {
    const width = Math.min(FULL_PREVIEW_WIDTH, size.width);
    const height = Math.max(1, Math.round((width * size.height) / size.width));
    const webp = await sharp(oriented)
      .resize(width, height, { fit: 'fill' })
      .webp({ quality: 70 })
      .toBuffer();
    full = { width, height, format: 'webp', bytes: new Uint8Array(webp) };
  }
  return {
    variants,
    ...(full ? { full } : {}),
    placeholderBlur: await blurPlaceholder(cropped, spec.ratio),
    placeholderColor: `#${hex(pixel[0]!)}${hex(pixel[1]!)}${hex(pixel[2]!)}`,
    source: size,
  };
}

/**
 * A few dozen pixels wide, so it is tiny by construction. Starts at a nicer size and steps down until the data url is
 * under 1 KB, which a busy picture needs and a flat one does not.
 */
async function blurPlaceholder(cropped: Buffer, ratio: number): Promise<string> {
  let last = Buffer.alloc(0);
  for (const width of [24, 16, 12, 8]) {
    for (const quality of [40, 25, 10]) {
      last = await sharp(cropped)
        .resize(width, Math.max(1, Math.round(width / ratio)), { fit: 'fill' })
        .webp({ quality, effort: 6 })
        .toBuffer();
      if (last.length <= BLUR_MAX_BYTES) return `data:image/webp;base64,${last.toString('base64')}`;
    }
  }
  return `data:image/webp;base64,${last.toString('base64')}`;
}
