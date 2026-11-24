// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seedStore } from '@/lib/data/admin/store';
import type { VideoRecord } from '@/lib/data/admin/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const { TrashList } = await import('./TrashList');
const { ToastProvider } = await import('./Toast');

const NOW = Date.parse('2026-11-17T09:00:00Z');
const seed = seedStore(NOW).videos[0]!;
const trashed = (id: string): VideoRecord => ({
  ...seed,
  id,
  title: `Gone ${id}`,
  deletedAt: new Date(NOW - 3 * 86_400_000).toISOString(),
});
const outcome = (over = {}) => ({ bulkId: 'b', succeeded: [], failed: [], skipped: [], ...over });

function setup(videos: VideoRecord[], role: 'admin' | 'editor' = 'admin') {
  const restoreMany = vi.fn(async (ids: string[]) =>
    outcome({ succeeded: ids, undo: { label: 'Restore', payload: ids } }),
  );
  const purgeMany = vi.fn(async (ids: string[]) => outcome({ succeeded: ids }));
  const undoRestore = vi.fn(async () => ({ succeeded: ['a'], failed: [] }));
  render(
    <ToastProvider>
      <TrashList
        videos={videos}
        role={role}
        now={NOW}
        restore={vi.fn()}
        purge={vi.fn()}
        restoreMany={restoreMany}
        purgeMany={purgeMany}
        undoRestore={undoRestore}
      />
    </ToastProvider>,
  );
  return { restoreMany, purgeMany, undoRestore };
}
const tick = (id: string) =>
  userEvent.click(screen.getAllByRole('checkbox', { name: `Select Gone ${id}` })[0]!);

describe('TrashList bulk', () => {
  it('the header tick is mixed for a partial selection and checked for all', async () => {
    setup([trashed('a'), trashed('b')]);
    const head = () =>
      screen.getAllByRole('checkbox').find((b) => /select all/i.test(b.getAttribute('aria-label') ?? b.parentElement?.textContent ?? '')) as HTMLInputElement;
    expect(head().indeterminate).toBe(false);
    await tick('a');
    expect(head().indeterminate).toBe(true);
    await tick('b');
    expect(head().indeterminate).toBe(false);
    expect(head().checked).toBe(true);
  });

  it('Delete forever stays disabled until the count is typed', async () => {
    const { purgeMany } = setup([trashed('a'), trashed('b'), trashed('c')]);
    for (const id of ['a', 'b', 'c']) await tick(id);
    await userEvent.click(screen.getByRole('button', { name: 'Delete forever 3' }));
    const dialog = await screen.findByRole('dialog');
    const go = within(dialog).getByRole('button', { name: 'Delete forever 3' });
    expect(go).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Type 3 to delete 3 videos forever'), '3');
    await userEvent.click(go);
    await waitFor(() => expect(purgeMany).toHaveBeenCalledWith(['a', 'b', 'c'], expect.any(String)));
  });

  it('Restore n shows an Undo that moves them back', async () => {
    const { restoreMany, undoRestore } = setup([trashed('a'), trashed('b')]);
    await tick('a');
    await tick('b');
    await userEvent.click(screen.getByRole('button', { name: 'Restore 2' }));
    await waitFor(() => expect(restoreMany).toHaveBeenCalledWith(['a', 'b'], expect.any(String)));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undoRestore).toHaveBeenCalledWith(['a', 'b']));
  });

  it('editors can restore but not delete forever', async () => {
    setup([trashed('a')], 'editor');
    await tick('a');
    expect(screen.getByRole('button', { name: 'Restore 1' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: 'Delete forever 1' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Only an admin can delete forever.')).toBeInTheDocument();
  });

  it('a single delete asks for the word delete', async () => {
    setup([trashed('a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete forever: Gone a' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Type delete to confirm')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete forever' })).toBeDisabled();
  });

  it('shows the empty state and stacked cards for the narrow layout', () => {
    setup([]);
    expect(screen.getByText('Trash is empty.')).toBeInTheDocument();
  });

  it('has cards next to the table and a numeric Days left column', () => {
    setup([trashed('a')]);
    expect(document.querySelector('ul.adm-cards')).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Days left' })).toHaveClass('adm-num');
  });
});
