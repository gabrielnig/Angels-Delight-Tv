import { describe, expect, it } from 'vitest';
import { formatBytes, formatEta, formatSpeed } from './format';

describe('upload formatting', () => {
  it('formats sizes and speeds', () => {
    expect(formatBytes(512)).toBe('1 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.5 GB');
    expect(formatSpeed(8.4 * 1024 * 1024)).toBe('8.4 MB/s');
  });
  it('formats time left in rounded plain words', () => {
    expect(formatEta(null)).toBe('Working out time left');
    expect(formatEta(4)).toBe('A few seconds left');
    expect(formatEta(42)).toBe('About 40 seconds left');
    expect(formatEta(125)).toBe('About 2 min left');
    expect(formatEta(3900)).toBe('About 1 h 5 min left');
  });
});
