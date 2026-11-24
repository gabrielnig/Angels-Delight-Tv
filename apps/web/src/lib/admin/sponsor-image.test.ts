import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SPONSOR_IMAGE_MAX_BYTES, checkSponsorImage } from './sponsor-image';

const png = async (w: number, h: number) =>
  new Uint8Array(await sharp({ create: { width: w, height: h, channels: 3, background: '#2060c0' } }).png().toBuffer());

describe('checkSponsorImage', () => {
  it('accepts a 400 pixel square and a 1200 by 400 wide image', async () => {
    expect((await checkSponsorImage(await png(400, 400), 'square')).ok).toBe(true);
    expect((await checkSponsorImage(await png(1200, 400), 'wide')).ok).toBe(true);
  });

  it('square image under 400 px is rejected with a plain message', async () => {
    const r = await checkSponsorImage(await png(399, 600), 'square');
    expect(!r.ok && r.error).toMatch(/at least 400/);
  });

  it('wide image under 1200 by 400 is rejected', async () => {
    expect((await checkSponsorImage(await png(1199, 800), 'wide')).ok).toBe(false);
    expect((await checkSponsorImage(await png(1500, 399), 'wide')).ok).toBe(false);
  });

  it('image over 2 MB is rejected before it is decoded', async () => {
    const big = new Uint8Array(SPONSOR_IMAGE_MAX_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47]);
    const r = await checkSponsorImage(big, 'square');
    expect(!r.ok && r.error).toMatch(/2 MB/);
  });

  it('refuses files that are not a JPG or PNG, including svg and gif', async () => {
    expect((await checkSponsorImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'square')).ok).toBe(false);
    expect((await checkSponsorImage(new TextEncoder().encode('GIF89a....'), 'square')).ok).toBe(false);
    expect((await checkSponsorImage(new Uint8Array(0), 'square')).ok).toBe(false);
  });
});
