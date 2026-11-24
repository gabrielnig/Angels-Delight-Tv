// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CaptionRow } from '@/lib/data/admin/services';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/captions',
}));

const { CaptionList } = await import('./CaptionList');
const { ToastProvider } = await import('./Toast');

const row = (id: string, over: Partial<CaptionRow> = {}): CaptionRow => ({
  videoId: id,
  title: `Video ${id}`,
  state: 'approved',
  language: 'English',
  cueCount: 10,
  lastEditedBy: 'Tunde',
  lastEditedAt: '2026-11-16T09:00:00Z',
  warnings: 0,
  untouchedAuto: false,
  ...over,
});

const render_ = (rows: CaptionRow[], languages?: string[], activeLanguage?: string) =>
  render(
    <ToastProvider>
      <CaptionList
        rows={rows}
        counts={{ all: rows.length }}
        now={Date.parse('2026-11-17T09:00:00Z')}
        role="editor"
        approve={vi.fn()}
        languages={languages}
        activeLanguage={activeLanguage}
      />
    </ToastProvider>,
  );

describe('CaptionList language filter (M46-S15)', () => {
  it('offers no language filter when no video has a translation', () => {
    render_([row('a')], []);
    expect(screen.queryByRole('navigation', { name: 'Filter by language' })).toBeNull();
  });

  it('lists the languages that exist with links that keep the page', () => {
    render_([row('a')], ['ha', 'yo'], 'yo');
    const nav = screen.getByRole('navigation', { name: 'Filter by language' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['All languages', 'Hausa', 'Yoruba']);
    expect(links[2]!.getAttribute('aria-current')).toBe('true');
    expect(links[1]!.getAttribute('href')).toBe('/admin/captions?lang=ha');
    expect(links[0]!.getAttribute('href')).toBe('/admin/captions');
  });

  it('state links keep the chosen language', () => {
    render_([row('a')], ['yo'], 'yo');
    const nav = screen.getByRole('navigation', { name: 'Filter by caption state' });
    expect(within(nav).getByRole('link', { name: /Needs review/ }).getAttribute('href')).toBe(
      '/admin/captions?state=needs_review&lang=yo',
    );
  });
});
