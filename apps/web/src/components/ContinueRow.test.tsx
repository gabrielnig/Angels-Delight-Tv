// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { Progress, VideoSummary } from '../lib/data';
import { ContinueRow } from './CatalogCard';

vi.mock('../app/actions', () => ({
  restoreContinueAction: vi.fn(),
  removeContinueAction: vi.fn(),
}));

const video = (id: string, extra: Partial<VideoSummary> = {}): VideoSummary => ({
  kind: 'video',
  id,
  slug: `slug-${id}`,
  title: `Title ${id}`,
  description: 'd',
  durationSeconds: 1200,
  categorySlug: 'c',
  categoryName: 'C',
  hasCaptions: false,
  kidsSafe: true,
  publishedAt: '',
  ...extra,
});
const progress = (id: string, extra: Partial<Progress> = {}): Progress => ({
  videoId: id,
  positionSeconds: 300,
  durationSeconds: 1200,
  updatedAt: '2026-11-20T00:00:00.000Z',
  ...extra,
});

function setup(props: Partial<React.ComponentProps<typeof ContinueRow>> = {}) {
  const remove = vi.fn().mockResolvedValue(undefined);
  const restore = vi.fn().mockResolvedValue(undefined);
  render(
    <ToastProvider>
      <ContinueRow
        items={[
          { video: video('a'), progress: progress('a') },
          {
            video: video('b', { series: { slug: 'farming', title: 'Farming', season: 1, episode: 4 } }),
            progress: progress('b', { positionSeconds: 0, nextUp: true, episodeLabel: 'S1 E4' }),
          },
        ]}
        remove={remove}
        restore={restore}
        {...props}
      />
    </ToastProvider>,
  );
  return { remove, restore };
}

describe('Continue learning row (M44-S15)', () => {
  it('uses the configured row title and defaults to Continue learning', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Continue learning' })).toBeInTheDocument();
  });

  it('takes a curated row title', () => {
    setup({ title: 'Pick up where you left off' });
    expect(screen.getByRole('heading', { name: 'Pick up where you left off' })).toBeInTheDocument();
  });

  it('labels a next-up episode with Next: E4 and says it starts at the beginning', () => {
    setup();
    expect(screen.getAllByText('Next: E4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Starts at the beginning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('15 min left').length).toBeGreaterThan(0);
  });

  it('removes through the menu and offers Undo', async () => {
    const { remove, restore } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'More for Title a' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from row' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('a'));
    expect(screen.queryByRole('link', { name: /^Title a/ })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(restore).toHaveBeenCalledWith('a');
    expect(screen.getByRole('link', { name: /^Title a/ })).toBeInTheDocument();
  });

  it('links Go to title page to the series for an episode and the title otherwise', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'More for Title b' }));
    expect(screen.getByRole('menuitem', { name: 'Go to title page' })).toHaveAttribute(
      'href',
      '/series/farming',
    );
  });
});
