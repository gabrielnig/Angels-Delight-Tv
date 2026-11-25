import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, pngToWebp, webpChunks, webpSize } from './webp';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

describe('webp helpers', () => {
  const riff = (chunks: string[]) => {
    const body = Buffer.concat(
      chunks.map((c) => Buffer.concat([Buffer.from(c), Buffer.alloc(4), Buffer.alloc(0)])),
    );
    return Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), body]);
  };

  it('lists chunk names so metadata chunks can be found', () => {
    expect(webpChunks(riff(['VP8 ']))).toEqual(['VP8 ']);
    expect(webpChunks(riff(['VP8X', 'EXIF', 'VP8 ']))).toEqual(['VP8X', 'EXIF', 'VP8 ']);
  });

  it('refuses a file that is not a WebP', () => {
    expect(() => webpChunks(Buffer.from('not a webp at all'))).toThrow(/WebP/);
  });

  it('budget is 120 KB', () => {
    expect(MAX_IMAGE_BYTES).toBe(120 * 1024);
  });
});

describe.skipIf(!hasFfmpeg)('pngToWebp', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-webp-'));
  const png = join(dir, 'in.png');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=2560x1600:rate=1',
    '-frames:v',
    '1',
    '-y',
    png,
  ]);

  it('scales to the wanted width, stays under the budget and carries no metadata chunk', async () => {
    const out = join(dir, 'out.webp');
    const r = await pngToWebp(png, out, { width: 1280 });
    expect(statSync(out).size).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    expect(r.bytes).toBe(statSync(out).size);
    expect(webpSize(readFileSync(out))).toEqual({ width: 1280, height: 800 });
    const chunks = webpChunks(readFileSync(out));
    expect(chunks.filter((c) => ['EXIF', 'XMP ', 'ICCP'].includes(c))).toEqual([]);
  });

  it('fails clearly when the picture cannot fit the budget', async () => {
    await expect(
      pngToWebp(png, join(dir, 'tiny.webp'), { width: 1280, maxBytes: 200 }),
    ).rejects.toThrow(/budget/);
  });
});
