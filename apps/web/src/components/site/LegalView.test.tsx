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
    expect(screen.getByText(/Last updated 17 Nov 2026/)).toBeTruthy();
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
});
