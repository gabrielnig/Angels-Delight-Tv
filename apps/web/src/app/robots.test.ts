import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ indexing: true }));
vi.mock('../server/seo/seo-settings', () => ({
  getSeoSettings: async () => ({ indexing: mocks.indexing }),
}));

import robots from './robots';

describe('robots.txt (M40-S18, M45-S01)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.indexing = true;
  });

  const rules = async () => {
    const out = (await robots()).rules;
    return Array.isArray(out) ? out[0]! : out;
  };

  it('lets crawlers read the public catalog in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const r = await rules();
    expect(r.userAgent).toBe('*');
    expect(r.allow).toBe('/');
    const disallow = [r.disallow].flat();
    for (const open of ['/', '/browse', '/title/', '/series/'])
      expect(disallow).not.toContain(open);
    for (const closed of ['/admin', '/api/', '/watch/', '/search'])
      expect(disallow).toContain(closed);
  });

  it('names the sitemap on the configured origin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ORIGIN', 'https://angelsdelight.tv');
    expect((await robots()).sitemap).toBe('https://angelsdelight.tv/sitemap.xml');
  });

  it('blocks everything when the Discovery tab turns indexing off', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mocks.indexing = false;
    expect((await rules()).disallow).toBe('/');
  });

  it('blocks everything outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect((await rules()).disallow).toBe('/');
  });
});
