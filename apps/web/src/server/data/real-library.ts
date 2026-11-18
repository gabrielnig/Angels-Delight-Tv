import {
  addToMyList,
  continueWatching,
  countMyList,
  getProgress,
  listMyList,
  listMyListRefs,
  removeFromMyList,
  removeProgress,
  restoreProgress,
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

/** `video:<uuid>` or `series:<uuid>`. Anything else is a bad request, not a missing title. */
export function parseItemKey(key: string): TitleRef {
  const [kind, id, ...rest] = key.split(':');
  if ((kind !== 'video' && kind !== 'series') || !id || rest.length > 0 || !isUuid(id)) {
    throw new ValidationFailed({ itemKey: ['Not a valid item'] });
  }
  return { kind, id };
}

/** My List, Continue Watching and the undo of a removal on the real viewer services. */
export class RealLibrary implements LibraryRepository {
  constructor(private readonly service: ServiceContext) {}

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
    await removeProgress(this.service, actor, {
      profileId: ctx.profileId,
      videoId: row.progressVideoId,
      requestedId: videoId,
    });
  }

  /** Undo of a removal. The old position is read from the database, so it works on any server and after a restart. */
  async restoreContinue(ctx: ViewerContext, videoId: string): Promise<void> {
    await restoreProgress(this.service, viewerActor(ctx.accountId), {
      profileId: ctx.profileId,
      requestedId: videoId,
    });
  }
}
