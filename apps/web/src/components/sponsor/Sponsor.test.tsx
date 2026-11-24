// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SelectedSponsor } from '@ad/sponsors';
import { SponsorBanner } from './SponsorBanner';
import { SponsorCard } from './SponsorCard';
import { SponsorMessageCard } from './SponsorMessageCard';
import { SponsoredLabel } from './SponsoredLabel';

afterEach(cleanup);

const base: SelectedSponsor = {
  sponsorId: 's',
  sponsorName: 'Acme',
  creativeId: '0190a000-0000-7000-8000-000000000002',
  slot: 'home_banner',
  headline: 'Learn with Acme',
  body: 'Short text',
  ctaLabel: 'Visit',
  href: '/s/0190a000-0000-7000-8000-000000000002',
  imageUrl: '/img.webp',
  wideImageUrl: null,
  altText: 'Acme logo',
  textOnly: false,
  label: 'sponsored',
  newTab: true,
};

describe('SponsoredLabel', () => {
  it.each([
    ['sponsored', 'Sponsored'],
    ['sponsor_message', 'Sponsor message'],
    ['in_partnership_with', 'In partnership with'],
  ] as const)('shows %s as words', (label, text) => {
    render(<SponsoredLabel label={label} name="Acme" />);
    expect(screen.getByText(text)).toBeTruthy();
  });
});

describe.each([
  ['SponsorBanner', SponsorBanner],
  ['SponsorCard', SponsorCard],
  ['SponsorMessageCard', SponsorMessageCard],
])('%s', (_name, Component) => {
  it('always shows the label and the sponsor name', () => {
    render(<Component sponsor={base} />);
    expect(screen.getByText('Sponsored')).toBeTruthy();
    expect(screen.getAllByText(/Acme/).length).toBeGreaterThan(0);
  });
  it('links through our own redirect, new tab with noopener and sponsored rel', () => {
    render(<Component sponsor={base} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(base.href);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('sponsored noopener noreferrer');
  });
  it('stays in the tab when the setting says so', () => {
    render(<Component sponsor={{ ...base, newTab: false }} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBe('sponsored noopener noreferrer');
  });
  it('carries the data the tracker needs', () => {
    const { container } = render(<Component sponsor={base} />);
    const el = container.querySelector('[data-creative]') as HTMLElement;
    expect(el.dataset.creative).toBe(base.creativeId);
    expect(el.dataset.slot).toBe(base.slot);
  });
  it('draws no picture in text only mode', () => {
    const { container } = render(
      <Component sponsor={{ ...base, imageUrl: null, textOnly: true }} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Learn with Acme')).toBeTruthy();
  });
  it('gives the picture its alt text or hides it as decoration', () => {
    const { container, rerender } = render(<Component sponsor={base} />);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Acme logo');
    rerender(<Component sponsor={{ ...base, altText: null }} />);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
