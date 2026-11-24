import { describe, expect, it } from 'vitest';
import { buildRobots } from './robots-rules';

const rule = (r: ReturnType<typeof buildRobots>) =>
  Array.isArray(r.rules) ? r.rules[0]! : r.rules;

describe('robots rules (M45-S01 AC1, AC4)', () => {
  const live = { origin: 'https://e.test', indexing: true, production: true };

  it('disallows admin, api, account, settings, profiles and watch', () => {
    const disallow = [rule(buildRobots(live)).disallow].flat();
    for (const path of ['/admin', '/api/', '/account', '/settings', '/profiles', '/watch/']) {
      expect(disallow).toContain(path);
    }
  });

  it('also closes sign in, reset, offline and maintenance pages', () => {
    const disallow = [rule(buildRobots(live)).disallow].flat();
    for (const path of [
      '/sign-in',
      '/sign-up',
      '/reset-password',
      '/verify-email',
      '/offline',
      '/maintenance',
      '/unsupported',
      '/search',
    ]) {
      expect(disallow).toContain(path);
    }
  });

  it('points to the sitemap on the configured origin', () => {
    expect(buildRobots(live).sitemap).toBe('https://e.test/sitemap.xml');
  });

  it('blocks everything when indexing is off', () => {
    const out = buildRobots({ ...live, indexing: false });
    expect(rule(out).disallow).toBe('/');
    expect(rule(out).allow).toBeUndefined();
    expect(out.sitemap).toBeUndefined();
  });

  it('blocks everything outside production', () => {
    expect(rule(buildRobots({ ...live, production: false })).disallow).toBe('/');
  });

  it('names no sitemap without an origin', () => {
    expect(buildRobots({ ...live, origin: undefined }).sitemap).toBeUndefined();
  });
});
