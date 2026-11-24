import { eq } from 'drizzle-orm';
import { schema } from '@ad/db';
import {
  categorize,
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedAsset,
  seedCategory,
  seedVideo,
  type ViewerTestDb,
} from '@ad/catalog/testing';
import { FailedEncodeService } from '@ad/video';
import { LocalStorage } from '@ad/storage';
import { Readable } from 'node:stream';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { AdminActor } from '../types';
import { realCollectionService } from './collections';
import { realHomeService } from './home';
import { realVideoService } from './videos';

const failedRoot = mkdtempSync(join(tmpdir(), 'ad-failed-web-'));
const failedStorage = (bucket: string) =>
  new LocalStorage({ root: failedRoot, bucket, signingSecret: new Uint8Array(32).fill(3) });

describe.skipIf(!integrationEnabled())('real admin services over the catalog', () => {
  let t: ViewerTestDb;
  let editor: AdminActor;
  let admin: AdminActor;
  let viewer: AdminActor;
  const queued: Array<{ queue: string; payload: unknown }> = [];
  const stored: string[] = [];
  let failedService: FailedEncodeService;

  beforeAll(async () => {
    t = await createViewerTestDb();
    const e = await seedAccount(t.setup, 'editor');
    const a = await seedAccount(t.setup, 'admin');
    const v = await seedAccount(t.setup, 'viewer');
    editor = { accountId: e.id, role: 'editor', name: 'Ngozi Eze' };
    admin = { accountId: a.id, role: 'admin', name: 'Chiamaka Okafor' };
    viewer = { accountId: v.id, role: 'viewer', name: 'Ada' };
    failedService = new FailedEncodeService({
      db: t.setup,
      originals: failedStorage('originals'),
      media: failedStorage('media'),
    });
    setAdminRuntime({
      db: () => t.app,
      ctx: async () => ({ db: t.app }),
      enqueue: (async (queue: string, payload: unknown) => {
        queued.push({ queue, payload });
        return { jobId: 'job', deduped: false };
      }) as never,
      names: async (_actor, ids) => new Map(ids.map((id) => [id, 'Amina Bello'])),
      originals: () =>
        ({
          put: async (key: string) => void stored.push(key),
          get: async () => Readable.from([Buffer.from('source picture')]),
        }) as never,
      failedEncodes: () => failedService,
    });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await t?.drop();
  });
  beforeEach(() => {
    queued.length = 0;
  });

  describe('videos', () => {
    it('refuses a viewer', async () => {
      await expect(realVideoService.list(viewer, {})).rejects.toThrow();
      await expect(realVideoService.get(viewer, 'x')).rejects.toThrow();
    });

    it('lists with the same filtering and paging as the fixtures, and names the uploader', async () => {
      const cat = await seedCategory(t.setup, 'Listing');
      const mine = await seedVideo(t.setup, { title: 'Zebra facts', createdBy: editor.accountId });
      await categorize(t.setup, { videoId: mine.id }, cat.id);
      await seedVideo(t.setup, { title: 'Aardvark facts' });

      const page = await realVideoService.list(editor, { q: 'facts', sort: 'title', limit: 10 });
      expect(page.items.map((v) => v.title)).toEqual(['Aardvark facts', 'Zebra facts']);
      expect(page.total).toBe(2);
      expect(page.items[1]?.uploadedBy).toBe('Amina Bello');
      const byCat = await realVideoService.list(editor, { categoryId: cat.id });
      expect(byCat.items.map((v) => v.id)).toEqual([mine.id]);
      const small = await realVideoService.list(editor, { q: 'facts', limit: 1 });
      // The cursor is keyset based (names the last row seen), not an offset, so it is opaque. Following it gives the rest.
      expect(small.items).toHaveLength(1);
      expect(small.nextCursor).toEqual(expect.any(String));
      const rest = await realVideoService.list(editor, {
        q: 'facts',
        limit: 1,
        cursor: small.nextCursor!,
      });
      expect(rest.items).toHaveLength(1);
      expect(rest.items[0]!.id).not.toBe(small.items[0]!.id);
    });

    it('edits through the same validation as the fixtures', async () => {
      const video = await seedVideo(t.setup, { publishState: 'draft' });
      await expect(
        realVideoService.update(editor, video.id, { title: '   ' }),
      ).rejects.toMatchObject({ fields: { title: ['Add a title.'] } });
      await expect(
        realVideoService.update(editor, video.id, { categoryIds: ['not-a-category'] }),
      ).rejects.toMatchObject({ fields: { categoryIds: ['Pick categories from the list.'] } });
      const updated = await realVideoService.update(editor, video.id, {
        title: 'Better title',
        tags: ['one', 'two'],
        suitability: 'everyone',
      });
      expect(updated).toMatchObject({
        title: 'Better title',
        tags: ['one', 'two'],
        suitability: 'everyone',
      });
    });

    it('puts a video in a series through an edit', async () => {
      await realCollectionService.createSeries(editor, { title: 'Edit series', description: 'x' });
      const series = (await realCollectionService.seriesList(editor)).find(
        (s) => s.title === 'Edit series',
      )!;
      const video = await seedVideo(t.setup, { publishState: 'draft' });
      const updated = await realVideoService.update(editor, video.id, {
        seriesId: series.id,
        episodeNumber: 3,
      });
      expect(updated).toMatchObject({ seriesId: series.id, seasonNumber: 1, episodeNumber: 3 });
      const detached = await realVideoService.update(editor, video.id, { seriesId: null });
      expect(detached.seriesId).toBeNull();
    });

    it('explains what blocks publishing, checks the schedule time and the override rights', async () => {
      const video = await seedVideo(t.setup, {
        publishState: 'draft',
        description: 'A lesson about rivers.',
      });
      const blocked = await realVideoService.publish(editor, video.id, { mode: 'now' });
      expect(blocked.ok).toBe(false);
      expect(!blocked.ok && blocked.error).toMatch(
        /^Not ready: .*Choose a poster.* still need attention\.$/,
      );

      expect(
        await realVideoService.publish(editor, video.id, {
          mode: 'schedule',
          at: new Date(Date.now() - 1000).toISOString(),
        }),
      ).toEqual({ ok: false, error: 'Pick a time in the future.' });
      expect(
        await realVideoService.publish(editor, video.id, {
          mode: 'now',
          overrideReason: 'No speech in it',
        }),
      ).toEqual({ ok: false, error: 'Only an admin can skip caption approval.' });
      expect(
        await realVideoService.publish(admin, video.id, { mode: 'now', overrideReason: 'no' }),
      ).toEqual({ ok: false, error: 'Say why captions are being skipped, in a few words.' });
    });

    it('publishes with a reason, schedules, and unpublishes', async () => {
      const cat = await seedCategory(t.setup, 'Publishing');
      const poster = await seedAsset(t.setup);
      const video = await seedVideo(t.setup, {
        publishState: 'draft',
        description: 'A lesson about rivers.',
        posterAssetId: poster,
        maturityRank: 0,
      });
      await categorize(t.setup, { videoId: video.id }, cat.id);

      expect(
        await realVideoService.publish(admin, video.id, {
          mode: 'now',
          overrideReason: 'Music only',
        }),
      ).toEqual({ ok: true });
      const published = await realVideoService.get(admin, video.id);
      expect(published).toMatchObject({
        publishState: 'published',
        captionOverrideReason: 'Music only',
      });
      expect(await realVideoService.unpublish(admin, video.id)).toEqual({ ok: true });
      expect(await realVideoService.unpublish(admin, video.id)).toMatchObject({ ok: false });
      const at = new Date(Date.now() + 86_400_000).toISOString();
      expect(
        await realVideoService.publish(admin, video.id, {
          mode: 'schedule',
          at,
          overrideReason: 'Music only',
        }),
      ).toEqual({ ok: true });
      expect((await realVideoService.get(admin, video.id)).publishState).toBe('scheduled');
    });

    it('sets a poster', async () => {
      const video = await seedVideo(t.setup);
      const poster = await seedAsset(t.setup);
      expect(
        await realVideoService.setPoster(editor, video.id, {
          posterId: poster,
          alt: 'Riverbank at dawn',
          focus: { x: 50, y: 40 },
          zoom: 120,
        }),
      ).toEqual({ ok: true });
      expect((await realVideoService.get(editor, video.id)).posterFocus).toEqual({
        x: 50,
        y: 40,
        zoom: 120,
      });
      const invalid = await realVideoService.setPoster(editor, video.id, {
        posterId: poster,
        alt: '',
        focus: { x: 50, y: 40 },
        zoom: 100,
      });
      expect(invalid.ok).toBe(false);
    });

    it('recuts the generated poster files when the saved focus is not the centre (M36-S03)', async () => {
      const video = await seedVideo(t.setup);
      const poster = await seedAsset(t.setup);
      await t.setup
        .update(schema.assets)
        .set({ rawKey: `uploads/${video.id}/${poster}` })
        .where(eq(schema.assets.id, poster));
      stored.length = 0;
      expect(
        await realVideoService.setPoster(editor, video.id, {
          posterId: poster,
          alt: 'Riverbank at dawn',
          focus: { x: 20, y: 40 },
          zoom: 130,
        }),
      ).toEqual({ ok: true });
      expect(stored.filter((key) => key.startsWith(`recuts/${video.id}/`))).toHaveLength(1);
      expect(queued.filter((job) => job.queue === 'image.process')).toHaveLength(1);
    });

    it('stores a custom poster, queues its processing and lists it in the picker', async () => {
      const video = await seedVideo(t.setup, { title: 'With upload' });
      const bytes = new Uint8Array(
        await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#224466' } })
          .png()
          .toBuffer(),
      );
      const refused = await realVideoService.uploadPoster(
        editor,
        video.id,
        new Uint8Array([1, 2, 3]),
      );
      expect(refused).toEqual({ ok: false, error: 'Use a JPG or PNG image.' });
      const done = await realVideoService.uploadPoster(editor, video.id, bytes);
      expect(done.ok).toBe(true);
      if (!done.ok) return;
      expect(stored.at(-1)).toBe(`uploads/${video.id}/${done.assetId}`);
      expect(queued).toEqual([{ queue: 'image.process', payload: { assetId: done.assetId } }]);
      expect(await realVideoService.posterStatus(editor, done.assetId)).toEqual({
        status: 'processing',
      });
      const list = await realVideoService.posterAssets(editor, video.id);
      expect(list).toEqual([
        {
          id: done.assetId,
          source: 'upload',
          label: 'Your image',
          status: 'processing',
          url: null,
          score: null,
          previewRatio: 16 / 9,
        },
      ]);
      await expect(realVideoService.uploadPoster(viewer, video.id, bytes)).rejects.toThrow();
    });

    it('lists failed encodes with technical detail for admins only, and cleans them up', async () => {
      const failed = await seedVideo(t.setup, {
        status: 'failed',
        publishState: 'draft',
        originalKey: 'originals/f/source.mp4',
        failureCode: 'encode_failed',
        failureMessage: 'The video could not be converted. Try exporting it again.',
      });
      await t.setup.insert(schema.jobs).values({
        queue: 'video.encode',
        videoId: failed.id,
        status: 'failed',
        errorDetail: 'ffmpeg exited with 1',
        attempts: 3,
      });
      const asAdmin = (await realVideoService.failedEncodes(admin)).find(
        (r) => r.videoId === failed.id,
      )!;
      expect(asAdmin).toMatchObject({
        technical: 'ffmpeg exited with 1',
        attempts: 3,
        canRetry: true,
      });
      const asEditor = (await realVideoService.failedEncodes(editor)).find(
        (r) => r.videoId === failed.id,
      )!;
      expect(asEditor.technical).toBeNull();
      await expect(realVideoService.failedEncodes(viewer)).rejects.toThrow();
      expect(await realVideoService.cleanupFailed(editor, failed.id)).toMatchObject({
        ok: true,
        videos: 1,
      });
      const ready = await seedVideo(t.setup, { title: 'Fine' });
      expect(await realVideoService.cleanupFailed(editor, ready.id)).toEqual({
        ok: false,
        error: 'Only a failed video can be cleaned up.',
      });
    });

    it('moves to Trash, restores, and queues a purge only for an admin', async () => {
      const video = await seedVideo(t.setup, { title: 'To purge' });
      const denied = await realVideoService.bulk(editor, [video.id], { type: 'trash' });
      expect(denied.failed).toHaveLength(1);
      const done = await realVideoService.bulk(admin, [video.id], { type: 'trash' });
      expect(done.succeeded).toEqual([video.id]);
      expect((await realVideoService.trashed(editor)).map((v) => v.id)).toContain(video.id);
      expect(await realVideoService.purge(editor, video.id)).toEqual({
        ok: false,
        error: 'Only an admin can delete forever.',
      });
      expect(await realVideoService.restore(editor, video.id)).toEqual({ ok: true });
      await realVideoService.bulk(admin, [video.id], { type: 'trash' });
      expect(await realVideoService.purge(admin, video.id)).toEqual({ ok: true });
      expect(queued).toEqual([{ queue: 'video.purge', payload: { videoId: video.id } }]);
    });

    it('retries a failed video and shows the encoding queue', async () => {
      const failed = await seedVideo(t.setup, {
        status: 'failed',
        publishState: 'draft',
        originalKey: 'originals/a/source.mp4',
        failureMessage: 'Damaged file.',
      });
      const encoding = await seedVideo(t.setup, { status: 'encoding', publishState: 'draft' });
      await seedVideo(t.setup, { title: 'Ready one' });
      const queue = (await realVideoService.encodingQueue(editor)).map((v) => v.id);
      expect(queue).toEqual(expect.arrayContaining([failed.id, encoding.id]));
      expect(queue.every((id) => id !== undefined)).toBe(true);
      expect(await realVideoService.retryEncode(editor, failed.id)).toEqual({ ok: true });
      expect(queued[0]).toMatchObject({ queue: 'video.encode' });
      expect(
        (await t.setup.select().from(schema.videos).where(eq(schema.videos.id, failed.id)))[0]
          ?.status,
      ).toBe('uploaded');
    });

    it('has no screen made upload', async () => {
      await expect(
        realVideoService.createFromUpload(editor, { name: 'x.mp4', sizeBytes: 1 }),
      ).rejects.toThrow();
    });
  });

  describe('collections and home', () => {
    it('manages categories with the same messages', async () => {
      expect(await realCollectionService.createCategory(editor, 'Real cat')).toEqual({ ok: true });
      expect(await realCollectionService.createCategory(editor, 'real CAT')).toEqual({
        ok: false,
        error: 'A category with that name already exists.',
      });
      const list = await realCollectionService.categories(editor);
      expect(list.find((c) => c.name === 'Real cat')).toMatchObject({
        hidden: false,
        videoCount: 0,
      });
      await expect(realCollectionService.categories(viewer)).rejects.toThrow();
    });

    it('returns series detail without the episode count and with named uploaders', async () => {
      await realCollectionService.createSeries(editor, {
        title: 'Detail series',
        description: 'd',
      });
      const series = (await realCollectionService.seriesList(editor)).find(
        (s) => s.title === 'Detail series',
      )!;
      const v = await seedVideo(t.setup, { createdBy: editor.accountId });
      await realCollectionService.setEpisode(editor, v.id, series.id, 1, 1);
      const detail = await realCollectionService.seriesDetail(editor, series.id);
      expect(detail.series).not.toHaveProperty('episodeCount');
      expect(detail.episodes[0]).toMatchObject({ id: v.id, uploadedBy: 'Amina Bello' });
    });

    it('turns a series publish failure into a plain message', async () => {
      await realCollectionService.createSeries(editor, { title: 'Needs more', description: '' });
      const series = (await realCollectionService.seriesList(editor)).find(
        (s) => s.title === 'Needs more',
      )!;
      expect(
        await realCollectionService.updateSeries(editor, series.id, { published: true }),
      ).toEqual({
        ok: false,
        error: 'Publish at least one episode before publishing the series.',
      });
    });

    it('serves the home editor with videos, series and categories, and publishes', async () => {
      const data = await realHomeService.get(editor);
      expect(data.state.published.rows.length).toBeGreaterThan(0);
      expect(data.videos.length).toBeGreaterThan(0);
      expect(data.categories.length).toBeGreaterThan(0);
      const config = { heroIds: [data.videos[0]!.id], rows: data.state.draft.rows.slice(0, 2) };
      expect(await realHomeService.publish(editor, config)).toEqual({ ok: true });
      expect((await realHomeService.get(editor)).state.published.heroIds).toEqual(config.heroIds);
      expect(await realHomeService.restorePrevious(editor)).toEqual({ ok: true });
      await expect(realHomeService.get(viewer)).rejects.toThrow();
    });
  });
});
