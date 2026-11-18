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
