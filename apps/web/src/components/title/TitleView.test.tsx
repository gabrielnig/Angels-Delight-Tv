// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { TitleDetail, VideoSummary } from '../../lib/data';
import { PublicSeries, PublicTitle, TitleView } from './TitleView';

vi.mock('../../app/actions', () => ({ toggleListAction: vi.fn() }));

const video: VideoSummary = {
  kind: 'video',
  id: 'v1',
  slug: 'rivers',
  title: 'Rivers of Nigeria',
  description: 'About rivers.',
  durationSeconds: 600,
  categorySlug: 'geo',
  categoryName: 'Geography',
  hasCaptions: true,
  kidsSafe: true,
  publishedAt: '2026-01-01',
  thumbnail: { src: '/p.webp', srcSet: '/p.webp 640w' },
};

const detail = (patch: Partial<TitleDetail>): TitleDetail => ({
  video,
  longDescription: 'Long.',
  related: [],
  play: { label: 'play', startSeconds: 0 },
  ...patch,
});

const view = (d: TitleDetail) =>
  render(
    <ToastProvider>
      <TitleView detail={d} inList={false} />
    </ToastProvider>,
  );

describe('TitleView layout (S18)', () => {
  it('has a breadcrumb from Home through the category to the current title', () => {
    view(detail({}));
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Home', '/'],
      ['Geography', '/browse/geo'],
    ]);
    expect(within(nav).getByText('Rivers of Nigeria')).toHaveAttribute('aria-current', 'page');
  });

  it('puts the poster and the details in separate columns that stack on small screens', () => {
    const { container } = view(detail({}));
    expect(container.querySelector('.web-title__layout > .web-title__media')).not.toBeNull();
    expect(container.querySelector('.web-title__layout > .web-title__info h1')).not.toBeNull();
  });
});

describe('TitleView', () => {
  it('shows the poster with its text alternative', () => {
    view(detail({}));
    expect(screen.getByRole('img', { name: 'Rivers of Nigeria' })).toBeInTheDocument();
  });

  it('offers Play when nothing was watched', () => {
    view(detail({}));
    expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/watch/v1');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('offers Resume from the start point with a progress bar and the time left', () => {
    view(
      detail({
        play: { label: 'resume', startSeconds: 134 },
        progress: { videoId: 'v1', positionSeconds: 137, durationSeconds: 600, updatedAt: '' },
      }),
    );
    expect(screen.getByRole('link', { name: 'Resume from 2:14' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start over' })).toHaveAttribute(
      'href',
      '/watch/v1?t=0',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '23');
    expect(screen.getByText(/left/)).toBeInTheDocument();
  });

  it('offers Watch again for a finished title, starting at zero', () => {
    view(detail({ play: { label: 'watch_again', startSeconds: 0 } }));
    expect(screen.getByRole('link', { name: 'Watch again' })).toHaveAttribute(
      'href',
      '/watch/v1?t=0',
    );
  });

  it('has a Share button', () => {
    view(detail({}));
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });
});

describe('PublicTitle', () => {
  const pub = () =>
    render(
      <PublicTitle
        slug="rivers"
        title="Rivers of Nigeria"
        description="About rivers."
        minutes="10 min"
        category="Geography"
        thumbnail={video.thumbnail}
      />,
    );

  it('sends the visitor back to the title after signing in', () => {
    pub();
    expect(screen.getByRole('link', { name: 'Sign in to watch' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Ftitle%2Frivers',
    );
  });

  it('shows the poster and no player', () => {
    pub();
    expect(screen.getByRole('img', { name: 'Rivers of Nigeria' })).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('PublicSeries', () => {
  const pub = () =>
    render(
      <PublicSeries
        slug="money-basics"
        title="Money basics"
        description="Short lessons on money."
        episodes={6}
        category="Life Skills"
        thumbnail={video.thumbnail}
      />,
    );

  it('shows the series with its episode count and category', () => {
    pub();
    expect(screen.getByRole('heading', { level: 1, name: 'Money basics' })).toBeInTheDocument();
    expect(screen.getByText('6 episodes')).toBeInTheDocument();
    expect(screen.getByText('Life Skills')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Money basics' })).toBeInTheDocument();
  });

  it('says one episode in the singular', () => {
    render(<PublicSeries slug="s" title="T" description="d" episodes={1} category="C" />);
    expect(screen.getByText('1 episode')).toBeInTheDocument();
  });

  it('sends the visitor back to the series after signing in or signing up', () => {
    pub();
    expect(screen.getByRole('link', { name: 'Sign in to watch' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fseries%2Fmoney-basics',
    );
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });
});
