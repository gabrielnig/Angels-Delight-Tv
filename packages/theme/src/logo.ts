import { createHash } from 'node:crypto';
import sharp, { type Metadata, type Sharp } from 'sharp';
import {
  Forbidden,
  ValidationFailed,
  uuidv7,
  type Actor,
  type AssetPurpose,
  isAdminRole,
} from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { toHex } from './contrast';

/** M18-S05: up to 500 KB. SVG is rejected (docs/SECURITY.md section 11), see D-026. */
export const MAX_LOGO_BYTES = 500 * 1024;
const MIN_SIDE = 32;
const MAX_SIDE = 4096;
const LOGO_WIDTHS = [160, 320, 640];
const FAVICON_SIZES = [32, 192, 512];

export type BrandImageKind = 'logo' | 'favicon';

export interface ImageVariant {
  width: number;
  height: number;
  bytes: Buffer;
}

export interface ProcessedBrandImage {
  variants: ImageVariant[];
  width: number;
  height: number;
  sha256: Buffer;
  placeholderColor: string;
}

function reject(message: string): never {
  throw new ValidationFailed({ file: [message] }, message);
}

function sniff(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | null {
  const b = Buffer.from(bytes.subarray(0, 12));
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

/**
 * Validates by content, decodes and re-encodes to WebP. Re-encoding drops metadata and any payload hidden
 * in the original (docs/SECURITY.md section 11). Logos keep their aspect ratio and are never upscaled.
 */
export async function processBrandImage(
  input: Uint8Array,
  kind: BrandImageKind,
): Promise<ProcessedBrandImage> {
  if (input.byteLength === 0) reject('Choose an image file.');
  if (input.byteLength > MAX_LOGO_BYTES)
    reject('The image is larger than 500 KB. Use a smaller file.');
  if (!sniff(input)) reject('Use a PNG, JPEG or WebP image. SVG files are not accepted.');

  let source: Sharp;
  let metadata: Metadata;
  try {
    source = sharp(Buffer.from(input), {
      limitInputPixels: MAX_SIDE * MAX_SIDE,
      failOn: 'error',
      animated: true,
    });
    metadata = await source.metadata();
  } catch {
    return reject('That image could not be read. Try exporting it again.');
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if ((metadata.pages ?? 1) > 1) reject('Animated images are not accepted.');
  if (width < MIN_SIDE || height < MIN_SIDE)
    reject(`The image must be at least ${MIN_SIDE} px on each side.`);
  if (width > MAX_SIDE || height > MAX_SIDE)
    reject(`The image must be at most ${MAX_SIDE} px on each side.`);

  const variants: ImageVariant[] = [];
  try {
    if (kind === 'logo') {
      const widths = [
        ...new Set(
          LOGO_WIDTHS.filter((w) => w < width).concat(Math.min(width, LOGO_WIDTHS.at(-1)!)),
        ),
      ].sort((a, b) => a - b);
      for (const target of widths) {
        const { data, info } = await sharp(Buffer.from(input))
          .resize({ width: target, withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer({ resolveWithObject: true });
        variants.push({ width: info.width, height: info.height, bytes: data });
      }
    } else {
      for (const size of FAVICON_SIZES) {
        const data = await sharp(Buffer.from(input))
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 90 })
          .toBuffer();
        variants.push({ width: size, height: size, bytes: data });
      }
    }
    const stats = await sharp(Buffer.from(input)).stats();
    const [r, g, b] = stats.channels.map((channel) => channel.mean);
    return {
      variants,
      width,
      height,
      sha256: createHash('sha256').update(input).digest(),
      placeholderColor: toHex([r ?? 0, g ?? 0, b ?? 0]),
    };
  } catch {
    return reject('That image could not be processed. Try exporting it again.');
  }
}

export interface StoredAsset {
  id: string;
  purpose: AssetPurpose;
  status: 'ready';
  mime: 'image/webp';
  bytes: number;
  width: number;
  height: number;
  sha256: Buffer;
  placeholderColor: string;
  altText: string | null;
  mediaKeyBase: string;
  variants: { width: number; height: number; key: string; bytes: number }[];
  createdBy: string;
}

export interface AssetStore {
  insert(asset: StoredAsset): Promise<void>;
  get(id: string): Promise<StoredAsset | null>;
}

export class MemoryAssetStore implements AssetStore {
  rows: StoredAsset[] = [];
  failNextInsert = false;
  async get(id: string): Promise<StoredAsset | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async insert(asset: StoredAsset): Promise<void> {
    if (this.failNextInsert) {
      this.failNextInsert = false;
      throw new Error('insert failed');
    }
    this.rows.push(asset);
  }
}

export interface LogoUploaderOptions {
  /** The media bucket adapter. */
  storage: StorageAdapter;
  assets: AssetStore;
}

export class LogoUploader {
  constructor(private readonly options: LogoUploaderOptions) {}

  async upload(
    actor: Actor,
    bytes: Uint8Array,
    input: { purpose: BrandImageKind; altText?: string | null },
  ): Promise<StoredAsset> {
    if (!isAdminRole(actor.role)) throw new Forbidden('Only an admin can upload a logo');
    const altText = input.altText?.trim() || null;
    if (altText && altText.length > 200) {
      throw new ValidationFailed(
        { altText: ['Use 200 characters or fewer.'] },
        'Alt text is too long',
      );
    }
    const processed = await processBrandImage(bytes, input.purpose);
    const id = uuidv7();
    const written: string[] = [];
    try {
      const variants: StoredAsset['variants'] = [];
      for (const variant of processed.variants) {
        const sha8 = createHash('sha256').update(variant.bytes).digest('hex').slice(0, 8);
        const key = `img/${id}/${variant.width}-${sha8}.webp`;
        await this.options.storage.put(key, variant.bytes, {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        });
        written.push(key);
        variants.push({
          width: variant.width,
          height: variant.height,
          key,
          bytes: variant.bytes.length,
        });
      }
      const asset: StoredAsset = {
        id,
        purpose: input.purpose,
        status: 'ready',
        mime: 'image/webp',
        bytes: variants.reduce((total, variant) => total + variant.bytes, 0),
        width: processed.width,
        height: processed.height,
        sha256: processed.sha256,
        placeholderColor: processed.placeholderColor,
        altText,
        mediaKeyBase: `img/${id}/`,
        variants,
        createdBy: actor.accountId,
      };
      await this.options.assets.insert(asset);
      return asset;
    } catch (error) {
      await Promise.allSettled(written.map((key) => this.options.storage.delete(key)));
      throw error;
    }
  }

  async get(id: string): Promise<StoredAsset | null> {
    return this.options.assets.get(id);
  }

  /** The smallest variant that is at least `width` wide, or the largest one. */
  static variantKey(asset: Pick<StoredAsset, 'variants'>, width: number): string {
    const sorted = [...asset.variants].sort((a, b) => a.width - b.width);
    return (sorted.find((variant) => variant.width >= width) ?? sorted.at(-1)!).key;
  }
}
