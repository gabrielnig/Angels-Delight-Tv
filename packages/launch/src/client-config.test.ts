import { describe, expect, it } from 'vitest';
import { checkClientTheme, parseClientConfig } from './client-config';

const valid = {
  platformName: 'Angels Delight TV',
  tagline: 'Learning for everyone',
  domain: 'angelsdelight.tv',
  mediaDomain: 'media.angelsdelight.tv',
  supportEmail: 'help@angelsdelight.tv',
  adminOwnerEmail: 'vanessa@example.com',
  theme: {
    colors: { primary: '#1F6FB5', accent: '#FFC93C' },
    fontKey: 'nunito',
  },
  logo: { path: 'brand/logo.png', altText: 'Angels Delight TV' },
  favicon: { path: 'brand/favicon.png' },
  legal: {
    terms: { file: 'legal/terms.html' },
    privacy: { html: '<p>Our privacy policy</p>' },
  },
  languages: { default: 'en', offered: ['en', 'yo'] },
};

describe('parseClientConfig', () => {
  it('accepts a complete file and fills defaults', () => {
    const result = parseClientConfig(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.domain).toBe('angelsdelight.tv');
    expect(result.config.theme?.typeScale).toBeUndefined();
    expect(result.config.languages?.offered).toEqual(['en', 'yo']);
  });

  it('accepts a minimal file with only the required fields', () => {
    const result = parseClientConfig({
      platformName: 'Name',
      domain: 'example.org',
      supportEmail: 'a@example.org',
      adminOwnerEmail: 'owner@example.org',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a domain with a scheme or path and says which field', () => {
    const result = parseClientConfig({ ...valid, domain: 'https://angelsdelight.tv/' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'domain')).toBe(true);
  });

  it('rejects bad emails, hex colours, unknown fonts and unknown keys', () => {
    const result = parseClientConfig({
      ...valid,
      supportEmail: 'nope',
      theme: { colors: { primary: 'blue' }, fontKey: 'comic-sans' },
      surprise: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('supportEmail');
    expect(paths).toContain('theme.colors.primary');
    expect(paths).toContain('theme.fontKey');
    expect(paths.some((p) => p.includes('surprise') || p === '')).toBe(true);
  });

  it('requires the default language to be among the offered languages', () => {
    const result = parseClientConfig({ ...valid, languages: { default: 'fr', offered: ['en'] } });
    expect(result.ok).toBe(false);
  });

  it('rejects a legal page given as both file and html', () => {
    const result = parseClientConfig({
      ...valid,
      legal: { terms: { file: 'a.html', html: '<p>x</p>' } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects placeholder markers left in the file', () => {
    const result = parseClientConfig({ ...valid, platformName: 'REPLACE_ME' });
    expect(result.ok).toBe(false);
  });

  it('never echoes values in error messages', () => {
    const result = parseClientConfig({ ...valid, supportEmail: 'secret-looking-value' });
    expect(JSON.stringify(result)).not.toContain('secret-looking-value');
  });
});

describe('checkClientTheme', () => {
  it('passes the default palette', () => {
    expect(checkClientTheme({ colors: {} }).blocked).toBe(false);
  });

  it('blocks a palette where text is unreadable', () => {
    const gate = checkClientTheme({ colors: { ink: '#CCCCCC', bg: '#FFFFFF' } });
    expect(gate.blocked).toBe(true);
    expect(gate.messages.length).toBeGreaterThan(0);
  });

  it('accepts guest settings and rejects an unknown audience', () => {
    const ok = parseClientConfig({ ...valid, guestAudience: 'kids', guestPlay: false });
    expect(ok.ok && ok.config.guestAudience).toBe('kids');
    expect(ok.ok && ok.config.guestPlay).toBe(false);
    expect(parseClientConfig({ ...valid, guestAudience: 'teen' }).ok).toBe(false);
    expect(parseClientConfig({ ...valid, guestPlay: 'yes' }).ok).toBe(false);
  });
});

describe('home block', () => {
  it('accepts section titles and the seed switch', () => {
    const result = parseClientConfig({
      ...valid,
      home: { seedDefaults: false, continueTitle: 'Keep learning', newTitle: 'Fresh', trendingTitle: 'Popular' },
    });
    expect(result.ok).toBe(true);
  });

  it('is optional', () => {
    expect(parseClientConfig(valid).ok).toBe(true);
  });

  it('refuses unknown keys, long titles and placeholders', () => {
    for (const home of [{ extra: 1 }, { continueTitle: 'x'.repeat(41) }, { newTitle: 'REPLACE_ME title' }]) {
      const result = parseClientConfig({ ...valid, home });
      expect(result.ok).toBe(false);
    }
  });
});
