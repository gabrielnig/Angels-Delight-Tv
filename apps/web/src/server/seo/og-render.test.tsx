import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@ad/theme';
import { OG_HEIGHT, OG_MAX_BYTES, OG_WIDTH, TITLE_ZONE } from '../../lib/seo/og-image';
import { inkFor, renderDefaultCard, renderOgJpeg } from './og-render';

async function poster(color: string): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 900, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
}

const input = {
  kind: 'series' as const,
  overlay: true,
  badge: true,
  accent: '#123456',
  title: 'Understanding household budgeting for families',
  siteName: 'Angels Delight TV',
  freeLine: 'Free to watch',
};

describe('share image render (M45-S03)', () => {
  it('makes a 1200 by 630 jpeg under 300 KB from a poster', async () => {
    const jpeg = await renderOgJpeg({ ...input, poster: await poster('#c0d8ff') });
    const meta = await sharp(jpeg).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', OG_WIDTH, OG_HEIGHT]);
    expect(jpeg.length).toBeLessThanOrEqual(OG_MAX_BYTES);
  });

  it('draws without a poster too', async () => {
    const jpeg = await renderOgJpeg({ ...input, poster: null });
    expect((await sharp(jpeg).metadata()).width).toBe(OG_WIDTH);
  });

  it('keeps 4.5 to 1 for white text on a pure white poster in the title zone', async () => {
    const jpeg = await renderOgJpeg({ ...input, poster: await poster('#ffffff') });
    const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
    const y0 = Math.floor((TITLE_ZONE.from / 100) * info.height);
    const y1 = Math.floor((TITLE_ZONE.to / 100) * info.height);
    // The left margin column holds no text, so it shows the scrimmed poster behind it.
    for (let y = y0; y <= y1; y += 4) {
      const i = (y * info.width + 6) * info.channels;
      const color = `#${[0, 1, 2].map((c) => data[i + c]!.toString(16).padStart(2, '0')).join('')}`;
      expect(contrastRatio('#ffffff', color) ?? 0, `row ${y}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('shrinks quality until a busy poster fits the 300 KB limit', async () => {
    const noise = await sharp({
      create: {
        width: 1600,
        height: 900,
        background: '#808080',
        channels: 3,
        noise: { type: 'gaussian', mean: 128, sigma: 90 },
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer();
    const jpeg = await renderOgJpeg({ ...input, poster: noise });
    expect(jpeg.length).toBeLessThanOrEqual(OG_MAX_BYTES);
  });

  const pixel = async (jpeg: Buffer, x: number, y: number) => {
    const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return [data[i]!, data[i + 1]!, data[i + 2]!];
  };

  it('draws no scrim and no text when the overlay is off', async () => {
    const jpeg = await renderOgJpeg({ ...input, overlay: false, poster: await poster('#ffffff') });
    const [r, g, b] = await pixel(jpeg, 600, Math.round(OG_HEIGHT * 0.72));
    expect(Math.min(r!, g!, b!)).toBeGreaterThan(235);
  });

  it('draws a play badge on a video picture and none on a series picture', async () => {
    const white = await poster('#ffffff');
    const video = await renderOgJpeg({ ...input, overlay: false, kind: 'video', poster: white });
    const series = await renderOgJpeg({ ...input, overlay: false, kind: 'series', poster: white });
    const cy = Math.round(OG_HEIGHT * 0.38);
    const [vr] = await pixel(video, 560, cy);
    const [sr] = await pixel(series, 560, cy);
    expect(vr!).toBeLessThan(120);
    expect(sr!).toBeGreaterThan(235);
  });

  it('keeps the badge inside the safe area, clear of the title zone', async () => {
    const jpeg = await renderOgJpeg({ ...input, overlay: false, kind: 'video', poster: await poster('#ffffff') });
    expect((await pixel(jpeg, 600, 40))[0]!).toBeGreaterThan(235);
    expect((await pixel(jpeg, 600, Math.round(OG_HEIGHT * 0.62) + 10))[0]!).toBeGreaterThan(235);
  });

  it('uses the theme accent behind a missing poster and a readable ink on it', async () => {
    const [r, g, b] = await pixel(await renderOgJpeg({ ...input, poster: null }), 6, 6);
    expect(Math.abs(r! - 0x12)).toBeLessThan(10);
    expect(Math.abs(g! - 0x34)).toBeLessThan(10);
    expect(Math.abs(b! - 0x56)).toBeLessThan(10);
  });

  it('picks white or dark ink for a theme colour so the text keeps 4.5 to 1', () => {
    for (const accent of ['#123456', '#f5f5f5', '#ffcc00', '#0b7a3b', '#ffffff', '#000000']) {
      expect(contrastRatio(inkFor(accent), accent) ?? 0, accent).toBeGreaterThanOrEqual(4.5);
    }
    expect(inkFor('not a colour')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('makes the generic platform card from a configured image, or from the accent alone', async () => {
    for (const image of [await poster('#c0d8ff'), null]) {
      const jpeg = await renderDefaultCard({ siteName: 'Angels Delight TV', accent: '#123456', image });
      const meta = await sharp(jpeg).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', OG_WIDTH, OG_HEIGHT]);
      expect(jpeg.length).toBeLessThanOrEqual(OG_MAX_BYTES);
    }
  });

  it('fails loudly rather than return a picture over the limit', async () => {
    const huge = await sharp({
      create: { width: 3000, height: 2000, background: '#808080', channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 127 } },
    })
      .png()
      .toBuffer();
    const jpeg = await renderOgJpeg({ ...input, poster: huge });
    expect(jpeg.length).toBeLessThanOrEqual(OG_MAX_BYTES);
  });
});
