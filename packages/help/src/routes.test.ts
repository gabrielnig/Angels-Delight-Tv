import { describe, expect, it } from 'vitest';
import { bestScreenMatch, matchScreen } from './routes';

describe('matchScreen', () => {
  it('matches static and dynamic segments', () => {
    expect(matchScreen('/admin/videos/[id]', '/admin/videos/abc')).toBe(true);
    expect(matchScreen('/admin/videos/[id]', '/admin/videos/abc/poster')).toBe(false);
    expect(matchScreen('/admin', '/admin')).toBe(true);
    expect(matchScreen('/admin', '/admin/videos')).toBe(false);
  });
  it('ignores a trailing slash, the query and the hash', () => {
    expect(matchScreen('/admin/videos', '/admin/videos/?q=a#x')).toBe(true);
  });
});

describe('bestScreenMatch', () => {
  const patterns = ['/admin/videos/[id]', '/admin/videos/upload', '/admin/videos'];
  it('prefers static segments over dynamic ones', () => {
    expect(bestScreenMatch(patterns, '/admin/videos/upload')).toBe('/admin/videos/upload');
    expect(bestScreenMatch(patterns, '/admin/videos/xyz')).toBe('/admin/videos/[id]');
    expect(bestScreenMatch(patterns, '/admin/videos')).toBe('/admin/videos');
  });
  it('returns null when nothing matches', () => {
    expect(bestScreenMatch(patterns, '/admin/sponsors')).toBeNull();
  });
});
