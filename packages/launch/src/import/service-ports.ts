import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  createAdminCategory,
  createAdminSeries,
  listAdminCategories,
  listAdminSeries,
  setAdminEpisode,
  setAdminPoster,
  updateAdminVideo,
  createPosterUpload,
  type AdminContext,
} from '@ad/catalog';
import { schema, type Database } from '@ad/db';
import type { JobProducer } from '@ad/queue';
import type { Actor } from '@ad/shared';
import { verifyLocalUrl, type LocalStorage, type StorageAdapter } from '@ad/storage';
import type { UploadService } from '@ad/video';
import { and, desc, eq, isNull, like, sql } from 'drizzle-orm';
import type { ManifestRow } from './manifest';
import type { ImportPorts, PosterOutcome } from './runner';

const { videos, assets } = schema;

/** Writes one part to the storage a presigned url points at. */
export type PartWriter = (url: string, bytes: Uint8Array) => Promise<void>;

/** Direct PUT to the presigned object storage url (R2 or any S3 compatible server). This is not the web app. */
export const httpPartWriter: PartWriter = async (url, bytes) => {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { method: 'PUT', body: Buffer.from(bytes) });
      if (response.ok) return;
      lastError = `storage answered ${response.status}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'network error';
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  throw new Error(`Part upload failed: ${lastError}`);
};

/** The local development driver: verifies its own signed url and writes the part into the folder. */
export function localPartWriter(storage: LocalStorage, secret: Uint8Array): PartWriter {
  return async (url, bytes) => {
    const verified = verifyLocalUrl(secret, url, Date.now());
    if (!verified || verified.kind !== 'part') throw new Error('Not a valid part url');
    await storage.receivePart(
      verified.key,
      verified.uploadId,
      verified.partNumber,
      bytes,
      verified.sizeBytes,
    );
  };
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
};
const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const extOf = (name: string) => name.split('.').pop()!.toLowerCase();

export interface ServicePortsDeps {
  db: Database;
  actor: Actor;
  /** The content folder the manifest paths are relative to. */
  dir: string;
  ctx: AdminContext;
  upload: Pick<UploadService, 'create' | 'presignParts' | 'complete'>;
  originals: StorageAdapter;
  producer: Pick<JobProducer, 'enqueue'>;
  writePart: PartWriter;
}

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

/**
 * The real import: every step goes through the services the admin screens and API routes use (UploadService,
 * catalog commands, poster upload), called directly with an admin actor. There is no HTTP request to the web app.
 */
export class ServiceImportPorts implements ImportPorts {
  private readonly categoryIds = new Map<string, string>();
  private readonly seriesIds = new Map<string, string>();

  constructor(private readonly deps: ServicePortsDeps) {}

  private path(file: string): string {
    return join(this.deps.dir, file);
  }

  hash(file: string): Promise<string> {
    return sha256File(this.path(file));
  }

  async findImported(sha: string): Promise<{ videoId: string; complete: boolean } | null> {
    const [row] = await this.deps.db
      .select({ id: videos.id, originalKey: videos.originalKey })
      .from(videos)
      .where(and(eq(videos.originalSha256, Buffer.from(sha, 'hex')), isNull(videos.deletedAt)))
      .orderBy(sql`(${videos.originalKey} IS NULL)`, desc(videos.createdAt))
      .limit(1);
    return row ? { videoId: row.id, complete: row.originalKey !== null } : null;
  }

  async importFile(
    row: ManifestRow,
    sha: string,
    onProgress: (done: number, total: number) => void,
  ): Promise<{ videoId: string; resumed: boolean }> {
    const { upload, actor, db } = this.deps;
    const path = this.path(row.file);
    const size = (await stat(path)).size;
    const state = await upload.create(actor, {
      name: basename(row.file),
      size,
      type: MIME[extOf(row.file)] ?? 'application/octet-stream',
      fingerprint: `imp-${sha.slice(0, 48)}`,
    });
    const videoId = state.videoId;

    // Record the checksum and the metadata before the bytes move, so a crash later never leaves an anonymous video.
    await db
      .update(videos)
      .set({ originalSha256: Buffer.from(sha, 'hex') })
      .where(eq(videos.id, videoId));
    await this.applyMetadata(row, videoId);

    const missing: number[] = [];
    for (let n = 1; n <= state.totalParts; n++)
      if (!state.uploadedParts.includes(n)) missing.push(n);
    let done = state.totalParts - missing.length;
    onProgress(done, state.totalParts);
    const handle = await open(path, 'r');
    try {
      for (let at = 0; at < missing.length; at += 20) {
        const batch = missing.slice(at, at + 20);
        const urls = await upload.presignParts(actor, state.uploadId, batch);
        for (const n of batch) {
          const start = (n - 1) * state.partSize;
          const length = Math.min(state.partSize, size - start);
          const buffer = Buffer.alloc(length);
          await handle.read(buffer, 0, length, start);
          await this.deps.writePart(urls[String(n)]!, buffer);
          onProgress(++done, state.totalParts);
        }
      }
    } finally {
      await handle.close();
    }
    await upload.complete(actor, state.uploadId);
    return { videoId, resumed: state.resumed };
  }

  private async ensureCategory(name: string): Promise<string> {
    const key = name.toLowerCase();
    const cached = this.categoryIds.get(key);
    if (cached) return cached;
    const { ctx, actor } = this.deps;
    const find = async () =>
      (await listAdminCategories(ctx, actor)).find(
        (category) => category.name.toLowerCase() === key,
      );
    let found = await find();
    if (!found) {
      const created = await createAdminCategory(ctx, actor, name);
      if (!created.ok) throw new Error(`Category ${name}: ${created.error}`);
      found = await find();
    }
    if (!found) throw new Error(`Category ${name} could not be created`);
    this.categoryIds.set(key, found.id);
    return found.id;
  }

  private async ensureSeries(title: string): Promise<string> {
    const key = title.toLowerCase();
    const cached = this.seriesIds.get(key);
    if (cached) return cached;
    const { ctx, actor } = this.deps;
    const find = async () =>
      (await listAdminSeries(ctx, actor)).find((item) => item.title.toLowerCase() === key);
    let found = await find();
    if (!found) {
      const created = await createAdminSeries(ctx, actor, { title, description: '' });
      if (!created.ok) throw new Error(`Series ${title}: ${created.error}`);
      found = await find();
    }
    if (!found) throw new Error(`Series ${title} could not be created`);
    this.seriesIds.set(key, found.id);
    return found.id;
  }

  private async applyMetadata(row: ManifestRow, videoId: string): Promise<void> {
    const { ctx, actor, db, originals } = this.deps;
    const categoryIds: string[] = [];
    for (const name of row.categories) categoryIds.push(await this.ensureCategory(name));
    await updateAdminVideo(ctx, actor, videoId, {
      title: row.title,
      description: row.description,
      ...(categoryIds.length ? { categoryIds } : {}),
      ...(row.suitability ? { suitability: row.suitability } : {}),
    });
    await db.update(videos).set({ language: row.language }).where(eq(videos.id, videoId));
    if (row.series && row.season !== null && row.episode !== null) {
      const seriesId = await this.ensureSeries(row.series);
      const placed = await setAdminEpisode(ctx, actor, videoId, seriesId, row.season, row.episode);
      if (!placed.ok) throw new Error(`Series placement: ${placed.error}`);
    }
    if (row.script) {
      const bytes = await readFile(this.path(row.script));
      await originals.put(`scripts/${videoId}.txt`, bytes, { contentType: 'text/plain' });
    }
  }

  async attachPoster(row: ManifestRow, videoId: string): Promise<PosterOutcome> {
    if (!row.poster) return 'none';
    const { db, ctx, actor, originals, producer } = this.deps;
    const [video] = await db
      .select({ posterAssetId: videos.posterAssetId })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!video) throw new Error('The video disappeared');
    if (video.posterAssetId) return 'unchanged';

    const [existing] = await db
      .select({ id: assets.id, status: assets.status })
      .from(assets)
      .where(like(assets.rawKey, `uploads/${videoId}/%`))
      .orderBy(desc(assets.createdAt))
      .limit(1);
    if (!existing) {
      const bytes = await readFile(this.path(row.poster));
      await createPosterUpload(ctx, actor, videoId, {
        mime: IMAGE_MIME[extOf(row.poster)] ?? 'image/jpeg',
        bytes: bytes.length,
        store: (key) => originals.put(key, bytes, { contentType: IMAGE_MIME[extOf(row.poster!)] }),
        enqueue: (queue, payload) =>
          producer.enqueue(queue, payload, { createdBy: actor.accountId }),
      });
      return 'pending';
    }
    if (existing.status === 'failed') throw new Error('The poster picture could not be processed');
    if (existing.status !== 'ready') return 'pending';
    const set = await setAdminPoster(ctx, actor, videoId, {
      posterId: existing.id,
      alt: row.title,
      focus: { x: 50, y: 50 },
      zoom: 100,
    });
    if (!set.ok) throw new Error(set.error);
    return 'attached';
  }
}
