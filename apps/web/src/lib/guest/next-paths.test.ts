import { describe, expect, it } from 'vitest';
import { safeNext } from '../data/fixtures/auth';

describe('pages a guest returns to after signing in', () => {
  it.each([
    '/my-list',
    '/title/how-rain-is-made',
    '/series/science-basics?season=2',
    '/watch/6f1c1a3e-0000-4000-8000-000000000001?t=0',
  ])('keeps %s', (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each(['https://evil.test/', '//evil.test/x', '/\\evil.test', 'javascript:alert(1)', ''])(
    'drops %j',
    (path) => {
      expect(safeNext(path)).toBe('/profiles');
    },
  );
});
