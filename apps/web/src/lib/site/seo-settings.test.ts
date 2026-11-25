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

  it('carries the storage notice switch, text and version (M45-S11)', () => {
    const s = resolveSeoSettings({
      ...base(),
      'consent.notice_enabled': false,
      'consent.notice_text': 'We keep a few files.',
      'consent.notice_version': 3,
    });
    expect(s.noticeEnabled).toBe(false);
    expect(s.noticeText).toBe('We keep a few files.');
    expect(s.noticeVersion).toBe(3);
    expect(resolveSeoSettings(base()).noticeEnabled).toBe(true);
  });

  it('carries the support email so error pages can quote it (M45-S14)', () => {
    expect(resolveSeoSettings({ ...base(), 'platform.support_email': 'help@example.org' }).supportEmail).toBe(
      'help@example.org',
    );
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

describe('share card settings (L15b)', () => {
  it('carries the X handle, title overlay and play badge', () => {
    const d = resolveSeoSettings(base());
    expect(d).toMatchObject({ twitterHandle: '', titleOverlay: true, playBadge: true });
    const s = resolveSeoSettings({
      ...base(),
      'seo.twitter_handle': '@learntv',
      'seo.share_title_overlay': false,
      'seo.share_play_badge': false,
    });
    expect(s).toMatchObject({ twitterHandle: '@learntv', titleOverlay: false, playBadge: false });
  });
});
