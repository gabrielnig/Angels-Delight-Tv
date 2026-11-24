// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SeriesRow } from '@/lib/data/admin/services';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const { SeriesList } = await import('./SeriesList');
const { ToastProvider } = await import('./Toast');

const row = (id: string, published = false): SeriesRow => ({
  id,
  title: `Series ${id}`,
  description: '',
  posterId: null,
  published,
  episodeCount: 3,
});
const outcome = (over = {}) => ({ bulkId: 'b', succeeded: [], failed: [], skipped: [], ...over });

function setup(role: 'admin' | 'editor' = 'admin', rows = [row('a'), row('b'), row('c')]) {
  const bulk = vi.fn(async (ids: string[], _action: unknown, _bulkId: string) =>
    outcome({ succeeded: ids, undo: { label: 'Publish series', payload: [] } }),
  );
  const undo = vi.fn(async () => ({ succeeded: ['a'], failed: [] }));
  render(
    <ToastProvider>
      <SeriesList series={rows} canManage role={role} create={vi.fn()} bulk={bulk} undo={undo} />
    </ToastProvider>,
  );
  return { bulk, undo };
}
const tick = (id: string) =>
  userEvent.click(screen.getByRole('checkbox', { name: `Select Series ${id}` }));

describe('SeriesList bulk', () => {
  it('cards have checkboxes and the bar appears with the actions', async () => {
    setup();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
    await tick('a');
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('publish runs on the selection and offers Undo', async () => {
    const { bulk, undo } = setup();
    await tick('a');
    await tick('b');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(bulk).toHaveBeenCalledWith(['a', 'b'], { type: 'publish' }, expect.any(String)),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undo).toHaveBeenCalled());
  });

  it('Delete needs the count typed and says the videos stay', async () => {
    const { bulk } = setup();
    await tick('a');
    await tick('b');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        'The series and its seasons are removed. The videos stay in the library as single videos.',
      ),
    ).toBeInTheDocument();
    const go = within(dialog).getByRole('button', { name: 'Delete 2 series' });
    expect(go).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Type 2 to confirm'), '2');
    await userEvent.click(go);
    await waitFor(() =>
      expect(bulk).toHaveBeenCalledWith(['a', 'b'], { type: 'delete' }, expect.any(String)),
    );
  });

  it('editors see Delete disabled with a reason', async () => {
    setup('editor');
    await tick('a');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Only an admin can delete a series.')).toBeInTheDocument();
  });
});
