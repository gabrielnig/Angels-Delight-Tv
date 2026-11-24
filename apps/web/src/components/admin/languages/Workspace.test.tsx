// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceRow } from '@/lib/i18n/admin-data';
import { Workspace } from './Workspace';

afterEach(cleanup);
const row = (over: Partial<WorkspaceRow>): WorkspaceRow => ({
  key: 'nav.home', area: 'nav', english: 'Home', text: null, status: 'missing', note: null, placeholders: [], categories: [], ...over,
});
const rows: WorkspaceRow[] = [
  row({}),
  row({ key: 'nav.browse', english: 'Browse {name}', text: 'Wá {name}', status: 'in_review', placeholders: ['name'] }),
  row({ key: 'player.play', area: 'player', english: 'Play', text: 'Ṣe', status: 'approved' }),
  row({ key: 'player.count', area: 'player', english: { one: '{count} video', other: '{count} videos' }, text: null, status: 'missing', placeholders: ['count'], categories: ['other'] }),
  row({ key: 'nav.old', english: 'Old', text: 'Àtijọ́', status: 'stale' }),
];
const locale = { code: 'yo', endonym: 'Yorùbá', englishName: 'Yoruba' };
const setup = (over: Partial<Parameters<typeof Workspace>[0]> = {}) => {
  const props = {
    locale, rows, canApprove: true,
    onSave: vi.fn(async () => ({ ok: true as const, warnings: [] as string[] })),
    onApprove: vi.fn(async (keys: string[]) => ({ approved: keys.length, skipped: [] as { key: string; reason: string }[] })),
    ...over,
  };
  render(<Workspace {...props} />);
  return props;
};
const showAll = () => userEvent.click(screen.getByRole('tab', { name: /^All/ }));
const rowOf = (key: string) => screen.getByTestId(`row-${key}`);

describe('Workspace', () => {
  it('filters Missing, Stale, In review and Approved', async () => {
    setup();
    await userEvent.click(screen.getByRole('tab', { name: /^Missing/ }));
    expect(screen.getAllByTestId(/^row-/).map((e) => e.getAttribute('data-testid'))).toEqual(['row-nav.home', 'row-player.count']);
    await userEvent.click(screen.getByRole('tab', { name: /^Stale/ }));
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(1);
    await userEvent.click(screen.getByRole('tab', { name: /^In review/ }));
    expect(screen.getByTestId('row-nav.browse')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /^Approved/ }));
    expect(screen.getByTestId('row-player.play')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /^All/ }));
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(5);
  });
  it('searches on key and text', async () => {
    setup();
    await showAll();
    await userEvent.type(screen.getByRole('searchbox'), 'browse');
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(1);
  });
  it('typing marks the row dirty and Save is enabled', async () => {
    const props = setup();
    const r = rowOf('nav.home');
    const save = within(r).getByRole('button', { name: /^save/i });
    expect(save.hasAttribute('disabled')).toBe(true);
    await userEvent.type(within(r).getByRole('textbox'), 'Ilé');
    expect(save.hasAttribute('disabled')).toBe(false);
    await userEvent.click(save);
    expect(props.onSave).toHaveBeenCalledWith('nav.home', 'Ilé');
  });
  it('validation errors appear under the field with aria-describedby', async () => {
    setup();
    await showAll();
    const r = rowOf('nav.browse');
    const box = within(r).getByRole('textbox');
    await userEvent.clear(box);
    await userEvent.type(box, 'Wá');
    const err = within(r).getByRole('alert');
    expect(err.textContent).toMatch(/placeholder \{name\}/);
    expect(box.getAttribute('aria-describedby')).toContain(err.id);
    expect(within(r).getByRole('button', { name: /^save/i }).hasAttribute('disabled')).toBe(true);
  });
  it('Copy English fills the field', async () => {
    setup();
    const r = rowOf('nav.home');
    await userEvent.click(within(r).getByRole('button', { name: /copy english/i }));
    expect((within(r).getByRole('textbox') as HTMLTextAreaElement).value).toBe('Home');
  });
  it("plural rows show only the locale's categories", () => {
    setup();
    const boxes = within(rowOf('player.count')).getAllByRole('textbox');
    expect(boxes).toHaveLength(1);
    expect(within(rowOf('player.count')).getByText(/other/i)).toBeTruthy();
  });
  it('shows placeholders as chips', async () => {
    setup();
    await showAll();
    expect(within(rowOf('nav.browse')).getByText('{name}')).toBeTruthy();
  });
  it('approve and bulk approve are Admin only', async () => {
    setup({ canApprove: false });
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
  });
  it('bulk approve shows the count and a warning when rows have warnings', async () => {
    const long = row({ key: 'nav.long', english: 'Hi', text: 'x'.repeat(40), status: 'in_review' });
    const props = setup({ rows: [rows[1]!, long] });
    await showAll();
    await userEvent.click(screen.getByRole('checkbox', { name: /select nav.browse/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /select nav.long/i }));
    expect(screen.getByText(/2 selected/)).toBeTruthy();
    expect(screen.getByText(/1 has a length warning/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /approve 2/i }));
    expect(props.onApprove).toHaveBeenCalledWith(['nav.browse', 'nav.long']);
  });
  it('reports skipped rows after a bulk approve', async () => {
    setup({
      rows: [rows[1]!],
      onApprove: vi.fn(async () => ({ approved: 0, skipped: [{ key: 'nav.browse', reason: 'missing placeholder {name}' }] })),
    });
    await showAll();
    await userEvent.click(screen.getByRole('checkbox', { name: /select nav.browse/i }));
    await userEvent.click(screen.getByRole('button', { name: /approve 1/i }));
    expect(await screen.findByText(/skipped 1/i)).toBeTruthy();
  });
  it('shows the missing key tab when hits are given', () => {
    setup({ missingHits: [{ key: 'nav.home', hits: 40, lastSeen: '2026-11-20' }] });
    expect(screen.getByRole('tab', { name: /Viewer hits/ })).toBeTruthy();
  });
});
