import { describe, expect, it } from 'vitest';
import type { HomeData, VideoSummary } from '../../lib/data';
import { heroItems } from './hero-items';

const video = (overrides: Partial<VideoSummary> = {}): VideoSummary => ({
  kind: 'video',
  id: 'v1',
  slug: 'one',
  title: 'One',
  description: 'About one',
  durationSeconds: 300,
  categorySlug: 'health',
  categoryName: 'Health',
  hasCaptions: false,
  kidsSafe: true,
  publishedAt: '',
  ...overrides,
});

const home = (item: VideoSummary): HomeData => ({ hero: [{ item }], rows: [], empty: false });

describe('heroItems', () => {
  it('draws the wide artwork from the item thumbnail', () => {
    const [slide] = heroItems(
      home(
        video({
          thumbnail: {
            src: '/a-960.webp',
            srcSet: '/a-640.webp 640w, /a-960.webp 960w',
            alt: 'Banner text',
          },
        }),
      ),
      new Map(),
    );
    expect(slide?.image).toEqual({
      src: '/a-960.webp',
      srcSet: '/a-640.webp 640w, /a-960.webp 960w',
      alt: 'Banner text',
    });
  });

  it('treats artwork without alt text as decorative', () => {
    const [slide] = heroItems(home(video({ thumbnail: { src: '/a.webp' } })), new Map());
    expect(slide?.image?.alt).toBe('');
  });

  it('leaves the image out when there is no artwork', () => {
    const [slide] = heroItems(home(video()), new Map());
    expect(slide?.image).toBeUndefined();
  });
});
