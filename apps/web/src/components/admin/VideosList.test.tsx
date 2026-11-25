// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seedStore } from '@/lib/data/admin/store';
import { queryVideos } from '@/lib/data/admin/video-queries';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/admin/videos',
}));

const { VideosList } = await import('./VideosList');
const { ToastProvider } = await import('./Toast');
const { MaturityLabelsProvider } = await import('@/lib/maturity-context');
const NOW = Date.parse('2026-11-17T09:00:00Z');
const store = seedStore(NOW);
const page = queryVideos(store.videos, { limit: 5 });

function setup(
  over: Partial<Parameters<typeof VideosList>[0]> = {},
  labels: string[] | null = null,
) {
  const bulk = vi.fn(async (_ids: string[], _action: unknown, _bulkId: string) => ({
    succeeded: ['a'],
    failed: [{ id: page.items[1]!.id, reason: 'Not ready: Poster needs attention first.' }],
  }));
  const undo = vi.fn(async () => ({ succeeded: ['a'], failed: [] }));
  const matching = vi.fn(async () => Array.from({ length: 48 }, (_, i) => `m-${i}`));
  render(
    <MaturityLabelsProvider labels={labels}>
      <ToastProvider>
        <VideosList
          page={page}
          query={{}}
          categories={store.categories}
          role="admin"
          bulk={bulk}
          undo={undo}
          matching={matching}
          now={NOW}
          {...over}
        />
      </ToastProvider>
    </MaturityLabelsProvider>,
  );
  return { bulk, undo, matching };
}

const pick = async (count: number) => {
  for (const item of page.items.slice(0, count)) {
    await userEvent.click(screen.getAllByRole('checkbox', { name: `Select ${item.title}` })[0]!);
  }
};

describe('VideosList bulk maturity rating (M44-S13)', () => {
  it('sets the rating for the selection from the five labels', async () => {
    const { bulk } = setup();
    await pick(2);
    await userEvent.click(screen.getByRole('button', { name: 'Set maturity rating' }));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText('Maturity rating');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a rating', 'G', 'PG', '12', '15', '18']);
    await userEvent.selectOptions(select, '15');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(bulk).toHaveBeenCalledWith(
      page.items.slice(0, 2).map((v) => v.id),
      { type: 'maturity', value: 3 },
      expect.any(String),
    );
  });

  it('uses the configured labels', async () => {
    setup({}, ['All', '7+', '13+', '16+', '18+']);
    await pick(1);
    await userEvent.click(screen.getByRole('button', { name: 'Set maturity rating' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('option', { name: '16+' })).toBeInTheDocument();
  });

  it('is disabled with a reason for a role that cannot edit', async () => {
    setup({ role: 'support' as never });
    await pick(1);
    expect(screen.getAllByRole('button', { name: 'Set maturity rating' })[0]).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('VideosList captions for viewers', () => {
  it('is offered to admins and disabled with a reason for editors', async () => {
    setup({ role: 'editor' });
    await pick(1);
    const button = screen.getAllByRole('button', { name: 'Captions for viewers' })[0]!;
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Only an admin can change captions for viewers.')).toBeInTheDocument();
  });

  it('Off in bulk needs one reason and sends it with the choice', async () => {
    const { bulk } = setup();
    await pick(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Captions for viewers' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Captions'), 'off');
    const apply = within(dialog).getByRole('button', { name: 'Apply' });
    expect(apply).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'No spoken words');
    await userEvent.click(apply);
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(bulk).toHaveBeenCalledWith(
      page.items.slice(0, 2).map((v) => v.id),
      { type: 'captions_available', value: false, reason: 'No spoken words' },
      expect.any(String),
    );
  });

  it('On and Follow site default need no reason', async () => {
    const { bulk } = setup();
    await pick(1);
    await userEvent.click(screen.getAllByRole('button', { name: 'Captions for viewers' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Captions'), 'default');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(bulk).toHaveBeenCalledWith(
        [page.items[0]!.id],
        { type: 'captions_available', value: null },
        expect.any(String),
      ),
    );
  });

  it('reports a failure per video after switching off', async () => {
    const bulk = vi.fn(async () => ({
      succeeded: ['a'],
      failed: [{ id: page.items[1]!.id, reason: 'That video no longer exists.' }],
    }));
    setup({ bulk });
    await pick(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Captions for viewers' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Captions'), 'on');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('That video no longer exists.')).toBeInTheDocument();
  });
});

describe('VideosList', () => {
  it('shows rows and keeps the bulk bar hidden until something is selected', async () => {
    setup();
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
    const [first] = screen.getAllByRole('checkbox', { name: `Select ${page.items[0]!.title}` });
    await userEvent.click(first!);
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('1 selected');
  });

  it('reports partial failure with a reason per video', async () => {
    const { bulk } = setup();
    for (const item of page.items.slice(0, 2)) {
      await userEvent.click(screen.getAllByRole('checkbox', { name: `Select ${item.title}` })[0]!);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish 2' }));
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(bulk).toHaveBeenCalledWith(
      page.items.slice(0, 2).map((v) => v.id),
      { type: 'publish' },
      expect.any(String),
    );
    await waitFor(() =>
      expect(screen.getAllByText(/1 could not be changed/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/Poster needs attention first/)).toBeInTheDocument();
  });

  it('partial failure shows the report with Retry on retryable ones', async () => {
    const bulk = vi.fn(async (_ids: string[], _action: unknown, _bulkId: string) => ({
      succeeded: ['a'],
      failed: [
        {
          id: page.items[1]!.id,
          reason: 'Not ready: Poster needs attention first.',
          retryable: false,
        },
        { id: page.items[2]!.id, reason: 'Something went wrong.', retryable: true },
      ],
    }));
    setup({ bulk });
    await pick(3);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish 3' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Retry the 1 that failed' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry the 1 that failed' }));
    await waitFor(() => expect(bulk).toHaveBeenCalledTimes(2));
    expect(bulk.mock.calls[1]![0]).toEqual([page.items[2]!.id]);
    expect(bulk.mock.calls[1]![2]).toBe(bulk.mock.calls[0]![2]);
  });

  it('Publish asks for confirmation that states the count', async () => {
    const { bulk } = setup();
    await pick(3);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Publish 3 videos?' })).toBeInTheDocument();
    expect(bulk).not.toHaveBeenCalled();
  });

  it('Move to Trash needs typing the count when 5 or more are selected', async () => {
    const { bulk } = setup();
    await pick(5);
    await userEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    const dialog = await screen.findByRole('dialog');
    const go = within(dialog).getByRole('button', { name: 'Move to Trash' });
    expect(go).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(within(dialog).getByLabelText('Type 5 to confirm'), '5');
    await userEvent.click(go);
    await waitFor(() =>
      expect(bulk).toHaveBeenCalledWith(
        page.items.map((v) => v.id),
        { type: 'trash' },
        expect.any(String),
      ),
    );
  });

  it('undo after trash restores the same ids', async () => {
    const undoPayload = { label: 'Move to Trash', payload: [{ kind: 'restore', ids: ['a'] }] };
    const bulk = vi.fn(async (_ids: string[], _action: unknown, _bulkId: string) => ({
      succeeded: ['a'],
      failed: [],
      undo: undoPayload,
    }));
    const { undo } = setup({ bulk });
    await pick(1);
    await userEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Move to Trash' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undo).toHaveBeenCalledWith(undoPayload));
  });

  it('selecting a full page offers select all that match for Add to category but not for Publish', async () => {
    const { matching } = setup({ page: { ...page, total: 48 } });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all 48 that match' }));
    await waitFor(() => expect(matching).toHaveBeenCalled());
    expect(await screen.findByText('48 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: /Move to Trash/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Add to category' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('the count is announced', async () => {
    setup();
    await pick(2);
    expect(screen.getByText('2 selected')).toHaveAttribute('aria-live', 'polite');
  });

  it('confirms before moving to Trash and names the consequence', async () => {
    const { bulk } = setup();
    await userEvent.click(
      screen.getAllByRole('checkbox', { name: `Select ${page.items[0]!.title}` })[0]!,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Move to Trash' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/restore them for 30 days/)).toBeInTheDocument();
    expect(bulk).not.toHaveBeenCalled();
  });

  it('explains why an editor cannot trash', async () => {
    setup({ role: 'editor' });
    await userEvent.click(
      screen.getAllByRole('checkbox', { name: `Select ${page.items[0]!.title}` })[0]!,
    );
    const button = screen.getByRole('button', { name: /Move to Trash/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Only an admin can move videos to Trash.')).toBeInTheDocument();
  });

  it('shows the empty state and the no match state', () => {
    const empty = { items: [], total: 0, nextCursor: null };
    const { unmount } = render(
      <VideosList page={empty} query={{}} categories={[]} role="admin" bulk={vi.fn()} now={NOW} />,
    );
    expect(screen.getByText('No videos yet.')).toBeInTheDocument();
    unmount();
    render(
      <VideosList
        page={empty}
        query={{ q: 'zzz' }}
        categories={[]}
        role="admin"
        bulk={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('No videos match.');
  });

  it('pages with opaque cursors when the server pages by key', async () => {
    replace.mockClear();
    setup({
      page: { items: page.items, total: 5050, nextCursor: 'next-key', prevCursor: 'prev-key' },
      query: { cursor: 'this-key' },
    });
    expect(screen.getByText(`Showing ${page.items.length} of 5050 videos`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(replace).toHaveBeenLastCalledWith('/admin/videos?cursor=next-key');
    await userEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(replace).toHaveBeenLastCalledWith('/admin/videos?cursor=prev-key');
  });

  it('disables Previous on the first keyset page', () => {
    setup({ page: { items: page.items, total: 9, nextCursor: 'n', prevCursor: null } });
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('writes a filter into the URL', async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'failed');
    expect(replace).toHaveBeenCalledWith('/admin/videos?status=failed');
  });
});

describe('VideosList Add to series (M51-S04)', () => {
  const bundle = () => ({
    series: [{ id: 's1', title: 'Genesis', labels: { preset: 'book_chapter' as const } }],
    existing: vi.fn(async () => []),
    setEpisode: vi.fn(async () => ({ ok: true as const })),
    createSeries: vi.fn(async () => ({ ok: true as const, id: 'n' })),
  });

  it('is offered with a bundle and opens the dialog for the picked videos', async () => {
    setup({ bundle: bundle() });
    await pick(2);
    await userEvent.click(screen.getByRole('button', { name: 'Add to series' }));
    expect(await screen.findByRole('dialog', { name: 'Add 2 videos to a series' })).toBeInTheDocument();
  });

  it('is not offered without a bundle', async () => {
    setup();
    await pick(1);
    expect(screen.queryByRole('button', { name: 'Add to series' })).not.toBeInTheDocument();
  });

  it('says why it is off for a role that cannot manage series', async () => {
    setup({ bundle: bundle(), role: 'viewer' as never });
    await pick(1);
    expect(screen.getByRole('button', { name: 'Add to series' })).toHaveAttribute('aria-disabled', 'true');
  });
});
