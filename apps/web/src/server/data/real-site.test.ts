import { defaultSettings } from '@ad/theme/settings';
import { describe, expect, it } from 'vitest';
import { FixtureSite } from '../../lib/data/fixtures/site';
import { RealSite } from './real-site';

const settings = (overrides: Record<string, unknown> = {}) => ({
  getAll: async () => ({ ...defaultSettings(), ...overrides }) as never,
  getPublishedPage: async () => null,
});

describe('RealSite content', () => {
  it('takes the name, tagline, support email and sign up mode from settings', async () => {
    const site = new RealSite(
      settings({
        'platform.name': 'Sister V TV',
        'platform.tagline': 'Learn at your pace',
        'platform.support_email': 'help@sisterv.test',
        'features.signups_open': false,
      }),
      new FixtureSite(),
    );
    expect(await site.content()).toMatchObject({
      platformName: 'Sister V TV',
      tagline: 'Learn at your pace',
      supportEmail: 'help@sisterv.test',
      signUpOpen: false,
    });
  });

  it('keeps sign up open and the name default when nothing is stored', async () => {
    const content = await new RealSite(settings(), new FixtureSite()).content();
    expect(content.signUpOpen).toBe(true);
    expect(content.platformName).toBe('Angels Delight TV');
  });

  it('puts the site in maintenance when the mode is on and shows the banner inside its window', async () => {
    const now = new Date('2026-11-18T12:00:00Z');
    const banner = (startsAt: string | null, endsAt: string | null) => ({
      enabled: true,
      message: 'Short break tonight',
      startsAt,
      endsAt,
    });
    const content = (overrides: Record<string, unknown>) =>
      new RealSite(settings(overrides), new FixtureSite(), () => now).content();
    expect((await content({ 'maintenance.mode': true })).maintenance.active).toBe(true);
    expect(
      (
        await content({
          'maintenance.banner': banner('2026-11-18T10:00:00Z', '2026-11-18T14:00:00Z'),
        })
      ).maintenance.banner,
    ).toBe('Short break tonight');
    expect(
      (await content({ 'maintenance.banner': banner('2026-11-19T10:00:00Z', null) })).maintenance
        .banner,
    ).toBeUndefined();
    expect(
      (await content({ 'maintenance.banner': banner(null, '2026-11-18T11:00:00Z') })).maintenance
        .banner,
    ).toBeUndefined();
  });

  it('serves the draft fallback until the admin publishes a page', async () => {
    const site = new RealSite(
      { ...settings(), getPublishedPage: async () => null },
      new FixtureSite(),
    );
    const page = await site.legal('terms');
    expect(page?.slug).toBe('terms');
    expect(page?.draft).toBe(true);
  });

  it('serves the published page the admin edited, with a contents list', async () => {
    const site = new RealSite(
      {
        ...settings(),
        getPublishedPage: async (slug: string) => ({
          slug,
          title: 'Terms of use',
          html: '<h2>Rules</h2><p>Be kind.</p>',
          version: 2,
          updatedAt: '2026-11-17T10:00:00.000Z',
        }),
      } as never,
      new FixtureSite(),
    );
    const page = await site.legal('terms');
    expect(page?.draft).toBe(false);
    expect(page?.html).toContain('Be kind.');
    expect(page?.sections.map((s) => s.heading)).toEqual(['Rules']);
  });

  it('keeps the help page on the questions list and unknown slugs on the fallback', async () => {
    const asked: string[] = [];
    const site = new RealSite(
      {
        ...settings(),
        getPublishedPage: async (slug: string) => {
          asked.push(slug);
          return null;
        },
      } as never,
      new FixtureSite(),
    );
    expect(await site.legal('nope')).toBeNull();
    expect(asked).toEqual([]);
  });
});
