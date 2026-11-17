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
const NOW = Date.parse('2026-11-17T09:00:00Z');
const store = seedStore(NOW);
const page = queryVideos(store.videos, { limit: 5 });

function setup(over: Partial<Parameters<typeof VideosList>[0]> = {}) {
  const bulk = vi.fn(async () => ({
    succeeded: ['a'],
    failed: [{ id: page.items[1]!.id, reason: 'Not ready: Poster needs attention first.' }],
  }));
  render(
    <VideosList
      page={page}
      query={{}}
      categories={store.categories}
      role="admin"
      bulk={bulk}
      now={NOW}
      {...over}
    />,
  );
  return { bulk };
}

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
    expect(bulk).toHaveBeenCalledWith(
      page.items.slice(0, 2).map((v) => v.id),
      { type: 'publish' },
    );
    await waitFor(() => expect(screen.getByText(/1 could not be changed/)).toBeInTheDocument());
    expect(screen.getByText(/Poster needs attention first/)).toBeInTheDocument();
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
    expect(button).toHaveTextContent('Only an admin can move videos to Trash.');
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

  it('writes a filter into the URL', async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'failed');
    expect(replace).toHaveBeenCalledWith('/admin/videos?status=failed');
  });
});
