import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
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
});
