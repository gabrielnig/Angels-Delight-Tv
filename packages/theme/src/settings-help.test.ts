import { describe, expect, it } from 'vitest';
import { SETTING_DEFS } from './settings-registry';

const def = SETTING_DEFS['help.support_contact'];

describe('help.support_contact (M50-S29)', () => {
  it('is an admin setting that is empty by default and not public', () => {
    expect(def.default).toBe('');
    expect(def.tier).toBe('admin');
    expect(def.isPublic).toBe(false);
  });

  it('accepts nothing, an email address or an https link', () => {
    expect(def.schema.safeParse('').success).toBe(true);
    expect(def.schema.safeParse('help@example.org').success).toBe(true);
    expect(def.schema.safeParse('https://wa.me/2340000000000').success).toBe(true);
  });

  it('refuses other text, http links and script links', () => {
    for (const bad of [
      'call me',
      'http://example.org',
      'javascript:alert(1)',
      'a@b',
      'mailto:a@b.org',
    ]) {
      expect(def.schema.safeParse(bad).success, bad).toBe(false);
    }
  });
});
