import { describe, expect, it } from 'vitest';
import {
  PUBLIC_SETTING_KEYS,
  SETTING_DEFS,
  SETTING_KEYS,
  defaultSettings,
  isSettingKey,
  type SettingKey,
} from './settings-registry';

const parse = (key: SettingKey, value: unknown) => SETTING_DEFS[key].schema.safeParse(value);

describe('registry shape', () => {
  it('has database legal key names that match the settings_key_format check', () => {
    for (const key of SETTING_KEYS) expect(key).toMatch(/^[a-z][a-z0-9_.]{1,63}$/);
  });

  it('includes every known key from docs/DATA-MODEL.md 8.2', () => {
    for (const key of [
      'platform.name',
      'platform.tagline',
      'platform.canonical_host',
      'features.signups_open',
      'features.require_approved_captions',
      'limits.max_profiles',
      'limits.upload_max_bytes',
      'content.default_language',
      'content.languages',
      'legal.terms_version',
      'legal.privacy_version',
      'analytics.raw_retention_days',
    ]) {
      expect(isSettingKey(key)).toBe(true);
    }
  });

  it('every default passes its own schema', () => {
    for (const key of SETTING_KEYS) {
      expect(parse(key, SETTING_DEFS[key].default).success, key).toBe(true);
    }
  });

  it('defaults are safe: signup open, no maintenance, five profiles', () => {
    const defaults = defaultSettings();
    expect(defaults['limits.max_profiles']).toBe(5);
    expect(defaults['maintenance.mode']).toBe(false);
    expect(defaults['maintenance.banner'].enabled).toBe(false);
    expect(defaults['platform.name']).toBe('Angels Delight TV');
  });

  it('defaults are fresh copies', () => {
    defaultSettings()['content.languages'].push('yo');
    expect(defaultSettings()['content.languages']).toEqual(['en']);
  });

  it('exposes only intended keys to the browser', () => {
    expect(PUBLIC_SETTING_KEYS).toContain('platform.name');
    expect(PUBLIC_SETTING_KEYS).toContain('features.signups_open');
    for (const secretish of [
      'limits.lockout_attempts',
      'limits.upload_max_bytes',
      'analytics.raw_retention_days',
      'platform.canonical_host',
    ]) {
      expect(PUBLIC_SETTING_KEYS).not.toContain(secretish);
    }
  });

  it('has an audit retention in months, default 24, super admin only and never public', () => {
    const def = SETTING_DEFS['audit.retention_months'];
    expect(def.default).toBe(24);
    expect(def.tier).toBe('super');
    expect(def.isPublic).toBe(false);
    expect(parse('audit.retention_months', 5).success).toBe(false);
    expect(parse('audit.retention_months', 6).success).toBe(true);
    expect(parse('audit.retention_months', 120).success).toBe(true);
    expect(parse('audit.retention_months', 121).success).toBe(false);
    expect(parse('audit.retention_months', 12.5).success).toBe(false);
    expect(PUBLIC_SETTING_KEYS).not.toContain('audit.retention_months');
  });

  it('has an AirPlay flag that is off by default, super admin only and never public (R16)', () => {
    const def = SETTING_DEFS['features.airplay'];
    expect(def.default).toBe(false);
    expect(def.tier).toBe('super');
    expect(def.isPublic).toBe(false);
    expect(parse('features.airplay', true).success).toBe(true);
    expect(parse('features.airplay', 'yes').success).toBe(false);
  });

  it('has a Sign in with Google flag that is on, super admin only and never public (M49-S05)', () => {
    const def = SETTING_DEFS['features.signin_with_google'];
    expect(def.default).toBe(true);
    expect(def.tier).toBe('super');
    expect(def.isPublic).toBe(false);
    expect(parse('features.signin_with_google', false).success).toBe(true);
    expect(parse('features.signin_with_google', 'yes').success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(isSettingKey('__proto__')).toBe(false);
    expect(isSettingKey('constructor')).toBe(false);
    expect(isSettingKey('platform.password')).toBe(false);
  });
});

describe('value validation', () => {
  it.each([
    ['limits.max_profiles', 0, false],
    ['limits.max_profiles', 1, true],
    ['limits.max_profiles', 10, true],
    ['limits.max_profiles', 11, false],
    ['limits.max_profiles', 2.5, false],
    ['limits.max_profiles', '5', false],
    ['limits.max_profiles', -1, false],
    ['limits.max_sessions', 11, false],
    ['limits.upload_max_bytes', 1000, false],
    ['limits.upload_max_bytes', 2 * 1024 ** 3, true],
    ['limits.upload_max_bytes', 6 * 1024 ** 3, false],
    ['limits.lockout_attempts', 2, false],
    ['limits.lockout_attempts', 20, true],
    ['playback.finish_percent', 79, false],
    ['playback.finish_percent', 100, true],
    ['playback.rewind_seconds', 31, false],
    ['playback.countdown_seconds', 4, false],
    ['playback.countdown_seconds', 5, true],
    ['playback.countdown_seconds', 10, true],
    ['playback.countdown_seconds', 11, false],
    ['playback.countdown_seconds', 7.5, false],
    ['analytics.raw_retention_days', 6, false],
    ['features.signups_open', 'yes', false],
    ['features.signups_open', false, true],
    ['platform.name', '', false],
    ['platform.name', '   ', false],
    ['platform.name', 'x'.repeat(61), false],
    ['platform.name', 'Angels Delight TV', true],
    ['platform.support_email', 'help@angelsdelight.tv', true],
    ['platform.support_email', '', true],
    ['platform.support_email', 'not an email', false],
    ['platform.canonical_host', 'angelsdelight.tv', true],
    ['platform.canonical_host', 'https://angelsdelight.tv', false],
    ['platform.canonical_host', 'localhost', false],
    ['platform.canonical_host', '', true],
    ['platform.social_links', [{ label: 'YouTube', url: 'https://youtube.com/@x' }], true],
    ['platform.social_links', [{ label: 'x', url: 'javascript:alert(1)' }], false],
    ['platform.social_links', [{ label: 'x', url: 'http://insecure.test' }], false],
    [
      'platform.social_links',
      Array.from({ length: 7 }, () => ({ label: 'a', url: 'https://a.test' })),
      false,
    ],
    ['content.default_language', 'en', true],
    ['content.default_language', 'English', false],
    ['content.languages', [], false],
    ['content.languages', ['en', 'yo', 'ig', 'ha'], true],
    [
      'maintenance.banner',
      { enabled: true, message: 'Back soon', startsAt: null, endsAt: null },
      true,
    ],
    [
      'maintenance.banner',
      { enabled: true, message: 'x', startsAt: 'tomorrow', endsAt: null },
      false,
    ],
  ] as const)('%s = %j is %s', (key, value, ok) => {
    expect(parse(key, value).success).toBe(ok);
  });

  it('trims strings and lowercases the host', () => {
    expect(parse('platform.name', '  Angels  ').data).toBe('Angels');
    expect(parse('platform.canonical_host', ' AngelsDelight.TV ').data).toBe('angelsdelight.tv');
  });

  it('reports the message for a bad host', () => {
    const result = parse('platform.canonical_host', 'https://x.tv');
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error!.issues)).toContain('without https://');
  });
});

describe('guest playback settings (M40-S10, G5, G9)', () => {
  it('guest play defaults on, is public and Super admin only', () => {
    const def = SETTING_DEFS['features.guest_play'];
    expect(def.default).toBe(true);
    expect(def.isPublic).toBe(true);
    expect(def.tier).toBe('super');
    expect(def.label).toBe('Guests can watch');
    expect(parse('features.guest_play', 'yes').success).toBe(false);
  });

  it('guest segment minutes default to 20 within 5 and 120 and stay private', () => {
    const def = SETTING_DEFS['limits.guest_segment_minutes'];
    expect(def.default).toBe(20);
    expect(def.isPublic).toBe(false);
    expect(def.tier).toBe('super');
    expect(parse('limits.guest_segment_minutes', 4).success).toBe(false);
    expect(parse('limits.guest_segment_minutes', 5).success).toBe(true);
    expect(parse('limits.guest_segment_minutes', 120).success).toBe(true);
    expect(parse('limits.guest_segment_minutes', 121).success).toBe(false);
    expect(parse('limits.guest_segment_minutes', 20.5).success).toBe(false);
  });
});

describe('guest audience setting (M40-S10, R18)', () => {
  it('defaults to general, is public, admin tier and accepts only general or kids', () => {
    const def = SETTING_DEFS['features.guest_audience'];
    expect(def.default).toBe('general');
    expect(def.isPublic).toBe(true);
    expect(def.tier).toBe('admin');
    expect(def.label).toBe('Default for visitors without an account');
    expect(parse('features.guest_audience', 'kids').success).toBe(true);
    expect(parse('features.guest_audience', 'general').success).toBe(true);
    expect(parse('features.guest_audience', 'adult').success).toBe(false);
    expect(parse('features.guest_audience', true).success).toBe(false);
  });
});

describe('home settings (M41, R12, R13, R14)', () => {
  const defaults = defaultSettings();

  it('auto rotate is on by default and the interval is 20 seconds (D-351 supersedes the 10 seconds of R12)', () => {
    expect(defaults['features.autoplay_hero']).toBe(true);
    expect(defaults['home.hero_interval_seconds']).toBe(20);
    expect(defaults['home.hero_max_loops']).toBe(2);
  });

  it('previews are on, unknown connections are on (D-354), fallback is five', () => {
    expect(defaults['home.hero_previews']).toBe(true);
    expect(defaults['home.hero_previews_unknown_connection']).toBe(true);
    expect(defaults['home.hero_fallback_count']).toBe(5);
  });

  it('the clip plays for 20 seconds, the slide waits for it, the link must reach 2 Mbps and sound is offered', () => {
    expect(defaults['home.hero_clip_seconds']).toBe(20);
    expect(defaults['home.hero_wait_for_clip']).toBe(true);
    expect(defaults['home.hero_previews_min_downlink_mbps']).toBe(2);
    expect(defaults['home.hero_sound']).toBe(true);
  });

  it('keeps the clip length between 6 and 30 seconds and the speed floor between 1 and 10 Mbps', () => {
    expect(parse('home.hero_clip_seconds', 5).success).toBe(false);
    expect(parse('home.hero_clip_seconds', 6).success).toBe(true);
    expect(parse('home.hero_clip_seconds', 30).success).toBe(true);
    expect(parse('home.hero_clip_seconds', 31).success).toBe(false);
    expect(parse('home.hero_clip_seconds', 12.5).success).toBe(false);
    expect(parse('home.hero_previews_min_downlink_mbps', 0).success).toBe(false);
    expect(parse('home.hero_previews_min_downlink_mbps', 1).success).toBe(true);
    expect(parse('home.hero_previews_min_downlink_mbps', 10).success).toBe(true);
    expect(parse('home.hero_previews_min_downlink_mbps', 11).success).toBe(false);
    expect(parse('home.hero_wait_for_clip', 'yes').success).toBe(false);
  });

  it('labels default to View all and Continue learning', () => {
    expect(defaults['home.view_all_label']).toBe('View all');
    expect(defaults['home.continue_title']).toBe('Continue learning');
  });

  it('keeps the interval between 5 and 60 and the loops between 0 and 5', () => {
    expect(parse('home.hero_interval_seconds', 4).success).toBe(false);
    expect(parse('home.hero_interval_seconds', 5).success).toBe(true);
    expect(parse('home.hero_interval_seconds', 60).success).toBe(true);
    expect(parse('home.hero_interval_seconds', 61).success).toBe(false);
    expect(parse('home.hero_interval_seconds', 7.5).success).toBe(false);
    expect(parse('home.hero_max_loops', 0).success).toBe(true);
    expect(parse('home.hero_max_loops', 6).success).toBe(false);
    expect(parse('home.hero_fallback_count', 0).success).toBe(false);
    expect(parse('home.hero_fallback_count', 6).success).toBe(false);
  });

  it('limits the two labels', () => {
    expect(parse('home.view_all_label', 'x'.repeat(24)).success).toBe(true);
    expect(parse('home.view_all_label', 'x'.repeat(25)).success).toBe(false);
    expect(parse('home.continue_title', 'x'.repeat(41)).success).toBe(false);
  });

  it('exposes what the browser needs and keeps the rest private', () => {
    for (const key of [
      'home.hero_interval_seconds',
      'home.hero_max_loops',
      'home.hero_previews',
      'home.hero_previews_unknown_connection',
      'home.hero_previews_min_downlink_mbps',
      'home.hero_wait_for_clip',
      'home.hero_sound',
      'home.view_all_label',
      'home.continue_title',
    ] as const)
      expect(PUBLIC_SETTING_KEYS, key).toContain(key);
    expect(PUBLIC_SETTING_KEYS).not.toContain('home.hero_fallback_count');
    expect(PUBLIC_SETTING_KEYS).not.toContain('home.hero_clip_seconds');
  });

  it('the unknown connection switch needs a super admin', () => {
    expect(SETTING_DEFS['home.hero_previews_unknown_connection'].tier).toBe('super');
    expect(SETTING_DEFS['home.hero_interval_seconds'].tier).toBe('admin');
  });
});

describe('language settings (M46)', () => {
  it('ui_languages defaults to English only and accepts known codes', () => {
    expect(defaultSettings()['content.ui_languages']).toEqual(['en']);
    expect(parse('content.ui_languages', ['en', 'yo']).success).toBe(true);
    expect(parse('content.ui_languages', []).success).toBe(false);
    expect(parse('content.ui_languages', ['en', 'fr']).success).toBe(false);
  });
  it('publish_min_percent defaults to 80 and stays between 0 and 100', () => {
    expect(defaultSettings()['i18n.publish_min_percent']).toBe(80);
    expect(parse('i18n.publish_min_percent', 101).success).toBe(false);
    expect(parse('i18n.publish_min_percent', 60).success).toBe(true);
  });
});

describe('maturity settings (L5, R20)', () => {
  it('labels default to G, PG, 12, 15, 18 and must be five short different labels', () => {
    const def = SETTING_DEFS['maturity.labels'];
    expect(def.default).toBe('G,PG,12,15,18');
    expect(def.isPublic).toBe(true);
    expect(def.tier).toBe('admin');
    expect(parse('maturity.labels', 'All,7+,13+,16+,18+').success).toBe(true);
    expect(parse('maturity.labels', 'G,PG,12,15').success).toBe(false);
    expect(parse('maturity.labels', 'G,PG,PG,15,18').success).toBe(false);
  });

  it('guests may see up to rank 2 (12) by default, from 0 to 4', () => {
    const def = SETTING_DEFS['maturity.guest_max_rank'];
    expect(def.default).toBe(2);
    expect(parse('maturity.guest_max_rank', 0).success).toBe(true);
    expect(parse('maturity.guest_max_rank', 4).success).toBe(true);
    expect(parse('maturity.guest_max_rank', 5).success).toBe(false);
  });
});

describe('translation.glossary (L7)', () => {
  it('defaults to empty, is not public and holds up to 4 KB', () => {
    expect(defaultSettings()['translation.glossary']).toBe('');
    expect(SETTING_DEFS['translation.glossary'].isPublic).toBe(false);
    expect(parse('translation.glossary', 'Angels Delight TV\nSister Vanessa').success).toBe(true);
    expect(parse('translation.glossary', 'x'.repeat(4097)).success).toBe(false);
  });

  it('has private admin trending rules with the documented defaults and bounds', () => {
    const keys = {
      'trending.min_titles': [5, 1, 50],
      'trending.min_site_plays': [50, 0, 100000],
      'trending.max_age_hours': [3, 1, 72],
      'trending.top_ten_size': [10, 3, 10],
      'trending.popular_window_days': [30, 1, 365],
      'trending.popular_min_views': [5, 1, 1000],
      'trending.popular_min_titles': [3, 1, 20],
    } as const;
    for (const [key, [def, min, max]] of Object.entries(keys)) {
      expect(SETTING_DEFS[key as SettingKey].default, key).toBe(def);
      expect(parse(key as never, min).success, key).toBe(true);
      expect(parse(key as never, max).success, key).toBe(true);
      expect(parse(key as never, max + 1).success, key).toBe(false);
      expect(parse(key as never, min - 1).success, key).toBe(false);
    }
  });
});
