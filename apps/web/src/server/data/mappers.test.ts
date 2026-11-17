import { describe, expect, it } from 'vitest';
import type { TitleCardDto } from '@ad/viewer';
import {
  avatarFromTone,
  cardToItem,
  durationBucketOf,
  profileToView,
  toneFromAvatar,
  toThumb,
} from './mappers';

const poster = {
  id: 'a1',
  alt: 'River',
  placeholderColor: '#abc',
  width: 1280,
  height: 720,
  variants: [
    { width: 320, height: 180, url: 'https://m.test/320.webp' },
    { width: 640, height: 360, url: 'https://m.test/640.webp' },
    { width: 1280, height: 720, url: 'https://m.test/1280.webp' },
  ],
};

const videoCard = (over: Partial<TitleCardDto> = {}): TitleCardDto => ({
  kind: 'video',
  id: 'v-1',
  slug: 'rivers',
  title: 'Rivers',
  description: null,
  durationMs: 125_400,
  episodeCount: null,
  kidsSafe: true,
  hasCaptions: true,
  poster,
  progress: null,
  inMyList: false,
  ...over,
});

describe('toThumb', () => {
  it('has no thumb without artwork', () => {
    expect(toThumb(null)).toBeUndefined();
    expect(toThumb({ ...poster, variants: [] })).toBeUndefined();
  });
  it('picks the first variant of 480 or more and lists all as srcSet', () => {
    const thumb = toThumb(poster)!;
    expect(thumb.src).toBe('https://m.test/640.webp');
    expect(thumb.srcSet).toBe(
      'https://m.test/320.webp 320w, https://m.test/640.webp 640w, https://m.test/1280.webp 1280w',
    );
  });
});

describe('cardToItem', () => {
  it('maps a video card', () => {
    const item = cardToItem(videoCard());
    expect(item).toMatchObject({
      kind: 'video',
      id: 'v-1',
      slug: 'rivers',
      description: '',
      durationSeconds: 125,
      kidsSafe: true,
      hasCaptions: true,
      categorySlug: '',
      categoryName: '',
    });
  });
  it('maps a series card and keeps its id for My List keys', () => {
    const item = cardToItem(
      videoCard({ kind: 'series', id: 's-1', durationMs: null, episodeCount: 6 }),
    );
    expect(item).toMatchObject({ kind: 'series', id: 's-1', episodeCount: 6, seasonCount: 1 });
  });
});

describe('profiles', () => {
  const dto = {
    id: 'p1',
    name: 'Ada',
    avatarId: 'star',
    isKids: false,
    isPrimary: true,
    hasPin: false,
    language: 'en',
    autoplayNext: true,
    dataSaver: false,
    position: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  it('maps a profile with a tone derived from the avatar', () => {
    expect(profileToView(dto, 'p1')).toEqual({
      id: 'p1',
      name: 'Ada',
      kids: false,
      tone: 'lemon',
      owner: true,
      language: 'en',
      autoplayNext: true,
      lastUsedHere: true,
    });
  });
  it('round trips tone and avatar', () => {
    for (const tone of ['sky', 'mint', 'lemon', 'peach', 'lavender']) {
      expect(toneFromAvatar(avatarFromTone(tone))).toBe(tone);
    }
    expect(avatarFromTone(undefined)).toBe('sun');
  });
});

describe('durationBucketOf', () => {
  it('maps the UI length filter to catalog buckets', () => {
    expect(durationBucketOf('any')).toBeUndefined();
    expect(durationBucketOf(undefined)).toBeUndefined();
    expect(durationBucketOf('short')).toBe('short');
    expect(durationBucketOf('medium')).toBe('medium');
    expect(durationBucketOf('long')).toBe('long');
  });
});
