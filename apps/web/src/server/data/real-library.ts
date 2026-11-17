import {
  addToMyList,
  continueWatching,
  countMyList,
  getProgress,
  listMyList,
  listMyListRefs,
  removeFromMyList,
  removeProgress,
  saveProgress,
  type ViewerContext as ServiceContext,
} from '@ad/viewer';
import { isUuid, ValidationFailed } from '@ad/shared';
import type { TitleRef } from '@ad/catalog';
import type {
  CatalogItem,
  LibraryRepository,
  Page,
  Progress,
  VideoSummary,
  ViewerContext,
} from '../../lib/data/types';
import { viewerActor } from './actor';
import { cardToItem } from './mappers';
import { videoCardToSummary } from './real-catalog';

const PAGE_SIZE = 12;
const UNDO_WINDOW_MS = 5 * 60_000;

/** `video:<uuid>` or `series:<uuid>`. Anything else is a bad request, not a missing title. */
export function parseItemKey(key: string): TitleRef {
  const [kind, id, ...rest] = key.split(':');
  if ((kind !== 'video' && kind !== 'series') || !id || rest.length > 0 || !isUuid(id)) {
    throw new ValidationFailed({ itemKey: ['Not a valid item'] });
  }
  return { kind, id };
}

interface Removed {
  positionMs: number;
  progressVideoId: string;
  expiresAt: number;
}

/**
 * "Remove from row" deletes the progress record (lane C). The undo toast needs the old position back, so the
 * position is kept here for a few minutes. It lives in this process only: after a restart or on another instance
 * the undo is a no-op and the row stays removed. See docs/lanes/K1-viewer-integration.md.
 */
const removed = new Map<string, Removed>();

function stash(profileId: string, videoId: string, value: Omit<Removed, 'expiresAt'>, now: number) {
  for (const [key, entry] of removed) if (entry.expiresAt <= now) removed.delete(key);
  removed.set(`${profileId}:${videoId}`, { ...value, expiresAt: now + UNDO_WINDOW_MS });
}

/** My List, Continue Watching and the undo of a removal on the real viewer services. */
export class RealLibrary implements LibraryRepository {
  constructor(
    private readonly service: ServiceContext,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async myList(
    ctx: ViewerContext,
    cursor?: string,
  ): Promise<Page<CatalogItem> & { hiddenCount: number }> {
    const actor = viewerActor(ctx.accountId);
    const [page, counts] = await Promise.all([
      listMyList(this.service, actor, { profileId: ctx.profileId, limit: PAGE_SIZE, cursor }),
      countMyList(this.service, actor, { profileId: ctx.profileId }),
    ]);
    return {
      items: page.items.map((item) => cardToItem(item.card)),
      total: counts.visible,
      nextCursor: page.nextCursor,
      hiddenCount: counts.hidden,
    };
  }

  async myListIds(ctx: ViewerContext): Promise<string[]> {
    const refs = await listMyListRefs(this.service, viewerActor(ctx.accountId), {
      profileId: ctx.profileId,
    });
    return refs.map((ref) => `${ref.kind}:${ref.id}`);
  }

  async addToList(ctx: ViewerContext, itemKey: string): Promise<void> {
    await addToMyList(this.service, viewerActor(ctx.accountId), {
      profileId: ctx.profileId,
      target: parseItemKey(itemKey),
    });
  }

  async removeFromList(ctx: ViewerContext, itemKey: string): Promise<void> {
    await removeFromMyList(this.service, viewerActor(ctx.accountId), {
      profileId: ctx.profileId,
      target: parseItemKey(itemKey),
    });
  }

  async continueWatching(
    ctx: ViewerContext,
  ): Promise<Array<{ video: VideoSummary; progress: Progress }>> {
    const items = await continueWatching(this.service, viewerActor(ctx.accountId), {
      profileId: ctx.profileId,
    });
    return items.map((item) => ({
      video: videoCardToSummary(item.video),
      progress: {
        videoId: item.video.id,
        positionSeconds: Math.round(item.positionMs / 1000),
        durationSeconds: Math.round(item.durationMs / 1000),
        updatedAt: item.updatedAt,
      },
    }));
  }

  async removeFromContinue(ctx: ViewerContext, videoId: string): Promise<void> {
    const actor = viewerActor(ctx.accountId);
    const rows = await continueWatching(this.service, actor, { profileId: ctx.profileId });
    const row = rows.find((r) => r.video.id === videoId || r.progressVideoId === videoId);
    if (!row) {
      // Nothing to remove. Still prove the profile is this account's, like every other call.
      await getProgress(this.service, actor, { profileId: ctx.profileId, videoId });
      return;
    }
    const saved = await getProgress(this.service, actor, {
      profileId: ctx.profileId,
      videoId: row.progressVideoId,
    });
    if (saved) {
      stash(
        ctx.profileId,
        videoId,
        { positionMs: saved.positionMs, progressVideoId: row.progressVideoId },
        this.clock(),
      );
    }
    await removeProgress(this.service, actor, {
      profileId: ctx.profileId,
      videoId: row.progressVideoId,
    });
  }

  async restoreContinue(ctx: ViewerContext, videoId: string): Promise<void> {
    const key = `${ctx.profileId}:${videoId}`;
    const entry = removed.get(key);
    if (!entry || entry.expiresAt <= this.clock()) {
      removed.delete(key);
      return;
    }
    await saveProgress(this.service, viewerActor(ctx.accountId), {
      profileId: ctx.profileId,
      videoId: entry.progressVideoId,
      positionMs: entry.positionMs,
      seek: true,
    });
    removed.delete(key);
  }
}
