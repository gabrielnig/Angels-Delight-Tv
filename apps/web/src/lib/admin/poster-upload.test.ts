import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { checkPosterUpload } from './poster-upload';

const make = async (w: number, h: number, fmt: 'png' | 'jpeg' | 'webp' = 'png') =>
  new Uint8Array(
    await sharp({ create: { width: w, height: h, channels: 3, background: '#445566' } })
      [fmt]()
      .toBuffer(),
  );

describe('checkPosterUpload', () => {
  it('accepts a large enough png or jpeg and reports its type', async () => {
    expect(await checkPosterUpload(await make(1280, 720))).toEqual({
      ok: true,
      mime: 'image/png',
      width: 1280,
      height: 720,
    });
    expect(await checkPosterUpload(await make(1600, 900, 'jpeg'))).toMatchObject({
      ok: true,
      mime: 'image/jpeg',
    });
  });

  it('judges the file by its bytes, not its name or declared type', async () => {
    const out = await checkPosterUpload(await make(1600, 900, 'webp'));
    expect(out).toEqual({ ok: false, error: 'Use a JPG or PNG image.' });
    expect(await checkPosterUpload(new TextEncoder().encode('hello'))).toEqual({
      ok: false,
      error: 'Use a JPG or PNG image.',
    });
  });

  it('refuses small pictures with the real size in the message', async () => {
    const out = await checkPosterUpload(await make(800, 450));
    expect(out).toEqual({
      ok: false,
      error: 'That image is 800 by 450. Use at least 1280 by 720.',
    });
  });

  it('refuses files over 5 MB without decoding them', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set([0x89, 0x50, 0x4e, 0x47]);
    expect(await checkPosterUpload(big)).toEqual({
      ok: false,
      error: 'That image is over 5 MB. Choose a smaller one.',
    });
  });

  it('refuses a damaged picture', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    expect((await checkPosterUpload(bytes)).ok).toBe(false);
  });
});
