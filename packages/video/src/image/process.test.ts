import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { IMAGE_PRESETS, ImageRejected, processImage } from './process';

async function source(width: number, height: number, format: 'png' | 'jpeg' = 'png') {
  const img = sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 120, b: 200 } },
  });
  return new Uint8Array(await (format === 'png' ? img.png() : img.jpeg()).toBuffer());
}

describe('processImage', () => {
  it('makes webp and jpeg at every poster width, never wider than the source', async () => {
    const out = await processImage(await source(1000, 600), 'poster');
    const widths = [...new Set(out.variants.map((v) => v.width))].sort((a, b) => a - b);
    expect(widths).toEqual([320, 480, 640, 960]);
    for (const width of widths) {
      expect(out.variants.filter((v) => v.width === width).map((v) => v.format).sort()).toEqual([
        'jpeg',
        'webp',
      ]);
    }
  });

  it('crops posters to 16 by 9 and keeps the real size of every file', async () => {
    const out = await processImage(await source(1200, 1200), 'poster');
    for (const v of out.variants) {
      expect(v.height).toBe(Math.round((v.width * 9) / 16));
      const meta = await sharp(v.bytes).metadata();
      expect(meta.width).toBe(v.width);
      expect(meta.height).toBe(v.height);
      expect(meta.format).toBe(v.format);
    }
  });

  it('makes larger hero variants and small thumbnails from the same code', async () => {
    const hero = await processImage(await source(2600, 1462), 'hero');
    expect(Math.max(...hero.variants.map((v) => v.width))).toBe(1920);
    const thumb = await processImage(await source(1280, 720), 'thumbnail');
    expect(Math.max(...thumb.variants.map((v) => v.width))).toBe(480);
    expect(IMAGE_PRESETS.thumbnail.widths[0]).toBe(160);
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
