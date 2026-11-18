import { createHash } from 'node:crypto';
import { schema, type Database } from '@ad/db';
import { NotFound, createLogger, type Logger } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, eq, ne, sql } from 'drizzle-orm';
import { PipelineError } from '../failure';
import { ImageRejected, processImage, type ImagePreset } from './process';

const { assets, videos } = schema;

const IMMUTABLE = 'public, max-age=31536000, immutable';
const MIME = { avif: 'image/avif', webp: 'image/webp', jpeg: 'image/jpeg' } as const;
const EXT = { avif: 'avif', webp: 'webp', jpeg: 'jpg' } as const;

export interface ImageServiceDeps {
  db: Database;
  /** Holds the uploaded or extracted source, never public. */
  originals: StorageAdapter;
  /** Holds the generated variants, public behind the CDN. */
  media: StorageAdapter;
  logger?: Logger;
}

/** Which size ladder an asset gets. Logos and favicons are handled by the theme package. */
export function presetFor(purpose: string): ImagePreset {
  if (purpose === 'hero' || purpose === 'series_art') return 'hero';
  return 'poster';
}

/** `image.process`: turns one source picture into sized avif, webp and jpeg variants and a tiny blur placeholder (M36). */
export class ImageService {
  private readonly logger: Logger;
  constructor(private readonly deps: ImageServiceDeps) {
    this.logger = deps.logger ?? createLogger();
  }

  async process(assetId: string): Promise<void> {
    const { db, media } = this.deps;
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!asset) throw new PipelineError('unknown', `asset ${assetId} not found`, true);
    if (asset.status === 'ready' && asset.variants.length > 0) return;
    if (!asset.rawKey) throw new PipelineError('upload_incomplete', 'asset has no source', true);

    let source: Uint8Array;
    try {
      source = await this.read(asset.rawKey);
    } catch (error) {
      if (error instanceof NotFound)
        throw new PipelineError('upload_incomplete', 'source object missing', true);
      throw error;
    }

    let result;
    try {
      result = await processImage(source, presetFor(asset.purpose), {
        ...(asset.cutFocus ? { focus: asset.cutFocus } : {}),
      });
    } catch (error) {
      if (error instanceof ImageRejected) {
        await db.update(assets).set({ status: 'failed' }).where(eq(assets.id, assetId));
        throw new PipelineError('bad_image', error.detail, true);
      }
      throw error;
    }

    const base = `img/${assetId}/`;
    const stored: {
      width: number;
      height: number;
      key: string;
      bytes: number;
      format: 'avif' | 'webp' | 'jpeg';
    }[] = [];
    for (const variant of result.variants) {
      const hash = createHash('sha256').update(variant.bytes).digest('hex').slice(0, 8);
      const key = `${base}${variant.width}-${hash}.${EXT[variant.format]}`;
      await media.put(key, variant.bytes, {
        contentType: MIME[variant.format],
        cacheControl: IMMUTABLE,
      });
      stored.push({
        width: variant.width,
        height: variant.height,
        key,
        bytes: variant.bytes.length,
        format: variant.format,
      });
    }
    await db
      .update(assets)
      .set({
        status: 'ready',
        mime: 'image/webp',
        mediaKeyBase: base,
        variants: stored,
        width: result.source.width,
        height: result.source.height,
        bytes: source.length,
        sha256: createHash('sha256').update(source).digest(),
        placeholderColor: result.placeholderColor,
        placeholderBlur: result.placeholderBlur,
      })
      .where(eq(assets.id, assetId));
    if (asset.cutFrom && asset.cutFocus)
      await this.adoptRecut(assetId, asset.cutFrom, asset.cutFocus);
    this.logger.info('image processed', { assetId, variants: stored.length });
  }

  /**
   * A poster recut around a focus point is ready (M36-S03). Videos that still use the picture it was cut from, with
   * this same saved focus, switch to it. Earlier recuts of that picture that no video uses any more are removed.
   */
  private async adoptRecut(
    assetId: string,
    cutFrom: string,
    focus: { x: number; y: number; zoom: number },
  ): Promise<void> {
    const { db } = this.deps;
    await db
      .update(videos)
      .set({ posterAssetId: assetId })
      .where(
        and(
          sql`${videos.posterAssetId} IN (SELECT id FROM assets WHERE id = ${cutFrom} OR cut_from = ${cutFrom})`,
          sql`${videos.posterFocus} = ${JSON.stringify(focus)}::jsonb`,
          sql`${videos.posterAssetId} <> ${assetId}`,
        ),
      );
    const stale = await db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.cutFrom, cutFrom),
          eq(assets.status, 'ready'),
          ne(assets.id, assetId),
          sql`NOT EXISTS (SELECT 1 FROM videos v WHERE v.poster_asset_id = assets.id OR v.hero_asset_id = assets.id)`,
        ),
      );
    for (const row of stale) {
      await this.remove(row.id);
      await db.delete(assets).where(eq(assets.id, row.id));
    }
  }

  /** Deletes the source and every generated file. Used when an asset is replaced or its video is purged. */
  async remove(assetId: string): Promise<void> {
    const { db, originals, media } = this.deps;
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!asset) return;
    await media.deletePrefix(asset.mediaKeyBase ?? `img/${assetId}/`);
    if (asset.rawKey) await originals.delete(asset.rawKey);
  }

  private async read(key: string): Promise<Uint8Array> {
    const stream = await this.deps.originals.get(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
    return new Uint8Array(Buffer.concat(chunks));
  }
}
