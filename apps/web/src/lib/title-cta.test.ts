import { describe, expect, it } from 'vitest';
import { primaryAction } from './title-cta';

describe('primaryAction', () => {
  it('says Play for a title nobody started', () => {
    expect(primaryAction({ label: 'play', startSeconds: 0, watchHref: '/watch/a' })).toEqual({
      text: 'Play',
      href: '/watch/a',
      startOverHref: undefined,
    });
  });

  it('says Resume from the start point and offers Start over', () => {
    expect(primaryAction({ label: 'resume', startSeconds: 134, watchHref: '/watch/a' })).toEqual({
      text: 'Resume from 2:14',
      href: '/watch/a',
      startOverHref: '/watch/a?t=0',
    });
  });

  it('says Watch again for a finished title and starts at zero', () => {
    expect(primaryAction({ label: 'watch_again', startSeconds: 0, watchHref: '/watch/a' })).toEqual({
      text: 'Watch again',
      href: '/watch/a?t=0',
      startOverHref: undefined,
    });
  });

  it('names the episode for a series', () => {
    const base = { watchHref: '/watch/e', episode: { season: 1, number: 3 } };
    expect(primaryAction({ ...base, label: 'resume', startSeconds: 60 }).text).toBe('Resume S1 E3');
    expect(primaryAction({ ...base, label: 'play', startSeconds: 0 }).text).toBe('Play S1 E3');
    expect(primaryAction({ ...base, label: 'watch_again', startSeconds: 0 }).text).toBe(
      'Watch again S1 E3',
    );
  });
});
