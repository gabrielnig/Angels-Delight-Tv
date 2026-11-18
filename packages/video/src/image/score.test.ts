import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { LOW_FRAME_SCORE } from '@ad/shared';
import { scoreFrame } from './score';

const W = 640;
const H = 360;

async function webp(raw: Buffer, channels: 1 | 3 = 3, blur = 0) {
  let image = sharp(raw, { raw: { width: W, height: H, channels } });
  if (blur > 0) image = image.blur(blur);
  return new Uint8Array(await image.webp({ quality: 85 }).toBuffer());
}

/** Vertical stripes with hard edges: bright, high contrast, sharp. */
function stripes(): Buffer {
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const value = Math.floor(x / 8) % 2 === 0 ? 40 : 210;
      raw.fill(value, (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
  return raw;
}

const flat = (value: number) => Buffer.alloc(W * H * 3, value);

describe('scoreFrame', () => {
  it('scores a sharp, well lit frame high', async () => {
    const score = await scoreFrame(await webp(stripes()));
    expect(score.score).toBeGreaterThan(70);
    expect(score.black).toBe(false);
    expect(score.blurry).toBe(false);
  });

  it('scores a black frame at the bottom and marks it black', async () => {
    const score = await scoreFrame(await webp(flat(0)));
    expect(score.score).toBe(0);
    expect(score.black).toBe(true);
    expect(score.score).toBeLessThan(LOW_FRAME_SCORE);
  });

  it('scores a nearly black frame with a faint pattern low', async () => {
    const dark = stripes().map((v) => (v > 100 ? 18 : 2));
    const score = await scoreFrame(await webp(Buffer.from(dark)));
    expect(score.black).toBe(true);
    expect(score.score).toBeLessThan(LOW_FRAME_SCORE);
  });

  it('scores a blown out white frame low', async () => {
    const score = await scoreFrame(await webp(flat(255)));
    expect(score.score).toBeLessThan(LOW_FRAME_SCORE);
  });

  it('scores a flat grey frame low, because there is nothing to see', async () => {
    const score = await scoreFrame(await webp(flat(128)));
    expect(score.score).toBeLessThan(LOW_FRAME_SCORE);
  });

  it('scores a blurred copy of a frame below the sharp one and marks it blurry', async () => {
    const sharpScore = await scoreFrame(await webp(stripes()));
    const blurred = await scoreFrame(await webp(stripes(), 3, 12));
    expect(blurred.score).toBeLessThan(sharpScore.score);
    expect(blurred.blurry).toBe(true);
    expect(blurred.score).toBeLessThan(LOW_FRAME_SCORE);
  });

  it('keeps every number in range and throws on bytes that are not a picture', async () => {
    const score = await scoreFrame(await webp(stripes()));
    for (const n of [score.score, score.brightness, score.sharpness])
      expect(n >= 0 && n <= 255).toBe(true);
    expect(Number.isInteger(score.score)).toBe(true);
    await expect(scoreFrame(new TextEncoder().encode('fake'))).rejects.toThrow();
  });
});
