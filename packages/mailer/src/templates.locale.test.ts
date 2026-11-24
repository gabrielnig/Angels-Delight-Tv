import { describe, expect, it } from 'vitest';
import { BASELINES, EN_NG, type CatalogShape } from '@ad/shared/messages';
import { renderTemplate, type BrandContext, type TemplateName } from './templates';

const brand: BrandContext = { appName: 'Angels Delight TV', supportEmail: 'help@example.org' };
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const vars = { homeUrl: 'https://tv.example.org/' };
const yo: CatalogShape = {
  'mail.welcome.subject': 'Kaabo si {appName}',
  'mail.welcome.action': 'Bere si wo',
  'mail.common.help': 'Nilo iranlowo? Kọ si {email}.',
};

describe('mail in the account locale (M46-S18)', () => {
  it('renders the keys the locale has and falls back to English per key', () => {
    const mail = renderTemplate('welcome', vars, brand, { locale: 'yo', catalog: yo });
    expect(mail.subject).toBe('Kaabo si Angels Delight TV');
    expect(mail.text).toContain('Bere si wo: https://tv.example.org/');
    expect(mail.text).toContain('Pick a profile and start watching.');
    expect(mail.text).toContain('Nilo iranlowo? Kọ si help@example.org.');
    expect(mail.html).toContain('<html lang="yo"');
    expect(mail.html).toContain('Nilo iranlowo? Kọ si <a href="mailto:help@example.org"');
  });

  it('is plain English without a locale, and for locale en', () => {
    const base = renderTemplate('welcome', vars, brand);
    expect(base.subject).toBe('Welcome to Angels Delight TV');
    expect(base.html).toContain('<html lang="en"');
    expect(renderTemplate('welcome', vars, brand, { locale: 'en' })).toEqual(base);
  });

  it('keeps staff templates in English whatever the locale', () => {
    const staff = renderTemplate(
      'staff_notice',
      { title: 'Upload failed', linkUrl: 'https://tv.example.org/admin' },
      brand,
      { locale: 'yo', catalog: { 'mail.common.help': 'x {email}' } },
    );
    expect(staff.html).toContain('<html lang="en"');
    expect(staff.text).toContain('Need help? Write to help@example.org.');
  });

  it('subject lines of every locale carry no em or en dash', () => {
    const subjects = (catalog: Record<string, unknown>) =>
      Object.entries(catalog).filter(([key]) => /^mail\..*\.subject/.test(key));
    for (const catalog of [EN_NG, ...Object.values(BASELINES)] as Array<Record<string, unknown>>) {
      for (const [key, value] of subjects(catalog)) {
        expect(JSON.stringify(value), key).not.toMatch(DASHES);
      }
    }
  });

  it('every viewer template has a subject key in the English catalog', () => {
    const viewer: TemplateName[] = [
      'welcome',
      'verify_email',
      'reset_password',
      'export_ready',
      'account_deleted',
    ];
    for (const name of viewer) {
      const has = Object.keys(EN_NG).some((key) => key.startsWith(`mail.${name}.subject`));
      expect(has, name).toBe(true);
    }
  });

  it('the digest subject uses a plural pair and the translated period word', () => {
    const base = {
      period: 'week',
      lines: 'A\nB',
      linkUrl: 'https://tv.example.org/',
      unsubscribeUrl: 'https://tv.example.org/u',
    };
    expect(renderTemplate('viewer_digest', { ...base, count: 1 }, brand).subject).toBe(
      'One new thing on Angels Delight TV this week',
    );
    expect(renderTemplate('viewer_digest', { ...base, count: 3 }, brand).subject).toBe(
      'New things on Angels Delight TV this week',
    );
  });
});
