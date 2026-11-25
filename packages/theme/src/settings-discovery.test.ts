import { describe, expect, it } from 'vitest';
import { SETTING_DEFS, SETTING_KEYS, defaultSettings, type SettingKey } from './settings-registry';
import { DISCOVERY_KEYS, SHARE_CHANNELS } from './settings-discovery';

const parse = (key: SettingKey, value: unknown) => SETTING_DEFS[key].schema.safeParse(value);

describe('discovery settings (M45-S05, S06, S11)', () => {
  it('registers every key', () => {
    for (const key of DISCOVERY_KEYS) expect(SETTING_KEYS).toContain(key);
  });

  it('rejects a description over 160 characters', () => {
    expect(parse('seo.site_description', 'x'.repeat(160)).success).toBe(true);
    expect(parse('seo.site_description', 'x'.repeat(161)).success).toBe(false);
  });

  it('defaults to empty text, so the tagline stands in', () => {
    const d = defaultSettings();
    expect(d['seo.site_description']).toBe('');
    expect(d['seo.default_social_image_url']).toBe('');
  });

  it('accepts only an https link or a site path for the social image', () => {
    expect(parse('seo.default_social_image_url', 'https://cdn.example.com/a.jpg').success).toBe(
      true,
    );
    expect(parse('seo.default_social_image_url', '/brand-icons/og.png').success).toBe(true);
    expect(parse('seo.default_social_image_url', 'http://cdn.example.com/a.jpg').success).toBe(
      false,
    );
    expect(parse('seo.default_social_image_url', 'javascript:alert(1)').success).toBe(false);
  });

  it('share text takes {title} and {siteName} only', () => {
    expect(defaultSettings()['seo.share_text_template']).toBe('{title} on {siteName}');
    expect(parse('seo.share_text_template', 'Watch {title}').success).toBe(true);
    expect(parse('seo.share_text_template', 'Watch {title} {author}').success).toBe(false);
    expect(parse('seo.share_text_template', '').success).toBe(false);
  });

  it('share channels default to WhatsApp, Facebook and X, with Email off (R26)', () => {
    expect(defaultSettings()['seo.share_channels']).toEqual(['whatsapp', 'facebook', 'x']);
    expect(SHARE_CHANNELS).toEqual(['whatsapp', 'facebook', 'x', 'email']);
    expect(parse('seo.share_channels', ['whatsapp', 'email']).success).toBe(true);
    expect(parse('seo.share_channels', ['telegram']).success).toBe(false);
    expect(parse('seo.share_channels', ['x', 'x']).success).toBe(false);
  });

  it('indexing is on and the notice is on with neutral text', () => {
    const d = defaultSettings();
    expect(d['seo.indexing']).toBe(true);
    expect(d['consent.notice_enabled']).toBe(true);
    expect(d['consent.notice_text'].length).toBeGreaterThan(20);
    expect(d['consent.notice_version']).toBe(1);
  });

  it('notice text refuses dashes, emoji and markup', () => {
    expect(parse('consent.notice_text', 'We store small things.').success).toBe(true);
    expect(parse('consent.notice_text', `We store ${String.fromCharCode(0x2014)} things`).success).toBe(false);
    expect(parse('consent.notice_text', '<b>hi</b>').success).toBe(false);
    expect(parse('consent.notice_text', 'x'.repeat(301)).success).toBe(false);
  });

  it('every discovery key reaches the browser except indexing', () => {
    for (const key of DISCOVERY_KEYS) {
      expect(SETTING_DEFS[key].isPublic, key).toBe(key !== 'seo.indexing');
    }
  });
});

describe('share card settings (L15b)', () => {
  it('twitter handle accepts a handle with or without @ and empty, refuses the rest', () => {
    expect(defaultSettings()['seo.twitter_handle']).toBe('');
    expect(parse('seo.twitter_handle', '@learntv').success).toBe(true);
    expect(parse('seo.twitter_handle', 'learn_tv').success).toBe(true);
    expect(parse('seo.twitter_handle', '').success).toBe(true);
    expect(parse('seo.twitter_handle', 'two words').success).toBe(false);
    expect(parse('seo.twitter_handle', 'waytoolonghandlehere').success).toBe(false);
  });

  it('title overlay and play badge default on and are public', () => {
    expect(defaultSettings()['seo.share_title_overlay']).toBe(true);
    expect(defaultSettings()['seo.share_play_badge']).toBe(true);
    expect(parse('seo.share_play_badge', 'yes').success).toBe(false);
  });
});
