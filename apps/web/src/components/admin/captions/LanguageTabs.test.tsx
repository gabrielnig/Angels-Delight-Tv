// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageTabs } from './LanguageTabs';

const tabs = [
  { language: 'en', state: 'approved' as const },
  { language: 'yo', state: 'needs_review' as const },
];

describe('LanguageTabs (M46-S15)', () => {
  it('renders one link per language with the current one marked', () => {
    render(<LanguageTabs videoId="v1" tabs={tabs} current="yo" spoken="en" />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['English, spoken', 'Yoruba, Needs review']);
    expect(links[1]!.getAttribute('aria-current')).toBe('page');
    expect(links[0]!.getAttribute('href')).toBe('/admin/captions/v1');
    expect(links[1]!.getAttribute('href')).toBe('/admin/captions/v1?lang=yo');
  });

  it('links are at least 44px tall by class and the nav is named', () => {
    render(<LanguageTabs videoId="v1" tabs={tabs} current="en" spoken="en" />);
    expect(screen.getByRole('navigation', { name: 'Caption languages' })).toBeTruthy();
    for (const a of screen.getAllByRole('link')) expect(a.className).toContain('adm-langtab');
  });

  it('renders nothing when only the spoken language exists', () => {
    const { container } = render(<LanguageTabs videoId="v1" tabs={[tabs[0]!]} current="en" spoken="en" />);
    expect(container.textContent).toBe('');
  });
});
