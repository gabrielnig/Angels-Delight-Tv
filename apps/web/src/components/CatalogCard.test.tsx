// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { MaturityLabelsProvider } from '../lib/maturity-context';
import { ProfileIdProvider, ProfileKidsProvider } from '../lib/profile-context';
import type { CatalogItem } from '../lib/data';
import { CatalogCard } from './CatalogCard';

vi.mock('../app/actions', () => ({
  restoreContinueAction: vi.fn(),
  removeContinueAction: vi.fn(),
}));

const video: CatalogItem = {
  kind: 'video',
  id: 'v1',
  slug: 'sky',
  title: 'Why the sky is blue',
  description: 'Light',
  durationSeconds: 300,
  categorySlug: 'science',
  categoryName: 'Science',
  hasCaptions: false,
  kidsSafe: true,
  publishedAt: '',
  rating: null,
  mostLiked: true,
};

const mount = (item: CatalogItem, opts: { profile?: string | null; kids?: boolean } = {}) =>
  render(
    <ToastProvider>
      <ProfileIdProvider id={opts.profile === undefined ? 'p1' : opts.profile}>
        <ProfileKidsProvider kids={Boolean(opts.kids)}>
          <CatalogCard item={item} inList={false} toggle={async () => 'sent'} />
        </ProfileKidsProvider>
      </ProfileIdProvider>
    </ToastProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('CatalogCard rating cluster', () => {
  it('saves a level through PUT /api/ratings and shows it pressed', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    mount(video);
    await userEvent.click(screen.getByRole('button', { name: 'Love this' }));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ratings');
    expect(JSON.parse(init.body as string)).toEqual({
      profileId: 'p1',
      target: { kind: 'video', id: 'v1' },
      value: 2,
    });
    expect(screen.getByRole('button', { name: 'Love this' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('rolls back and says so when the save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    mount(video);
    await userEvent.click(screen.getByRole('button', { name: 'Love this' }));
    expect(await screen.findByText(/could not save your rating/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Love this' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
  });

  it('shows no rating control for a kids profile, a guest, or an item without rating data', () => {
    mount(video, { kids: true });
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('shows none for a guest', () => {
    mount(video, { profile: null });
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('shows none when the item carries no rating field', () => {
    const { rating: _rating, ...plain } = video as Extract<CatalogItem, { kind: 'video' }>;
    mount(plain as CatalogItem);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('says Most liked in the link name', () => {
    mount(video);
    expect(screen.getByRole('link')).toHaveAccessibleName(/Most liked/);
  });
});

describe('CatalogCard maturity chip in the peek (M44-S13)', () => {
  const withRank = (maturityRank: number | null, labels: string[] | null = null) =>
    render(
      <ToastProvider>
        <MaturityLabelsProvider labels={labels}>
          <CatalogCard
            item={{ ...(video as Extract<CatalogItem, { kind: 'video' }>), maturityRank }}
            inList={false}
            toggle={async () => 'sent'}
          />
        </MaturityLabelsProvider>
      </ToastProvider>,
    );

  it('shows no chip for G, the norm on this site', () => {
    withRank(0);
    expect(screen.queryByTestId('card-rated')).toBeNull();
    expect(screen.getByRole('link')).not.toHaveAccessibleName(/Rated/);
  });

  it('shows the label in the peek and says Rated 15 to screen readers', () => {
    withRank(3);
    expect(screen.getByTestId('card-rated')).toHaveTextContent('15');
    expect(screen.getByRole('link')).toHaveAccessibleName(/Rated 15/);
  });

  it('uses the configured labels', () => {
    withRank(3, ['All', '7+', '13+', '16+', '18+']);
    expect(screen.getByTestId('card-rated')).toHaveTextContent('16+');
  });

  it('shows no chip for an unrated card', () => {
    withRank(null);
    expect(screen.queryByTestId('card-rated')).toBeNull();
  });
});
