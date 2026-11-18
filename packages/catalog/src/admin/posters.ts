import { and, eq, like, or, sql } from 'drizzle-orm';
import { assets, videos, withAccount } from '@ad/db';
import { Forbidden, NotFound, isUuid, uuidv7, type Actor } from '@ad/shared';
import { mediaUrl } from '../artwork';
import type { AdminContext } from './types';

function assertStaff(actor: Actor): void {
  if (actor.role !== 'editor' && actor.role !== 'admin') throw new Forbidden('Editors only');
}

/** Where the source of an admin upload lives in the originals bucket. */
export const posterUploadKey = (videoId: string, assetId: string) => `uploads/${videoId}/${assetId}`;

export interface PosterAssetDto {
  id: string;
  /** `frame` is a candidate cut from the video. `upload` is a picture an admin supplied. */
  source: 'frame' | 'upload';
  label: string;
  status: 'processing' | 'ready' | 'failed';
  /** Smallest variant, for the picker. Null until the picture is processed. */
  url: string | null;
}

/** Frames and uploads for one video, frames first in order, then uploads newest first. */
export async function listPosterAssets(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
  mediaOrigin: string,
): Promise<PosterAssetDto[]> {
  assertStaff(actor);
  if (!isUuid(videoId)) throw new NotFound('Video not found');
  return withAccount(ctx.db, actor, async (tx) => {
    const rows = await tx
      .select({
        id: assets.id,
        rawKey: assets.rawKey,
        status: assets.status,
        variants: assets.variants,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(
        or(
          like(assets.rawKey, `candidates/${videoId}/%`),
          like(assets.rawKey, `uploads/${videoId}/%`),
        ),
      );
    const preview = (variants: (typeof rows)[number]['variants']) => {
      const small = [...variants]
        .filter((v) => v.format !== 'jpeg')
        .sort((a, b) => a.width - b.width)[0];
      const any = small ?? [...variants].sort((a, b) => a.width - b.width)[0];
      return any ? mediaUrl(mediaOrigin, any.key) : null;
    };
    const dto = (row: (typeof rows)[number], source: 'frame' | 'upload', label: string): PosterAssetDto => ({
      id: row.id,
      source,
      label,
      status: row.status,
      url: row.status === 'ready' ? preview(row.variants) : null,
    });
    const frames = rows
      .filter((r) => r.rawKey?.startsWith('candidates/'))
      .sort((a, b) => (a.rawKey ?? '').localeCompare(b.rawKey ?? '', 'en', { numeric: true }))
      .map((r) => dto(r, 'frame', `Frame ${r.rawKey!.split('/').pop()}`));
    const uploads = rows
      .filter((r) => r.rawKey?.startsWith('uploads/'))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((r) => dto(r, 'upload', 'Your image'));
    return [...frames, ...uploads];
  });
}

export interface PosterUploadInput {
  mime: 'image/jpeg' | 'image/png' | string;
  bytes: number;
  /** Writes the source to the originals bucket. Called before the row exists, so a row never points at nothing. */
  store: (key: string) => Promise<void>;
  enqueue: (queue: 'image.process', payload: { assetId: string }) => Promise<unknown>;
}

export async function createPosterUpload(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
  input: PosterUploadInput,
): Promise<{ ok: true; assetId: string }> {
  assertStaff(actor);
  if (!isUuid(videoId)) throw new NotFound('Video not found');
  const assetId = uuidv7();
  const rawKey = posterUploadKey(videoId, assetId);
  await withAccount(ctx.db, actor, async (tx) => {
    const [video] = await tx
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, videoId), sql`${videos.deletedAt} IS NULL`));
    if (!video) throw new NotFound('Video not found');
  });
  await input.store(rawKey);
  await withAccount(ctx.db, actor, (tx) =>
    tx.insert(assets).values({
      id: assetId,
      purpose: 'thumbnail',
      status: 'processing',
      rawKey,
      mime: input.mime,
      bytes: input.bytes,
      createdBy: actor.accountId,
    }),
  );
  await input.enqueue('image.process', { assetId });
  return { ok: true, assetId };
}

export async function getPosterAssetStatus(
  ctx: AdminContext,
  actor: Actor,
  assetId: string,
): Promise<{ status: 'processing' | 'ready' | 'failed' }> {
  assertStaff(actor);
  if (!isUuid(assetId)) throw new NotFound('Picture not found');
  return withAccount(ctx.db, actor, async (tx) => {
    const [row] = await tx.select({ status: assets.status }).from(assets).where(eq(assets.id, assetId));
    if (!row) throw new NotFound('Picture not found');
    return { status: row.status };
  });
}
