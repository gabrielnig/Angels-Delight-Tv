import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorage } from '@ad/storage';
import { ValidationFailed, Forbidden } from '@ad/shared';
import { LogoUploader, MAX_LOGO_BYTES, MemoryAssetStore, processBrandImage } from './logo';

const actor = { accountId: '0198c000-0000-7000-8000-000000000001', role: 'admin' as const };

const png = (width = 600, height = 200) =>
  sharp({ create: { width, height, channels: 4, background: { r: 31, g: 111, b: 181, alpha: 1 } } })
    .png()
    .toBuffer();

let root: string;
let storage: LocalStorage;
let assets: MemoryAssetStore;
let uploader: LogoUploader;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ad-logo-'));
  storage = new LocalStorage({ root, bucket: 'media', signingSecret: new Uint8Array(32) });
  assets = new MemoryAssetStore();
  uploader = new LogoUploader({ storage, assets });
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('processBrandImage', () => {
  it('re-encodes a png logo to webp at fixed widths without upscaling', async () => {
    const result = await processBrandImage(await png(600, 200), 'logo');
    expect(result.variants.map((variant) => variant.width)).toEqual([160, 320, 600]);
    expect(result.variants.every((variant) => variant.bytes.length > 0)).toBe(true);
    expect(result.width).toBe(600);
    expect(result.height).toBe(200);
    expect((await sharp(result.variants[0]!.bytes).metadata()).format).toBe('webp');
    expect(result.placeholderColor).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('makes square favicon variants', async () => {
    const result = await processBrandImage(await png(300, 100), 'favicon');
    expect(result.variants.map((variant) => [variant.width, variant.height])).toEqual([
      [32, 32],
      [192, 192],
      [512, 512],
    ]);
  });

  it.each([
    ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ['text', Buffer.from('not an image')],
    ['empty', Buffer.alloc(0)],
    ['gif', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'binary')],
    ['html named png', Buffer.from('<html><body>hi</body></html>')],
  ])('rejects %s by content, not by name', async (_name, bytes) => {
    await expect(processBrandImage(bytes, 'logo')).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('rejects files over 500 KB', async () => {
    const big = Buffer.concat([await png(), Buffer.alloc(MAX_LOGO_BYTES)]);
    await expect(processBrandImage(big, 'logo')).rejects.toThrow(/500 KB/);
  });

  it('rejects images that are too small or too large in pixels', async () => {
    await expect(processBrandImage(await png(10, 10), 'logo')).rejects.toBeInstanceOf(
      ValidationFailed,
    );
    await expect(processBrandImage(await png(5000, 100), 'logo')).rejects.toBeInstanceOf(
      ValidationFailed,
    );
  });

  it('rejects animated images', async () => {
    const frame = (background: string) =>
      sharp({ create: { width: 100, height: 100, channels: 4, background } })
        .png()
        .toBuffer();
    const frames = await sharp([await frame('#f00'), await frame('#00f')], {
      join: { animated: true },
    })
      .webp()
      .toBuffer();
    await expect(processBrandImage(frames, 'logo')).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('strips metadata from the output', async () => {
    const withExif = await sharp(await png())
      .withMetadata({ exif: { IFD0: { Copyright: 'secret' } } })
      .jpeg()
      .toBuffer();
    const result = await processBrandImage(withExif, 'logo');
    expect((await sharp(result.variants[0]!.bytes).metadata()).exif).toBeUndefined();
  });
});

describe('LogoUploader', () => {
  it('stores the variants and creates a ready asset row', async () => {
    const asset = await uploader.upload(actor, await png(), {
      purpose: 'logo',
      altText: 'Angels Delight TV logo',
    });
    expect(asset.purpose).toBe('logo');
    expect(asset.status).toBe('ready');
    expect(asset.mime).toBe('image/webp');
    expect(asset.altText).toBe('Angels Delight TV logo');
    expect(asset.variants).toHaveLength(3);
    for (const variant of asset.variants) {
      expect(variant.key).toMatch(
        new RegExp(`^img/${asset.id}/${variant.width}-[0-9a-f]{8}\\.webp$`),
      );
      expect(await storage.head(variant.key)).not.toBeNull();
    }
    expect(assets.rows).toHaveLength(1);
  });

  it('refuses anyone but an admin', async () => {
    await expect(
      uploader.upload({ ...actor, role: 'editor' }, await png(), { purpose: 'logo' }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('removes stored files if the asset row cannot be saved', async () => {
    assets.failNextInsert = true;
    await expect(uploader.upload(actor, await png(), { purpose: 'logo' })).rejects.toThrow();
    expect(await storage.list('img/')).toEqual([]);
  });

  it('rejects alt text over 200 characters', async () => {
    await expect(
      uploader.upload(actor, await png(), { purpose: 'logo', altText: 'x'.repeat(201) }),
    ).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('builds a url for the header logo from the variants', async () => {
    const asset = await uploader.upload(actor, await png(), { purpose: 'logo' });
    expect(LogoUploader.variantKey(asset, 320)).toBe(asset.variants[1]!.key);
    expect(LogoUploader.variantKey(asset, 9999)).toBe(asset.variants.at(-1)!.key);
  });
});
