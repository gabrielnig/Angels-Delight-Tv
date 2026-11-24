import { describe, expect, it } from 'vitest';
import { validateCreative, validateDestination, validateSchedule, validateSponsorName } from './validate';

const own = ['site.example', 'www.site.example'];
const dest = (url: string) => validateDestination(url, { ownHosts: own });

describe('validateDestination', () => {
  it('accepts a plain https link and keeps tracking parameters as typed', () => {
    expect(dest('https://sponsor.example/landing?utm_source=ad&utm_medium=card')).toEqual({
      ok: true,
      value: 'https://sponsor.example/landing?utm_source=ad&utm_medium=card',
    });
  });

  it('rejects destination url that is http, javascript, data or has credentials', () => {
    for (const url of [
      'http://sponsor.example',
      'javascript:alert(1)',
      'data:text/html,hi',
      'ftp://sponsor.example',
      'https://user:pass@sponsor.example',
      'https://user@sponsor.example',
      '//sponsor.example',
      'sponsor.example',
      '',
    ]) {
      expect(dest(url).ok, url).toBe(false);
    }
  });

  it('rejects url on a blocked host list (localhost, private ranges, our own admin paths)', () => {
    for (const url of [
      'https://localhost/x',
      'https://app.localhost/x',
      'https://printer.local/x',
      'https://db.internal/x',
      'https://127.0.0.1/x',
      'https://10.0.0.5/x',
      'https://172.16.4.1/x',
      'https://192.168.1.1/x',
      'https://169.254.169.254/latest',
      'https://0.0.0.0/x',
      'https://[::1]/x',
      'https://[fd00::1]/x',
      'https://8.8.8.8/x',
      'https://site.example/admin/users',
      'https://WWW.site.example/',
    ]) {
      const r = dest(url);
      expect(r.ok, url).toBe(false);
    }
  });

  it('explains the reason in plain words', () => {
    const r = dest('https://127.0.0.1/x');
    expect(!r.ok && r.error).toMatch(/website|domain|address/i);
  });

  it('rejects links over 500 characters', () => {
    expect(dest(`https://sponsor.example/${'a'.repeat(500)}`).ok).toBe(false);
  });

  it('rejects whitespace and control characters inside the link', () => {
    expect(dest('https://sponsor.example/a b').ok).toBe(false);
    expect(dest('https://sponsor.example/a\u0000').ok).toBe(false);
  });
});

describe('validateCreative', () => {
  const good = {
    headline: ' Learn with us ',
    body: 'Short text',
    ctaLabel: '',
    destinationUrl: 'https://sponsor.example/a',
    altText: 'Logo',
    decorative: false,
    weight: 2,
    hasImage: true,
  };
  const run = (over: Record<string, unknown> = {}) => validateCreative({ ...good, ...over }, { ownHosts: own });

  it('strips whitespace and defaults the button label', () => {
    const r = run();
    expect(r.ok && r.value.headline).toBe('Learn with us');
    expect(r.ok && r.value.ctaLabel).toBe('Learn more');
  });

  it('strips whitespace and rejects html in headline', () => {
    expect(run({ headline: 'Hi <b>there</b>' }).ok).toBe(false);
    expect(run({ headline: '   ' }).ok).toBe(false);
    expect(run({ headline: 'x'.repeat(61) }).ok).toBe(false);
    expect(run({ body: 'x'.repeat(141) }).ok).toBe(false);
    expect(run({ ctaLabel: 'x'.repeat(25) }).ok).toBe(false);
  });

  it('refuses dashes and emoji in sponsor text', () => {
    expect(run({ headline: 'Learn — now' }).ok).toBe(false);
    expect(run({ body: 'Fast – easy' }).ok).toBe(false);
    expect(run({ ctaLabel: 'Go \u{1F680}' }).ok).toBe(false);
  });

  it('needs alt text or the decorative tick when there is an image', () => {
    expect(run({ altText: '', decorative: false }).ok).toBe(false);
    const decorative = run({ altText: '', decorative: true });
    expect(decorative.ok && decorative.value.altText).toBeNull();
    expect(run({ altText: '', decorative: false, hasImage: false }).ok).toBe(true);
  });

  it('limits weight to 1 to 10 and alt text to 120', () => {
    expect(run({ weight: 0 }).ok).toBe(false);
    expect(run({ weight: 11 }).ok).toBe(false);
    expect(run({ weight: 1.5 }).ok).toBe(false);
    expect(run({ altText: 'a'.repeat(121) }).ok).toBe(false);
  });

  it('collects every error by field name', () => {
    const r = run({ headline: '', destinationUrl: 'http://x.example' });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['destinationUrl', 'headline']);
  });
});

describe('validateSponsorName and schedule', () => {
  it('trims and limits the name', () => {
    expect(validateSponsorName('  Acme Books  ')).toEqual({ ok: true, value: 'Acme Books' });
    expect(validateSponsorName('').ok).toBe(false);
    expect(validateSponsorName('n'.repeat(81)).ok).toBe(false);
    expect(validateSponsorName('<script>').ok).toBe(false);
  });

  it('turns Lagos days into inclusive instants', () => {
    const r = validateSchedule({ startDay: '2026-12-01', endDay: '2026-12-31' });
    expect(r.ok && r.value.startsAt?.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(r.ok && r.value.endsAt?.toISOString()).toBe('2026-12-31T22:59:59.000Z');
  });

  it('allows no dates, one date, or the same day', () => {
    expect(validateSchedule({ startDay: '', endDay: '' }).ok).toBe(true);
    expect(validateSchedule({ startDay: '2026-12-01', endDay: '' }).ok).toBe(true);
    expect(validateSchedule({ startDay: '2026-12-01', endDay: '2026-12-01' }).ok).toBe(true);
  });

  it('rejects an end before the start and text that is not a date', () => {
    const r = validateSchedule({ startDay: '2026-12-10', endDay: '2026-12-09' });
    expect(!r.ok && r.errors.endDay).toMatch(/after|before/i);
    expect(validateSchedule({ startDay: 'soon', endDay: '' }).ok).toBe(false);
    expect(validateSchedule({ startDay: '', endDay: '2026-02-30' }).ok).toBe(false);
  });
});
