import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContinueCard, SeriesCard, VideoCard } from './Cards';

const base = {
  title: 'How to save money on data',
  href: '/title/save-data',
  durationSeconds: 252,
  thumbnail: {
    src: '/t/save-data-480.webp',
    srcSet: '/t/save-data-320.webp 320w, /t/save-data-480.webp 480w',
  },
};

describe('VideoCard', () => {
  it('is one link named with title and length', () => {
    render(<VideoCard {...base} />);
    const link = screen.getByRole('link', { name: 'How to save money on data, 4 minutes' });
    expect(link).toHaveAttribute('href', '/title/save-data');
  });

  it('shows the duration badge with a spoken form and a lazy decorative image', () => {
    const { container } = render(<VideoCard {...base} />);
    expect(screen.getByText('4:12')).toBeInTheDocument();
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('srcset');
  });

  it('can load its image eagerly with high priority', () => {
    const { container } = render(<VideoCard {...base} priority />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('keeps the My List button a sibling of the link, not nested', () => {
    render(<VideoCard {...base} inList={false} onToggleList={() => {}} />);
    const button = screen.getByRole('button', { name: 'Add How to save money on data to My List' });
    expect(button.closest('a')).toBeNull();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles My List and reports pressed state', async () => {
    const onToggleList = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<VideoCard {...base} inList={false} onToggleList={onToggleList} />);
    await user.click(screen.getByRole('button', { name: /to My List/ }));
    expect(onToggleList).toHaveBeenCalled();
    rerender(<VideoCard {...base} inList onToggleList={onToggleList} />);
    expect(
      screen.getByRole('button', { name: 'Remove How to save money on data from My List' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a title fallback box when the image fails', () => {
    const { container } = render(<VideoCard {...base} />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.ad-card__fallback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /save money on data/ })).toBeInTheDocument();
  });

  it('shows a meta line', () => {
    render(<VideoCard {...base} meta="Money, 4 min" />);
    expect(screen.getByText('Money, 4 min')).toBeInTheDocument();
  });

  it('renders a skeleton-sized placeholder box without a thumbnail', () => {
    const { container } = render(<VideoCard {...base} thumbnail={undefined} />);
    expect(container.querySelector('.ad-card__fallback')).toBeInTheDocument();
  });
});

describe('ContinueCard', () => {
  it('shows progress with an accessible reading and the time left', () => {
    render(
      <ContinueCard
        {...base}
        progressPercent={60}
        timeLeftLabel="2 min left"
        onRemove={() => {}}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('60 percent watched')).toHaveClass('ad-sr-only');
    expect(screen.getByText('2 min left')).toBeInTheDocument();
  });

  it('hides the bar when the position is unknown and the card links to the start', () => {
    render(<ContinueCard {...base} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('offers a named remove action', async () => {
    const onRemove = vi.fn();
    render(<ContinueCard {...base} progressPercent={20} onRemove={onRemove} />);
    await userEvent.setup().click(
      screen.getByRole('button', {
        name: 'Remove How to save money on data from Continue watching',
      }),
    );
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('SeriesCard', () => {
  it('links to the series with an episode count badge', () => {
    render(<SeriesCard title="Farming basics" href="/series/farming" episodeCount={8} />);
    expect(screen.getByRole('link', { name: 'Farming basics, 8 episodes' })).toHaveAttribute(
      'href',
      '/series/farming',
    );
    expect(screen.getByText('8 episodes')).toBeInTheDocument();
  });

  it('says 1 episode for a single episode', () => {
    render(<SeriesCard title="Short" href="/series/short" episodeCount={1} />);
    expect(screen.getByText('1 episode')).toBeInTheDocument();
  });
});
