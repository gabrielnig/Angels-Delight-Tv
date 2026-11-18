import { describe, expect, it } from 'vitest';
import { legalFromHtml } from './legal-html';

const html =
  '<h2>Using the service</h2><p>Be kind.</p><h2>Our videos &amp; you</h2><ul><li>Do not resell</li></ul><h3>Detail</h3><p>More.</p>';

describe('legalFromHtml (M26-S01, M26-S02)', () => {
  const page = legalFromHtml({
    slug: 'terms',
    title: 'Terms of use',
    html,
    updatedAt: '2026-11-17T10:00:00.000Z',
  });

  it('builds a contents list from the h2 headings and gives each heading an id', () => {
    expect(page.sections.map((s) => s.heading)).toEqual(['Using the service', 'Our videos & you']);
    expect(page.sections.map((s) => s.id)).toEqual(['using-the-service', 'our-videos-you']);
    expect(page.html).toContain('<h2 id="using-the-service">Using the service</h2>');
  });

  it('is not a draft and shows a last updated date in Lagos time', () => {
    expect(page.draft).toBe(false);
    expect(page.updated).toBe('17 Nov 2026');
  });

  it('estimates reading time with a one minute floor', () => {
    expect(page.readingMinutes).toBe(1);
    const long = legalFromHtml({
      slug: 'privacy',
      title: 'Privacy',
      html: `<p>${'word '.repeat(900)}</p>`,
      updatedAt: '2026-11-17T10:00:00.000Z',
    });
    expect(long.readingMinutes).toBe(4);
  });

  it('keeps ids unique when two headings match', () => {
    const p = legalFromHtml({
      slug: 'terms',
      title: 'T',
      html: '<h2>Contact</h2><p>a</p><h2>Contact</h2><p>b</p>',
      updatedAt: '2026-11-17T10:00:00.000Z',
    });
    expect(p.sections.map((s) => s.id)).toEqual(['contact', 'contact-2']);
  });

  it('works with no headings at all', () => {
    const p = legalFromHtml({
      slug: 'about',
      title: 'About',
      html: '<p>Hello</p>',
      updatedAt: '2026-11-17T10:00:00.000Z',
    });
    expect(p.sections).toEqual([]);
    expect(p.html).toBe('<p>Hello</p>');
  });

  it('treats a placeholder page as a draft so the banner shows before launch', () => {
    const p = legalFromHtml({
      slug: 'terms',
      title: 'T',
      html: '<p>[Add your terms of use here before launch]</p>',
      updatedAt: '2026-11-17T10:00:00.000Z',
    });
    expect(p.draft).toBe(true);
  });
});
