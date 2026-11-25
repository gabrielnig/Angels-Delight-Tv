// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { videoStub } from '@/lib/data/admin/video-rules';
import type { SeriesDetail } from '@/lib/data/admin/services';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const { SeriesEditor } = await import('./SeriesEditor');
const { ToastProvider } = await import('./Toast');

const episode = (id: string, maturityRank: number | null) =>
  videoStub({
    id,
    title: `Episode ${id}`,
    seriesId: 's1',
    seasonNumber: 1,
    episodeNumber: 1,
    maturityRank,
  });

const detail = (rank: number | null, ranks: Array<number | null>): SeriesDetail => ({
  series: {
    id: 's1',
    title: 'Everyday Science',
    description: 'x',
    posterId: null,
    published: false,
    maturityRank: rank,
  },
  episodes: ranks.map((r, i) => episode(`e${i}`, r)),
  available: [],
});

function setup(d: SeriesDetail) {
  const update = vi.fn(async (_id: string, _patch: unknown) => ({ ok: true as const }));
  render(
    <ToastProvider>
      <SeriesEditor
        detail={d}
        canManage
        actions={{ update, remove: vi.fn(), setEpisode: vi.fn() } as never}
      />
    </ToastProvider>,
  );
  return { update };
}

describe('SeriesEditor maturity rating (S127)', () => {
  it('shows the series rating with the five labels and the helper line', () => {
    setup(detail(2, [2, 2]));
    const select = screen.getByLabelText('Maturity rating (required)');
    expect(select).toHaveValue('2');
    expect(within(select).getAllByRole('option')).toHaveLength(6);
    expect(
      screen.getByText(
        /Episodes keep their own rating\. A profile sees only the episodes within its limit\./,
      ),
    ).toBeInTheDocument();
  });

  it('saves a new series rating without touching episodes', async () => {
    const { update } = setup(detail(null, [1]));
    await userEvent.selectOptions(screen.getByLabelText('Maturity rating (required)'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('s1', {
      title: 'Everyday Science',
      description: 'x',
      maturityRank: 2,
    });
  });

  it('confirms before applying to all episodes and names how many change', async () => {
    const { update } = setup(detail(2, [2, 3, 3, 2]));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to all 4 episodes' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Apply 12 to all 4 episodes\?/)).toBeInTheDocument();
    expect(within(dialog).getByText(/including 2 that are rated 15 today/)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply to 4 episodes' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('s1', { maturityRank: 2, applyToEpisodes: true }),
    );
  });

  it('keeps episode ratings when asked', async () => {
    const { update } = setup(detail(2, [3]));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to all 1 episode' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep episode ratings' }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no apply button until the series is rated or when it has no episodes', () => {
    setup(detail(null, [1]));
    expect(screen.queryByRole('button', { name: /Apply to all/ })).toBeNull();
  });
});

describe('SeriesEditor names (M51)', () => {
  const withLabels = (labels: object, override: object | null = null): SeriesDetail => {
    const d = detail(2, [2]);
    return { ...d, series: { ...d.series, labels, labelOverride: override } } as SeriesDetail;
  };

  it('words the headings, buttons and number fields with the series words', () => {
    setup(withLabels({ preset: 'book_chapter' }));
    expect(screen.getByRole('heading', { name: 'Chapters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add chapter' })).toBeInTheDocument();
    expect(screen.getByLabelText('Book')).toBeInTheDocument();
    expect(screen.getByLabelText('Chapter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to all 1 chapter' })).toBeInTheDocument();
  });

  it('keeps the default words when the series has no labels', () => {
    setup(detail(2, [2]));
    expect(screen.getByRole('heading', { name: 'Episodes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Season')).toBeInTheDocument();
  });

  it('saves an own name set and goes back to the site names', async () => {
    const { update } = setup(withLabels({ preset: 'season_episode' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Use names for this series only' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Name set' }), 'part_lesson');
    await userEvent.click(screen.getByRole('button', { name: 'Save names' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('s1', { labels: { preset: 'part_lesson' } }));
  });

  it('clears the override with the site names option', async () => {
    const { update } = setup(withLabels({ preset: 'part_lesson' }, { preset: 'part_lesson' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Use the site names' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save names' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('s1', { labels: null }));
  });

  it('names the field when a custom word is missing and saves nothing', async () => {
    const { update } = setup(withLabels({ preset: 'season_episode' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Use names for this series only' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Name set' }), 'custom');
    await userEvent.click(screen.getByRole('button', { name: 'Save names' }));
    expect((await screen.findAllByText('Enter this word')).length).toBeGreaterThan(0);
    expect(update).not.toHaveBeenCalled();
  });
});
