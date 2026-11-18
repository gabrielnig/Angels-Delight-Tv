import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_ICON_FILES, readBrandIcon } from './brand-icons';

describe('readBrandIcon', () => {
  it('serves the client icon from the brand folder when it exists', async () => {
    const brand = await mkdtemp(join(tmpdir(), 'brand-'));
    const fallback = await mkdtemp(join(tmpdir(), 'fallback-'));
    await writeFile(join(brand, 'icon-192.png'), 'client');
    await writeFile(join(fallback, 'icon-192.png'), 'default');
    const icon = await readBrandIcon('icon-192.png', { brandDir: brand, fallbackDir: fallback });
    expect(icon?.toString()).toBe('client');
  });

  it('falls back to the bundled icon, or to it when no brand folder is set', async () => {
    const fallback = await mkdtemp(join(tmpdir(), 'fallback-'));
    await writeFile(join(fallback, 'icon-512.png'), 'default');
    expect(
      (
        await readBrandIcon('icon-512.png', { brandDir: '/nonexistent', fallbackDir: fallback })
      )?.toString(),
    ).toBe('default');
    expect((await readBrandIcon('icon-512.png', { fallbackDir: fallback }))?.toString()).toBe(
      'default',
    );
  });

  it('only serves the known file names, never a path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brand-'));
    await writeFile(join(dir, 'secret.txt'), 'x');
    expect(await readBrandIcon('../secret.txt', { brandDir: dir, fallbackDir: dir })).toBeNull();
    expect(await readBrandIcon('secret.txt', { brandDir: dir, fallbackDir: dir })).toBeNull();
    expect([...BRAND_ICON_FILES]).toEqual([
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
      'apple-touch-icon.png',
      'favicon-32.png',
      'placeholder-og.png',
    ]);
  });

  it('answers null when neither folder has the file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'empty-'));
    expect(await readBrandIcon('icon-192.png', { brandDir: dir, fallbackDir: dir })).toBeNull();
  });
});
