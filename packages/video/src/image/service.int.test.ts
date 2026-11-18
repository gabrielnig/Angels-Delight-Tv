import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { uuidv7 } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PipelineError } from '../failure';
import { ImageService } from './service';

const secret = new Uint8Array(32).fill(9);

describe.skipIf(!integrationEnabled())('ImageService against Postgres and local storage', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let service: ImageService;
  let owner: string;

  const picture = async (width = 1600, height = 900) =>
    new Uint8Array(
      await sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
        .png()
        .toBuffer(),
    );

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-image-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    service = new ImageService({ db: t.db, originals, media });
    const account = makeAccount({ role: 'editor' });
    await t.db.insert(schema.accounts).values(account);
    owner = account.id;
  });

  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  async function newAsset(purpose: 'thumbnail' | 'hero', bytes: Uint8Array | null) {
    const id = uuidv7();
    const rawKey = `images/${id}/source`;
    if (bytes) await originals.put(rawKey, bytes);
    await t.db.insert(schema.assets).values({
      id,
      purpose,
      status: 'processing',
      rawKey,
      mime: 'image/png',
      createdBy: owner,
    });
    return id;
  }
  const load = async (id: string) =>
    (await t.db.select().from(schema.assets).where(eq(schema.assets.id, id)))[0]!;

  it('stores avif, webp and jpeg variants in the media bucket and marks the asset ready', async () => {
    const id = await newAsset('thumbnail', await picture());
    await service.process(id);
    const asset = await load(id);
    expect(asset.status).toBe('ready');
    expect(asset.mime).toBe('image/webp');
    expect(asset.mediaKeyBase).toBe(`img/${id}/`);
    expect(asset.placeholderColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(asset.width).toBe(1600);
    const formats = new Set(asset.variants.map((v) => v.format));
    expect(formats).toEqual(new Set(['avif', 'webp', 'jpeg']));
    expect(asset.placeholderBlur).toMatch(/^data:image\/webp;base64,/);
    expect(asset.placeholderBlur!.length).toBeLessThan(1024);
    for (const variant of asset.variants.filter((v) => v.format === 'avif'))
      expect(variant.key.endsWith('.avif')).toBe(true);
    for (const variant of asset.variants) {
      expect(variant.key.startsWith(`img/${id}/${variant.width}-`)).toBe(true);
      expect((await media.head(variant.key))?.bytes).toBe(variant.bytes);
    }
  });

  it('uses the hero widths for hero art', async () => {
    const id = await newAsset('hero', await picture(2400, 1350));
    await service.process(id);
    const widths = (await load(id)).variants.map((v) => v.width);
    expect(Math.max(...widths)).toBe(1920);
  });

  it('is a no-op for an asset that is already ready', async () => {
    const id = await newAsset('thumbnail', await picture());
    await service.process(id);
    const first = (await load(id)).variants;
    await originals.delete(`images/${id}/source`);
    await service.process(id);
    expect((await load(id)).variants).toEqual(first);
  });

  it('fails permanently on a file that is not a picture and marks the asset failed', async () => {
    const id = await newAsset('thumbnail', new TextEncoder().encode('not a picture'));
    const error = await service.process(id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PipelineError);
    expect(error as PipelineError).toMatchObject({ code: 'bad_image', permanent: true });
    expect((await load(id)).status).toBe('failed');
  });

  it('fails permanently when the source object is missing', async () => {
    const id = await newAsset('thumbnail', null);
    const error = await service.process(id).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'upload_incomplete', permanent: true });
  });

  it('removes every stored file of an asset', async () => {
    const id = await newAsset('thumbnail', await picture());
    await service.process(id);
    expect((await media.list(`img/${id}/`)).length).toBeGreaterThan(0);
    await service.remove(id);
    expect(await media.list(`img/${id}/`)).toHaveLength(0);
    expect(await originals.head(`images/${id}/source`)).toBeNull();
  });

  describe('recut around a saved focus point (M36-S03)', () => {
    /** Left half red, right half blue, so the crop position is easy to read back from the pixels. */
    const split = async () =>
      new Uint8Array(
        await sharp({
          create: { width: 1600, height: 900, channels: 3, background: '#cc0000' },
        })
          .composite([
            {
              input: await sharp({
                create: { width: 800, height: 900, channels: 3, background: '#0000cc' },
              })
                .png()
                .toBuffer(),
              left: 800,
              top: 0,
            },
          ])
          .png()
          .toBuffer(),
      );
    const readAll = async (key: string) => {
      const chunks: Buffer[] = [];
      for await (const chunk of await media.get(key)) chunks.push(Buffer.from(chunk as Buffer));
      return Buffer.concat(chunks);
    };
    /** Colour of the left edge of the picture: red for the whole frame, blue once cropped to the right side. */
    const leftEdge = async (key: string) => {
      const meta = await sharp(await readAll(key)).metadata();
      const bytes = await sharp(await readAll(key))
        .extract({ left: 0, top: 0, width: Math.floor(meta.width! / 10), height: meta.height! })
        .resize(1, 1)
        .raw()
        .toBuffer();
      return { r: bytes[0]!, b: bytes[2]! };
    };
    const jpegKey = (asset: Awaited<ReturnType<typeof load>>) =>
      asset.variants.filter((v) => v.format === 'jpeg').sort((a, b) => a.width - b.width)[0]!.key;

    async function seedCut(focus: { x: number; y: number; zoom: number }) {
      const source = await newAsset('thumbnail', await split());
      await service.process(source);
      const video = makeVideo({ posterAssetId: source, posterFocus: focus });
      await t.db.insert(schema.videos).values(video);
      const cut = uuidv7();
      const rawKey = `recuts/${video.id}/${cut}`;
      await originals.put(rawKey, await split());
      await t.db.insert(schema.assets).values({
        id: cut,
        purpose: 'thumbnail',
        status: 'processing',
        rawKey,
        mime: 'image/png',
        cutFrom: source,
        cutFocus: focus,
        createdBy: owner,
      });
      return { source, cut, video };
    }

    it('crops the generated files around the focus point and not the centre', async () => {
      const { source, cut } = await seedCut({ x: 90, y: 50, zoom: 200 });
      await service.process(cut);
      const recut = await load(cut);
      expect(recut.status).toBe('ready');
      const colour = await leftEdge(jpegKey(recut));
      expect(colour.b).toBeGreaterThan(150);
      expect(colour.r).toBeLessThan(60);
      const plain = await leftEdge(jpegKey(await load(source)));
      expect(plain.r).toBeGreaterThan(150);
    });

    it('points the video at the recut once it is ready, and only while the saved focus still matches', async () => {
      const { cut, video, source } = await seedCut({ x: 90, y: 50, zoom: 200 });
      await service.process(cut);
      const after = (
        await t.db.select().from(schema.videos).where(eq(schema.videos.id, video.id))
      )[0]!;
      expect(after.posterAssetId).toBe(cut);

      const second = await seedCut({ x: 10, y: 50, zoom: 200 });
      await t.db
        .update(schema.videos)
        .set({ posterFocus: { x: 50, y: 50, zoom: 100 } })
        .where(eq(schema.videos.id, second.video.id));
      await service.process(second.cut);
      const kept = (
        await t.db.select().from(schema.videos).where(eq(schema.videos.id, second.video.id))
      )[0]!;
      expect(kept.posterAssetId).toBe(second.source);
      expect(source).not.toBe(cut);
    });

    it('removes an older recut of the same picture that no video uses any more', async () => {
      const first = await seedCut({ x: 90, y: 50, zoom: 200 });
      await service.process(first.cut);
      const older = (await load(first.cut)).variants.map((v) => v.key);
      const newer = uuidv7();
      const rawKey = `recuts/${first.video.id}/${newer}`;
      await originals.put(rawKey, await split());
      await t.db.insert(schema.assets).values({
        id: newer,
        purpose: 'thumbnail',
        status: 'processing',
        rawKey,
        mime: 'image/png',
        cutFrom: first.source,
        cutFocus: { x: 20, y: 50, zoom: 200 },
        createdBy: owner,
      });
      await t.db
        .update(schema.videos)
        .set({ posterFocus: { x: 20, y: 50, zoom: 200 } })
        .where(eq(schema.videos.id, first.video.id));
      await service.process(newer);
      expect(
        await t.db.select().from(schema.assets).where(eq(schema.assets.id, first.cut)),
      ).toHaveLength(0);
      for (const key of older) expect(await media.head(key)).toBeNull();
      expect(
        (await t.db.select().from(schema.videos).where(eq(schema.videos.id, first.video.id)))[0]!
          .posterAssetId,
      ).toBe(newer);
    });
  });
});
