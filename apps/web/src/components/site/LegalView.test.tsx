// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LegalView } from './LegalView';

const base = {
  slug: 'terms' as const,
  title: 'Terms of use',
  updated: '17 Nov 2026',
  readingMinutes: 2,
};

describe('LegalView', () => {
  it('shows the last updated date and a contents list that links to the headings', () => {
    render(
      <LegalView
        page={{
          ...base,
          draft: false,
          sections: [{ id: 'rules', heading: 'Rules', body: [] }],
          html: '<h2 id="rules">Rules</h2><p>Be kind.</p>',
        }}
      />,
    );
    expect(screen.getByText('Last updated 17 Nov 2026. Reading time 2 min.')).toBeTruthy();
    expect(screen.getByText('On this page')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Rules' });
    expect(link.getAttribute('href')).toBe('#rules');
    expect(screen.getByText('Be kind.')).toBeTruthy();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('marks a draft page clearly', () => {
    render(<LegalView page={{ ...base, draft: true, sections: [] }} />);
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  it('omits the contents list when the page has no headings', () => {
    render(<LegalView page={{ ...base, draft: false, sections: [], html: '<p>Hi</p>' }} />);
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
  });

  it('draws About as a headline, a lead and one card per section', () => {
    const { container } = render(
      <LegalView
        page={{
          ...base,
          slug: 'about',
          title: 'Learning that is free and easy to follow',
          lead: 'Angels Delight TV shares short, clear video lessons.',
          draft: false,
          sections: [
            { id: 'free', heading: 'Free to watch', body: ['No fees and no adverts.'] },
            { id: 'data', heading: 'Light on data', body: ['Video adapts to your network.'] },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Learning that is free and easy to follow',
    );
    expect(screen.getByText('Angels Delight TV shares short, clear video lessons.')).toBeTruthy();
    expect(container.querySelectorAll('.acct-card')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Free to watch' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
    expect(screen.queryByText(/Last updated/)).toBeNull();
  });
});
