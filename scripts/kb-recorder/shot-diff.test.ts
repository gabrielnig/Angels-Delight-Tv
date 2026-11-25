import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareImages, diffRaw } from './shot-diff';

const rgba = (w: number, h: number, fill: [number, number, number]) => {
  const b = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) b.set([...fill, 255], i * 4);
  return b;
};

describe('diffRaw', () => {
  it('reports no change for identical pictures', () => {
    const a = rgba(10, 10, [200, 200, 200]);
    expect(diffRaw(a, a, 10, 10).ratio).toBe(0);
  });

  it('counts the share of pixels that moved by more than the tolerance', () => {
    const a = rgba(10, 10, [200, 200, 200]);
    const b = Buffer.from(a);
    for (let i = 0; i < 5; i++) b.set([0, 0, 0, 255], i * 4); // 5 of 100 pixels
    expect(diffRaw(a, b, 10, 10).ratio).toBeCloseTo(0.05);
  });

  it('ignores tiny anti aliasing differences under the tolerance', () => {
    const a = rgba(10, 10, [200, 200, 200]);
    const b = rgba(10, 10, [204, 198, 201]);
    expect(diffRaw(a, b, 10, 10, { tolerance: 8 }).ratio).toBe(0);
  });

  it('ignores masked rectangles', () => {
    const a = rgba(10, 10, [200, 200, 200]);
    const b = rgba(10, 10, [0, 0, 0]);
    expect(diffRaw(a, b, 10, 10, { masks: [{ x: 0, y: 0, width: 10, height: 10 }] }).ratio).toBe(0);
    const half = diffRaw(a, b, 10, 10, { masks: [{ x: 0, y: 0, width: 10, height: 5 }] });
    expect(half.ratio).toBeCloseTo(0.5);
  });

  it('returns a diff picture with changed pixels in red', () => {
    const a = rgba(2, 1, [200, 200, 200]);
    const b = Buffer.from(a);
    b.set([0, 0, 0, 255], 0);
    const d = diffRaw(a, b, 2, 1).picture;
    expect([...d.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    expect(d[4]).toBeGreaterThan(150);
  });
});

describe.skipIf(spawnSync('ffmpeg', ['-version']).status !== 0)('compareImages', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-diff-'));
  const make = (name: string, src: string) => {
    const f = join(dir, name);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', src, '-frames:v', '1', '-y', f]);
    return f;
  };

  it('says same for the same picture and writes a diff picture for a changed one', async () => {
    const a = make('a.webp', 'color=c=white:s=200x100');
    const b = make('b.webp', 'color=c=white:s=200x100');
    const c = make('c.webp', 'testsrc=size=200x100:rate=1');
    expect((await compareImages(a, b)).ratio).toBe(0);
    const out = join(dir, 'diff.png');
    const r = await compareImages(a, c, { diffOut: out });
    expect(r.ratio).toBeGreaterThan(0.1);
    expect(existsSync(out)).toBe(true);
  });

  it('flags a different size without comparing pixels', async () => {
    const a = make('s1.webp', 'color=c=white:s=200x100');
    const b = make('s2.webp', 'color=c=white:s=200x120');
    const r = await compareImages(a, b);
    expect(r.sizeChanged).toBe(true);
    expect(r.ratio).toBe(1);
  });
});
