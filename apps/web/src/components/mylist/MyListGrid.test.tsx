// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { CatalogItem, Page } from '../../lib/data';
import { MyListGrid } from './MyListGrid';

const video = (n: number): CatalogItem => ({
  kind: 'video',
  id: `v${n}`,
  slug: `video-${n}`,
  title: `Video ${n}`,
  description: 'd',
  durationSeconds: 240,
  categorySlug: 'science',
  categoryName: 'Science',
  hasCaptions: true,
  kidsSafe: true,
  publishedAt: '2026-11-01T00:00:00.000Z',
});

const setup = (props: Partial<React.ComponentProps<typeof MyListGrid>> = {}) => {
  const remove = vi.fn().mockResolvedValue(undefined);
  const add = vi.fn().mockResolvedValue(undefined);
  render(
    <ToastProvider>
      <MyListGrid
        initialItems={[video(1), video(2)]}
        total={2}
        nextCursor={null}
        hiddenCount={0}
        remove={remove}
        add={add}
        loadMore={vi.fn()}
        {...props}
      />
    </ToastProvider>,
  );
  return { remove, add };
};

describe('MyListGrid', () => {
  it('shows the empty state with a way to browse', () => {
    setup({ initialItems: [], total: 0 });
    expect(screen.getByText('Your list is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/browse');
  });

  it('removes a card straight away and offers Undo that puts it back', async () => {
    const user = userEvent.setup();
    const { remove, add } = setup();
    await user.click(screen.getAllByRole('button', { name: /My List/ })[0]!);
    expect(remove).toHaveBeenCalledWith('video:v1');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(add).toHaveBeenCalledWith('video:v1');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
  });

  it('keeps the card and reports when removing fails', async () => {
    const user = userEvent.setup();
    setup({ remove: vi.fn().mockRejectedValue(new Error('x')) });
    await user.click(screen.getAllByRole('button', { name: /My List/ })[0]!);
    expect(await screen.findByText('We could not update My List. Try again.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('explains hidden items for the current profile', () => {
    setup({ hiddenCount: 3 });
    expect(screen.getByText('3 items are hidden in this profile.')).toBeInTheDocument();
  });

  it('loads more', async () => {
    const user = userEvent.setup();
    const loadMore = vi
      .fn<(c: string) => Promise<Page<CatalogItem>>>()
      .mockResolvedValue({ items: [video(3)], total: 3, nextCursor: null });
    setup({ total: 3, nextCursor: '2', loadMore });
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
  });
});
