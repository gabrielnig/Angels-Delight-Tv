// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '@ad/theme/settings';
import type { SiteSettingsDto } from '@/lib/data/admin/site-types';
import { ToastProvider } from '../Toast';
import { DiscoveryTab } from './DiscoveryTab';

const data: SiteSettingsDto = {
  values: { ...defaultSettings() },
  checklist: [],
  pages: {} as SiteSettingsDto['pages'],
  canChangeFlags: true,
};

describe('Discovery tab switches (S137, R30)', () => {
  it('names every switch and lists the four share channels and the indexing and notice switches', async () => {
    render(
      <ToastProvider>
        <DiscoveryTab data={data} actions={{ update: vi.fn() }} onSaved={vi.fn()} />
      </ToastProvider>,
    );
    const names = screen.getAllByRole('switch').map((el) => el.getAttribute('aria-label'));
    expect(names).toEqual(
      expect.arrayContaining(['WhatsApp', 'Facebook', 'X', 'Email', 'Storage notice']),
    );
    expect(names.some((n) => /search engines/i.test(n ?? ''))).toBe(true);
    for (const el of screen.getAllByRole('switch')) {
      expect(el.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Kids only titles are never listed by search engines.')).toBeInTheDocument();
    expect(screen.getByText('Copy link is always on')).toBeInTheDocument();
    await userEvent.setup().tab();
  });

  it('keeps the 44 px hit area on the control, not the track', () => {
    const css = readFileSync(resolve(__dirname, '../admin.css'), 'utf8');
    const rule = /\.adm-switch\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/min-height:\s*var\(--touch-target\)/);
    const tokens = readFileSync(resolve(__dirname, '../../../../../../packages/ui/src/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--touch-target:\s*2\.75rem|--touch-target:\s*44px/);
  });
});
