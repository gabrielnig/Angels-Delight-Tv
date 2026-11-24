import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { IMAGE_PRESETS, ImageRejected, processImage, sponsorPresetFor } from './process';

async function source(width: number, height: number, format: 'png' | 'jpeg' = 'png') {
  const img = sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 120, b: 200 } },
  });
  return new Uint8Array(await (format === 'png' ? img.png() : img.jpeg()).toBuffer());
}

describe('processImage', () => {
  it('makes avif, webp and jpeg at every poster width, never wider than the source', async () => {
    const out = await processImage(await source(1000, 600), 'poster');
    const widths = [...new Set(out.variants.map((v) => v.width))].sort((a, b) => a - b);
    expect(widths).toEqual([320, 480, 640, 960]);
    for (const width of widths) {
      expect(
        out.variants
          .filter((v) => v.width === width)
          .map((v) => v.format)
          .sort(),
      ).toEqual(['avif', 'jpeg', 'webp']);
    }
  });

  it('crops posters to 16 by 9 and keeps the real size of every file', async () => {
    const out = await processImage(await source(1200, 1200), 'poster');
    for (const v of out.variants) {
      expect(v.height).toBe(Math.round((v.width * 9) / 16));
      const meta = await sharp(v.bytes).metadata();
      expect(meta.width).toBe(v.width);
      expect(meta.height).toBe(v.height);
      // sharp reports an avif file as heif.
      expect(meta.format).toBe(v.format === 'avif' ? 'heif' : v.format);
    }
  });

  it('makes larger hero variants and small thumbnails from the same code', async () => {
    const hero = await processImage(await source(2600, 1462), 'hero');
    expect(Math.max(...hero.variants.map((v) => v.width))).toBe(1920);
    const thumb = await processImage(await source(1280, 720), 'thumbnail');
    expect(Math.max(...thumb.variants.map((v) => v.width))).toBe(480);
    expect(IMAGE_PRESETS.thumbnail.widths[0]).toBe(160);
  });

  it('has the 320, 640 and 960 wide variants the story asks for in every format', async () => {
    const out = await processImage(await source(1400, 800), 'poster');
    for (const format of ['avif', 'webp', 'jpeg'] as const)
      for (const width of [320, 640, 960])
        expect(out.variants.some((v) => v.width === width && v.format === format)).toBe(true);
  });

  it('gives hero art a 320 wide size for Data saver as well', async () => {
    expect(IMAGE_PRESETS.hero.widths[0]).toBe(320);
    const hero = await processImage(await source(2600, 1462), 'hero');
    expect(hero.variants.some((v) => v.width === 320)).toBe(true);
  });

  it('makes a blur placeholder under 1 KB that decodes to a small picture of the same shape', async () => {
    const out = await processImage(await source(1600, 900), 'poster');
    expect(out.placeholderBlur).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
    const bytes = Buffer.from(out.placeholderBlur.split(',')[1]!, 'base64');
    expect(bytes.length).toBeLessThan(1024);
    expect(out.placeholderBlur.length).toBeLessThan(1400);
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width! / meta.height!).toBeCloseTo(16 / 9, 0);
  });

  it('keeps the blur under 1 KB even for a busy picture', async () => {
    const noise = Buffer.alloc(1600 * 900 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 251;
    const busy = new Uint8Array(
      await sharp(noise, { raw: { width: 1600, height: 900, channels: 3 } })
        .png()
        .toBuffer(),
    );
    const out = await processImage(busy, 'poster');
    expect(Buffer.from(out.placeholderBlur.split(',')[1]!, 'base64').length).toBeLessThan(1024);
  });

  it('reports a placeholder colour and the source size', async () => {
    const out = await processImage(await source(800, 450), 'poster');
    expect(out.placeholderColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(out.source).toEqual({ width: 800, height: 450 });
  });

  it('follows the crop focus', async () => {
    const base = await sharp({
      create: { width: 900, height: 900, channels: 3, background: '#ffffff' },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 900, height: 300, channels: 3, background: '#ff0000' },
          })
            .png()
            .toBuffer(),
          top: 600,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
    const meanGreen = async (y: number) => {
      const out = await processImage(new Uint8Array(base), 'poster', { focus: { x: 50, y } });
      const small = out.variants.find((v) => v.width === 320 && v.format === 'jpeg')!;
      return (await sharp(small.bytes).stats()).channels[1]!.mean;
    };
    expect(await meanGreen(0)).toBeGreaterThan(250);
    expect(await meanGreen(100)).toBeLessThan(150);
  });

  it('rejects files that are not images, and absurd sizes', async () => {
    await expect(processImage(new TextEncoder().encode('hello'), 'poster')).rejects.toBeInstanceOf(
      ImageRejected,
    );
    await expect(
      processImage(await source(64, 64), 'poster', { maxPixels: 1000 }),
    ).rejects.toBeInstanceOf(ImageRejected);
  });

  it('refuses sources too small to look right', async () => {
    await expect(processImage(await source(100, 50), 'poster')).rejects.toThrow(/too small/);
  });

  it('strips metadata', async () => {
    const withExif = new Uint8Array(
      await sharp({ create: { width: 800, height: 450, channels: 3, background: '#123456' } })
        .withExif({ IFD0: { Copyright: 'someone' } })
        .jpeg()
        .toBuffer(),
    );
    const out = await processImage(withExif, 'poster');
    const meta = await sharp(out.variants[0]!.bytes).metadata();
    expect(meta.exif).toBeUndefined();
  });
});

describe('processImage full picture preview (M36-S03)', () => {
  it('adds a small preview of the whole picture when the source is not 16 by 9', async () => {
    const out = await processImage(await source(1200, 1200), 'poster');
    expect(out.full).toBeDefined();
    const meta = await sharp(out.full!.bytes).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(out.full!.width);
    expect(out.full!.width / out.full!.height).toBeCloseTo(1, 2);
    expect(out.full!.width).toBeLessThanOrEqual(480);
    expect(out.variants.every((v) => v.width / v.height > 1.7)).toBe(true);
  });
  it('adds none for a 16 by 9 source, whose cut already shows the whole picture', async () => {
    expect((await processImage(await source(1600, 900), 'poster')).full).toBeUndefined();
  });
  it('adds none for a recut, which is never shown in the picker', async () => {
    const out = await processImage(await source(1200, 1200), 'poster', {
      focus: { x: 30, y: 30, zoom: 120 },
    });
    expect(out.full).toBeUndefined();
  });
});

describe('sponsor presets (M48)', () => {
  it('square sponsor images are cropped 1 to 1 with 2x widths for the 72 and 104 pixel slots', async () => {
    const out = await processImage(await source(800, 600), 'sponsor_square');
    const widths = [...new Set(out.variants.map((v) => v.width))].sort((a, b) => a - b);
    expect(widths).toEqual([144, 208, 400]);
    for (const v of out.variants) expect(v.height).toBe(v.width);
  });

  it('wide sponsor images are cropped 3 to 1', async () => {
    const out = await processImage(await source(1500, 700), 'sponsor_wide');
    const widths = [...new Set(out.variants.map((v) => v.width))].sort((a, b) => a - b);
    expect(widths).toEqual([600, 900, 1200]);
    for (const v of out.variants) expect(v.height).toBe(Math.round(v.width / 3));
  });

  it('refuses a square sponsor image under 400 pixels and a wide one under 1200', async () => {
    await expect(processImage(await source(399, 399), 'sponsor_square')).rejects.toBeInstanceOf(ImageRejected);
    await expect(processImage(await source(1199, 500), 'sponsor_wide')).rejects.toBeInstanceOf(ImageRejected);
  });

  it('picks the preset from the shape of the source', () => {
    expect(sponsorPresetFor(1200, 400)).toBe('sponsor_wide');
    expect(sponsorPresetFor(500, 500)).toBe('sponsor_square');
    expect(sponsorPresetFor(900, 600)).toBe('sponsor_square');
  });
});
