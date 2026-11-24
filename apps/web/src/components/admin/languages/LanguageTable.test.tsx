// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LanguageRow } from '@/lib/i18n/admin-data';
import { LanguageTable } from './LanguageTable';

afterEach(cleanup);
const base: LanguageRow = {
  code: 'yo', endonym: 'Yorùbá', englishName: 'Yoruba', state: 'draft', percent: 40,
  missing: 12, stale: 2, inReview: 3, approved: 30, total: 100, canPublish: false,
  reason: '40 percent of core text is approved. Publishing needs 80 percent',
};
const rows: LanguageRow[] = [
  base,
  { ...base, code: 'ha', endonym: 'Hausa', englishName: 'Hausa', state: 'live', percent: 95, canPublish: true, reason: undefined },
  { ...base, code: 'ig', endonym: 'Igbo', englishName: 'Igbo', state: 'off', percent: 0, missing: 100, stale: 0 },
];
const setup = (over: Partial<Parameters<typeof LanguageTable>[0]> = {}) => {
  const props = { rows, canPublish: true, canOverride: false, onPublish: vi.fn(async () => ({ ok: true as const })), onUnpublish: vi.fn(async () => ({ ok: true as const })), ...over };
  render(<LanguageTable {...props} />);
  return props;
};

describe('LanguageTable', () => {
  it('shows one row per locale with state, percent, missing and stale', () => {
    setup();
    const yo = screen.getByRole('row', { name: /Yorùbá/ });
    expect(within(yo).getByText('Draft')).toBeTruthy();
    expect(within(yo).getByText('40%')).toBeTruthy();
    expect(within(yo).getByText('12')).toBeTruthy();
    expect(within(yo).getByText('2')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });
  it('Publish is disabled below the threshold with the reason', () => {
    setup();
    const yo = screen.getByRole('row', { name: /Yorùbá/ });
    expect(within(yo).getByRole('switch').hasAttribute('disabled')).toBe(true);
    expect(within(yo).getByText(/Publishing needs 80 percent/)).toBeTruthy();
  });
  it('status uses an icon and a word, not colour alone', () => {
    setup();
    const live = within(screen.getByRole('row', { name: /Hausa/ })).getByText('Live');
    expect(live.closest('.adm-badge')?.querySelector('svg')).toBeTruthy();
  });
  it('turning a live language off asks the service', async () => {
    const props = setup();
    await userEvent.click(within(screen.getByRole('row', { name: /Hausa/ })).getByRole('switch'));
    expect(props.onUnpublish).toHaveBeenCalledWith('ha');
  });
  it('a Super admin can override below the threshold with a reason', async () => {
    const props = setup({ canOverride: true });
    await userEvent.click(within(screen.getByRole('row', { name: /Yorùbá/ })).getByRole('button', { name: /publish anyway/i }));
    await userEvent.type(screen.getByLabelText(/reason/i), 'Launch demo');
    await userEvent.click(screen.getByRole('button', { name: /^publish$/i }));
    expect(props.onPublish).toHaveBeenCalledWith('yo', { reason: 'Launch demo' });
  });
  it('tells the reader only English is live when nothing is published', () => {
    setup({ rows: rows.map((r) => ({ ...r, state: r.state === 'live' ? 'draft' : r.state })) });
    expect(screen.getByText(/only English is live/i)).toBeTruthy();
  });
  it('links each language to its workspace and exports', () => {
    setup();
    const yo = screen.getByRole('row', { name: /Yorùbá/ });
    expect(within(yo).getByRole('link', { name: /translate/i }).getAttribute('href')).toBe('/admin/languages/yo');
    expect(within(yo).getByRole('link', { name: /export/i }).getAttribute('href')).toContain('/api/admin/languages/yo/export');
  });
});
