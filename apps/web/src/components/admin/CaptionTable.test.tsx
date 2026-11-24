// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CaptionRow } from '@/lib/data/admin/services';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/captions',
}));

const { CaptionTable } = await import('./CaptionTable');
const { ToastProvider } = await import('./Toast');
const NOW = Date.parse('2026-11-17T09:00:00Z');

const row = (id: string, over: Partial<CaptionRow> = {}): CaptionRow => ({
  videoId: id,
  title: `Video ${id}`,
  state: 'needs_review',
  language: 'English',
  cueCount: 40,
  lastEditedBy: 'Tunde',
  lastEditedAt: '2026-11-16T09:00:00Z',
  warnings: 0,
  untouchedAuto: false,
  ...over,
});

function setup(rows: CaptionRow[], role: 'admin' | 'editor' = 'admin') {
  const approve = vi.fn(async (ids: string[], _bulkId: string) => ({
    bulkId: 'b',
    succeeded: ids,
    failed: [],
    skipped: [],
  }));
  render(
    <ToastProvider>
      <CaptionTable rows={rows} role={role} approve={approve} now={NOW} />
    </ToastProvider>,
  );
  return { approve };
}
const pick = (title: string) =>
  userEvent.click(screen.getAllByRole('checkbox', { name: `Select ${title}` })[0]!);

describe('CaptionTable bulk approve', () => {
  it('approves only the rows that can be, and says how many are skipped', async () => {
    const { approve } = setup([
      row('a'),
      row('b'),
      row('c', { state: 'approved' }),
      row('d', { warnings: 3 }),
    ]);
    for (const id of ['a', 'b', 'c', 'd']) await pick(`Video ${id}`);
    expect(screen.getByText('2 will be skipped')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Approve 2' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/2 will be approved/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve 2' }));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve.mock.calls[0]![0]).toEqual(['a', 'b']);
  });

  it('needs a tick before approving captions nobody has opened', async () => {
    const { approve } = setup([row('a', { untouchedAuto: true }), row('b')]);
    await pick('Video a');
    await pick('Video b');
    await userEvent.click(screen.getByRole('button', { name: 'Approve 2' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Approve 2' });
    expect(confirm.getAttribute('aria-disabled') === 'true' || (confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(confirm);
    expect(approve).toHaveBeenCalledTimes(1);
  });

  it('shows why bulk approve is unavailable for an editor', async () => {
    setup([row('a')], 'editor');
    await pick('Video a');
    const button = screen.getByRole('button', { name: 'Approve 1' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Only an admin can approve captions in bulk.')).toBeTruthy();
  });

  it('lists skipped and failed rows in the report after a run', async () => {
    const approve = vi.fn(async () => ({
      bulkId: 'b',
      succeeded: ['a'],
      failed: [{ id: 'b', reason: 'Network hiccup' }],
      skipped: [{ id: 'c', reason: 'Has warnings. Open it to review.' }],
    }));
    render(
      <ToastProvider>
        <CaptionTable rows={[row('a'), row('b'), row('c')]} role="admin" approve={approve} now={NOW} />
      </ToastProvider>,
    );
    for (const id of ['a', 'b', 'c']) await pick(`Video ${id}`);
    await userEvent.click(screen.getByRole('button', { name: 'Approve 3' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve 3' }));
    expect(await screen.findByText('Has warnings. Open it to review.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
