import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@ad/theme/settings';
import { resolveSeoSettings, shareText } from './seo-settings';

const base = () => defaultSettings();

describe('resolveSeoSettings (M45-S05)', () => {
  it('uses the description when set', () => {
    const s = resolveSeoSettings({
      ...base(),
      'seo.site_description': 'Free lessons',
      'platform.tagline': 'Tag',
    });
    expect(s.description).toBe('Free lessons');
  });

  it('falls back to the tagline when no description is set', () => {
    expect(
      resolveSeoSettings({ ...base(), 'platform.tagline': 'Learn anything' }).description,
    ).toBe('Learn anything');
  });

  it('falls back to a neutral line when neither is set', () => {
    expect(resolveSeoSettings(base()).description).toBe('Free learning videos for everyone.');
  });

  it('gives the configured social image, or the bundled placeholder', () => {
    expect(resolveSeoSettings(base()).socialImageUrl).toBe('/brand-icons/placeholder-og.png');
    expect(
      resolveSeoSettings({ ...base(), 'seo.default_social_image_url': 'https://cdn.test/o.jpg' })
        .socialImageUrl,
    ).toBe('https://cdn.test/o.jpg');
  });

  it('carries indexing, channels and the template', () => {
    const s = resolveSeoSettings({ ...base(), 'seo.indexing': false });
    expect(s.indexing).toBe(false);
    expect(s.shareChannels).toEqual(['whatsapp', 'facebook', 'x']);
    expect(s.shareTemplate).toBe('{title} on {siteName}');
  });
});

describe('shareText', () => {
  it('fills title and site name', () => {
    expect(shareText('{title} on {siteName}', { title: 'Rivers', siteName: 'ADTV' })).toBe(
      'Rivers on ADTV',
    );
  });
  it('fills each placeholder every time it appears', () => {
    expect(shareText('{title}: {title}', { title: 'A', siteName: 'B' })).toBe('A: A');
  });
});
