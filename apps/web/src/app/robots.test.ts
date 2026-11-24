import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from './robots';

describe('robots.txt (M40-S18)', () => {
  afterEach(() => vi.unstubAllEnvs());

  const rules = () => {
    const out = robots().rules;
    return Array.isArray(out) ? out[0]! : out;
  };

  it('lets crawlers read the public catalog', () => {
    expect(rules().userAgent).toBe('*');
    expect(rules().allow).toBe('/');
  });

  it.each([
    '/api/',
    '/admin',
    '/account',
    '/profiles',
    '/settings',
    '/my-list',
    '/watch/',
    '/search',
    '/sign-in',
    '/sign-up',
    '/verify-email',
  ])('keeps crawlers out of %s', (path) => {
    expect(rules().disallow).toContain(path);
  });

  it('keeps the public pages crawlable', () => {
    const disallow = [rules().disallow].flat();
    for (const open of ['/', '/browse', '/title/', '/series/'])
      expect(disallow).not.toContain(open);
  });

  it('names the sitemap whenever the app has one, with the app origin', () => {
    vi.stubEnv('APP_ORIGIN', 'https://angelsdelight.tv');
    const hasSitemap = existsSync(resolve(__dirname, 'sitemap.ts'));
    if (hasSitemap) expect(robots().sitemap).toBe('https://angelsdelight.tv/sitemap.xml');
    else expect(robots().sitemap).toBeUndefined();
  });
});
