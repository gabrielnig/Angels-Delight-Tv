import 'server-only';
import {
  bulkAdminVideos,
  setCaptionsAvailability,
  createPosterUpload,
  getPosterAssetStatus,
  listPosterAssets,
  getAdminVideo,
  listAdminCategories,
  listAdminSeries,
  listAdminVideos,
  listAdminVideosPage,
  publish,
  restoreAdminVideo,
  requestPurgeAdminVideo,
  retryAdminVideo,
  setAdminEpisode,
  setAdminPoster,
  unpublish,
  updateAdminVideo,
} from '@ad/catalog';
import { Conflict, Forbidden, NotFound, ValidationFailed, isAdminRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import { checkPosterUpload } from '@/lib/admin/poster-upload';
import { validatePosterChoice } from '@/lib/admin/poster-rules';
import type { VideoService } from '../services';
import { validateVideoPatch } from '../video-commands';
import { adminRuntime } from '@/server/admin/runtime';
import { asResult, catalogActor, context, need, toRecord, toRecords } from './shared';

export const realVideoService: VideoService = {
  async list(actor, query) {
    need(actor, 'admin.access');
    const page = await listAdminVideosPage(await context(), catalogActor(actor), query);
    return { ...page, items: await toRecords(actor, page.items) };
  },
  async get(actor, id) {
    need(actor, 'admin.access');
    return toRecord(actor, await getAdminVideo(await context(), catalogActor(actor), id));
  },
  async categories(actor) {
    need(actor, 'admin.access');
    return (await listAdminCategories(await context(), catalogActor(actor))).map(
      ({ id, name, hidden, position }) => ({ id, name, hidden, position }),
    );
  },
  async seriesOptions(actor) {
    need(actor, 'admin.access');
    return (await listAdminSeries(await context(), catalogActor(actor))).map(
      ({ id, title, description, posterId, published }) => ({
        id,
        title,
        description,
        posterId,
        published,
      }),
    );
  },
  async update(actor, id, patch) {
    need(actor, 'video.edit');
    const ctx = await context();
    const who = catalogActor(actor);
    const categories = await listAdminCategories(ctx, who);
    const result = validateVideoPatch(patch, new Set(categories.map((c) => c.id)));
    if (!result.ok)
      throw new ValidationFailed(
        Object.fromEntries(Object.entries(result.errors).map(([k, v]) => [k, [v]])),
      );
    const { seriesId, episodeNumber, ...details } = result.value;
    const current = await getAdminVideo(ctx, who, id);
    if (seriesId !== undefined || episodeNumber !== undefined) {
      const nextSeries = seriesId !== undefined ? seriesId : current.seriesId;
      const moved = await setAdminEpisode(
        ctx,
        who,
        id,
        nextSeries,
        nextSeries ? (current.seasonNumber ?? 1) : null,
        nextSeries ? (episodeNumber !== undefined ? episodeNumber : current.episodeNumber) : null,
      );
      if (!moved.ok) throw new ValidationFailed({ episodeNumber: [moved.error] });
    }
    return toRecord(actor, await updateAdminVideo(ctx, who, id, details));
  },
  async bulk(actor, ids, action, bulkId) {
    need(actor, 'admin.access');
    return bulkAdminVideos(await context(), catalogActor(actor), ids, action, bulkId);
  },
  async publish(actor, id, request) {
    if (!can(actor.role, 'video.publish'))
      return { ok: false, error: 'You do not have permission to publish.' };
    const ctx = await context();
    let publishAt: Date | undefined;
    if (request.mode === 'schedule') {
      const at = Date.parse(request.at ?? '');
      if (!Number.isFinite(at) || at <= Date.now())
        return { ok: false, error: 'Pick a time in the future.' };
      publishAt = new Date(at);
    }
    let captionOverride: { reason: string } | undefined;
    if (request.overrideReason !== undefined) {
      const reason = request.overrideReason.trim();
      if (!can(actor.role, 'caption.override'))
        return { ok: false, error: 'Only an admin can skip caption approval.' };
      if (reason.length < 5)
        return { ok: false, error: 'Say why captions are being skipped, in a few words.' };
      captionOverride = { reason };
    }
    try {
      await publish(ctx, catalogActor(actor), 'video', id, { publishAt, captionOverride });
      return { ok: true };
    } catch (error) {
      if (error instanceof ValidationFailed) {
        const missing = error.fields.checklist;
        if (missing?.length)
          return { ok: false, error: `Not ready: ${missing.join(', ')} still need attention.` };
        return { ok: false, error: Object.values(error.fields)[0]?.[0] ?? 'Check the details.' };
      }
      if (error instanceof NotFound) throw error;
      if (error instanceof Forbidden) return { ok: false, error: error.message };
      throw error;
    }
  },
  async unpublish(actor, id) {
    need(actor, 'video.publish');
    try {
      await unpublish(await context(), catalogActor(actor), 'video', id);
      return { ok: true };
    } catch (error) {
      if (error instanceof Conflict) return { ok: false, error: error.message };
      throw error;
    }
  },
  async setCaptionsAvailability(actor, id, value, reason) {
    need(actor, 'caption.availability');
    return asResult(async () =>
      setCaptionsAvailability(await context(), catalogActor(actor), id, value, reason),
    );
  },
  async setPoster(actor, id, choice) {
    need(actor, 'video.edit');
    const errors = validatePosterChoice(choice);
    if (Object.keys(errors).length) return { ok: false, error: Object.values(errors)[0]! };
    const runtime = adminRuntime();
    return setAdminPoster(await context(), catalogActor(actor), id, {
      posterId: choice.posterId,
      alt: choice.alt,
      focus: { x: choice.focus.x, y: choice.focus.y },
      zoom: choice.zoom,
      // A saved focus point recuts the generated files, so the viewer crop matches the admin preview (M36-S03).
      recut: {
        copySource: async (from, to) => {
          const originals = runtime.originals();
          const chunks: Buffer[] = [];
          for await (const chunk of await originals.get(from))
            chunks.push(Buffer.from(chunk as Buffer));
          await originals.put(to, new Uint8Array(Buffer.concat(chunks)), {
            contentType: 'application/octet-stream',
          });
        },
        enqueue: (queue, payload) =>
          runtime.enqueue(queue, payload, { createdBy: actor.accountId }),
      },
    });
  },
  async posterAssets(actor, id) {
    need(actor, 'video.edit');
    const runtime = adminRuntime();
    return listPosterAssets(await context(), catalogActor(actor), id, runtime.mediaOrigin());
  },
  async uploadPoster(actor, id, bytes) {
    need(actor, 'video.edit');
    const check = await checkPosterUpload(bytes);
    if (!check.ok) return check;
    const runtime = adminRuntime();
    return createPosterUpload(await context(), catalogActor(actor), id, {
      mime: check.mime,
      bytes: bytes.length,
      store: (key) => runtime.originals().put(key, bytes, { contentType: check.mime }),
      enqueue: (queue, payload) => runtime.enqueue(queue, payload, { createdBy: actor.accountId }),
    });
  },
  async posterStatus(actor, assetId) {
    need(actor, 'video.edit');
    return getPosterAssetStatus(await context(), catalogActor(actor), assetId);
  },
  async retryEncode(actor, id) {
    need(actor, 'video.edit');
    return retryAdminVideo(await context(), catalogActor(actor), id, adminRuntime().enqueue);
  },
  async trashed(actor) {
    need(actor, 'video.restore');
    return toRecords(
      actor,
      await listAdminVideos(await context(), catalogActor(actor), { trashed: true }),
    );
  },
  async restore(actor, id) {
    if (!can(actor.role, 'video.restore'))
      return { ok: false, error: 'You do not have permission to restore videos.' };
    return restoreAdminVideo(await context(), catalogActor(actor), id);
  },
  async purge(actor, id) {
    if (!can(actor.role, 'video.purge'))
      return { ok: false, error: 'Only an admin can delete forever.' };
    const ctx = await context();
    return asResult(() =>
      requestPurgeAdminVideo(ctx, catalogActor(actor), id, adminRuntime().enqueue),
    );
  },
  async createFromUpload() {
    // Real uploads create their own draft video through the upload API (lane D), never from the screen.
    throw new Forbidden('Uploads are created by the upload service.');
  },
  async failedEncodes(actor) {
    need(actor, 'video.edit');
    const rows = await adminRuntime().failedEncodes().list();
    return rows.map(({ failedAt, leftover, technical, ...row }) => ({
      ...row,
      failedAt: failedAt.toISOString(),
      // Technical detail is for the developer and admins only (M14-S06, never shown to editors).
      technical: isAdminRole(actor.role) ? technical : null,
      leftoverFiles: leftover.files,
      leftoverBytes: leftover.bytes,
    }));
  },
  async cleanupFailed(actor, id) {
    need(actor, 'video.edit');
    try {
      const out = await adminRuntime().failedEncodes().cleanup(id);
      return { ok: true, videos: 1, ...out };
    } catch (error) {
      if (error instanceof Conflict) return { ok: false, error: error.message };
      throw error;
    }
  },
  async cleanupAllFailed(actor) {
    need(actor, 'video.edit');
    return { ok: true, ...(await adminRuntime().failedEncodes().cleanupAll()) };
  },
  async encodingQueue(actor) {
    need(actor, 'video.edit');
    const all = await listAdminVideos(await context(), catalogActor(actor));
    return toRecords(
      actor,
      all.filter((v) => ['uploaded', 'validating', 'encoding', 'failed'].includes(v.status)),
    );
  },
};
