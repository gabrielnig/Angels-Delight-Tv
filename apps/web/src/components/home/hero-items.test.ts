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

  it('uses the editor headline, description and button label, falling back to the title text', () => {
    const slot = { item: video(), headline: 'Start here', blurb: 'Five steps', buttonLabel: 'Begin' };
    const [slide] = heroItems({ hero: [slot], rows: [], empty: false }, new Map());
    expect(slide).toMatchObject({ title: 'Start here', description: 'Five steps', playLabel: 'Begin' });
    const [plain] = heroItems(home(video()), new Map());
    expect(plain).toMatchObject({ title: 'One', description: 'About one' });
    expect(plain?.playLabel).toBeUndefined();
    expect(plain?.previewSrc).toBeUndefined();
  });

  it('passes the clip url through', () => {
    const slot = { item: video(), previewUrl: 'https://m.test/cap/a/preview/c.mp4', previewMs: 6000 };
    const [slide] = heroItems({ hero: [slot], rows: [], empty: false }, new Map());
    expect(slide?.previewSrc).toBe('https://m.test/cap/a/preview/c.mp4');
    expect(slide?.previewHasAudio).toBe(false);
  });

  it('passes the clip length and sound flag through', () => {
    const slot = {
      item: video(),
      previewUrl: 'https://m.test/cap/a/preview/c.mp4',
      previewMs: 20_000,
      previewHasAudio: true,
    };
    const [slide] = heroItems({ hero: [slot], rows: [], empty: false }, new Map());
    expect(slide).toMatchObject({ previewMs: 20_000, previewHasAudio: true });
  });
});
