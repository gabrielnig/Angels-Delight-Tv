import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@ad/theme';
import { OG_HEIGHT, OG_MAX_BYTES, OG_WIDTH, TITLE_ZONE } from '../../lib/seo/og-image';
import { renderOgJpeg } from './og-render';

async function poster(color: string): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 900, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
}

const input = {
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
});
