import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildBrandKit, iconSvg, wordmarkSvg, BRAND_KIT_FILES } from './kit';

describe('placeholder brand kit', () => {
  it('names every file as a placeholder', () => {
    for (const f of BRAND_KIT_FILES) expect(f).toMatch(/placeholder|icon-|apple-touch|favicon/);
    expect(iconSvg()).toContain('placeholder');
    expect(wordmarkSvg({ name: 'Site' })).toContain('placeholder');
  });

  it('escapes the site name in the wordmark', () => {
    const svg = wordmarkSvg({ name: '<b>&' });
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;&amp;');
  });

  it('builds every file at the right size from one source', async () => {
    const kit = await buildBrandKit({ name: 'Placeholder TV' });
    const names = kit.map((f) => f.name).sort();
    expect(names).toEqual([...BRAND_KIT_FILES].sort());
    const size = async (n: string) => {
      const m = await sharp(kit.find((f) => f.name === n)!.bytes).metadata();
      return `${m.width}x${m.height}`;
    };
    expect(await size('icon-192.png')).toBe('192x192');
    expect(await size('icon-512.png')).toBe('512x512');
    expect(await size('icon-maskable-512.png')).toBe('512x512');
    expect(await size('apple-touch-icon.png')).toBe('180x180');
    expect(await size('favicon-32.png')).toBe('32x32');
    expect(await size('placeholder-og.png')).toBe('1200x630');
    expect(await size('placeholder-email-header.png')).toBe('1200x300');
  });

  it('is deterministic', async () => {
    const a = await buildBrandKit({ name: 'X' });
    const b = await buildBrandKit({ name: 'X' });
    expect(a.map((f) => f.bytes.toString('base64'))).toEqual(b.map((f) => f.bytes.toString('base64')));
  });
});
