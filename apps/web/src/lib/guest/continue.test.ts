import { describe, expect, it } from 'vitest';
import { buildContinueItems, pickContinueEntries } from './continue';

const e = (videoId: string, p: number, f = false, t = 1) => ({ videoId, p, d: 600, f, t });

describe('pickContinueEntries', () => {
  it('keeps started, unfinished videos, newest first, up to the limit', () => {
    const picked = pickContinueEntries(
      [e('a', 100, false, 1), e('b', 3, false, 5), e('c', 590, true, 6), e('d', 50, false, 9)],
      20,
    );
    expect(picked.map((x) => x.videoId)).toEqual(['d', 'a']);
  });

  it('caps at the limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => e(`v${i}`, 60, false, i));
    expect(pickContinueEntries(many, 20)).toHaveLength(20);
  });
});

describe('buildContinueItems', () => {
  const card = (id: string) => ({
    kind: 'video',
    id,
    slug: id,
    title: id,
    description: '',
    durationMs: 600_000,
    kidsSafe: true,
    hasCaptions: false,
    poster: null,
    categorySlug: null,
    categoryName: null,
    publishedAt: null,
  });

  it('joins entries to cards in entry order and drops videos the server no longer shows', () => {
    const items = buildContinueItems([e('a', 100), e('b', 200)], [card('b')] as never);
    expect(items).toHaveLength(1);
    expect(items[0]!.video.id).toBe('b');
    expect(items[0]!.progress).toMatchObject({
      videoId: 'b',
      positionSeconds: 200,
      durationSeconds: 600,
    });
  });
});
