// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { TitleDetail, VideoSummary } from '../../lib/data';
import { MaturityLabelsProvider } from '../../lib/maturity-context';
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

const full = (patch: Partial<TitleDetail> = {}): TitleDetail =>
  detail({
    video: {
      ...video,
      title: 'How Rain Is Made',
      durationSeconds: 352,
      categoryName: 'Science',
      categorySlug: 'science',
      ageLabel: 'Ages 8 and up',
      description: 'Rain starts as water in the sea.',
      series: { slug: 'everyday-science', title: 'Everyday Science', season: 1, episode: 3 },
    },
    longDescription: 'Rain starts as water in the sea.',
    credits: 'Presented by Dr Ifeoma Okafor. Captions in English.',
    play: { label: 'resume', startSeconds: 134 },
    progress: { videoId: 'v1', positionSeconds: 134, durationSeconds: 352, updatedAt: '' },
    related: ['a', 'b', 'c'].map((id, i) => ({
      ...video,
      id,
      slug: `r-${id}`,
      title: `Related ${id}`,
      durationSeconds: 300 + i * 60,
      thumbnail: undefined,
    })),
    ...patch,
  });

describe('TitleView layout (S18)', () => {
  it('title page breadcrumb shows Browse, category and title', () => {
    view(full());
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toHaveClass('ad-crumbs--viewer');
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Browse', '/browse'],
      ['Science', '/browse/science'],
    ]);
    expect(within(nav).getByText('How Rain Is Made')).toHaveAttribute('aria-current', 'page');
  });

  it('puts the poster and the details in separate columns that stack on small screens', () => {
    const { container } = view(full());
    expect(container.querySelector('.tv-layout > .tv-poster')).not.toBeNull();
    expect(container.querySelector('.tv-layout > .tv-info h1')).not.toBeNull();
  });

  it('draws a play button and a progress strip on the poster', () => {
    const { container } = view(full());
    const poster = container.querySelector('.tv-poster')!;
    expect(
      within(poster as HTMLElement).getByRole('link', { name: 'Resume How Rain Is Made' }),
    ).toHaveAttribute('href', '/watch/v1');
    const strip = poster.querySelector('.tv-poster__strip > span') as HTMLElement;
    expect(strip.style.width).toBe('38%');
  });

  it('keeps the play button on a poster with no picture, and no strip before the first play', () => {
    const { container } = view(
      full({
        video: { ...full().video, thumbnail: undefined },
        progress: undefined,
        play: { label: 'play', startSeconds: 0 },
      }),
    );
    const poster = container.querySelector('.tv-poster')!;
    expect(
      within(poster as HTMLElement).getByRole('link', { name: 'Play How Rain Is Made' }),
    ).toBeInTheDocument();
    expect(poster.querySelector('.tv-poster__strip')).toBeNull();
  });

  it('shows the series line above the title, in full and in short form', () => {
    const { container } = view(full());
    const link = container.querySelector('.tv-series') as HTMLElement;
    expect(link).toHaveAttribute('href', '/series/everyday-science');
    expect(container.querySelector('.tv-series__long')).toHaveTextContent(
      'Everyday Science, Season 1, Episode 3',
    );
    expect(container.querySelector('.tv-series__short')).toHaveTextContent(
      'Everyday Science, S1 E3',
    );
    expect(
      link.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows the exact length, subject, age and a CC badge as plain meta', () => {
    const { container } = view(full());
    const meta = container.querySelector('.tv-meta')!;
    expect(meta).toHaveTextContent('5 min 52 sec');
    expect(meta).toHaveTextContent('Science');
    expect(meta).toHaveTextContent('Ages 8 and up');
    expect(within(meta as HTMLElement).getByLabelText('Captions available')).toHaveTextContent(
      'CC',
    );
  });

  it('shows no CC badge when there are no captions', () => {
    const { container } = view(full({ video: { ...full().video, hasCaptions: false } }));
    expect(container.querySelector('.tv-meta')).not.toHaveTextContent('CC');
  });

  it('shows the description once, with the credits line under it', () => {
    view(full());
    expect(screen.getAllByText('Rain starts as water in the sea.')).toHaveLength(1);
    expect(
      screen.getByText('Presented by Dr Ifeoma Okafor. Captions in English.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows a short bar with how much was watched', () => {
    view(full());
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '38');
    expect(screen.getByText('2:14 of 5:52 watched')).toBeInTheDocument();
  });

  it('has a sticky Play bar for phones with the same destination', () => {
    const { container } = view(full());
    const bar = container.querySelector('.tv-sticky') as HTMLElement;
    expect(within(bar).getByRole('link', { name: 'Resume, 3 min 38 sec left' })).toHaveAttribute(
      'href',
      '/watch/v1',
    );
  });
});

describe('TitleView related row (S18)', () => {
  it('shows each related title once, with a duration badge and the subject', () => {
    const { container } = view(full());
    const cards = container.querySelectorAll('.tv-related__card');
    expect(cards).toHaveLength(3);
    const first = cards[0] as HTMLElement;
    expect(within(first).getAllByText('Related a')).toHaveLength(1);
    expect(first.querySelector('.tv-related__badge')).toHaveTextContent('5 min');
    expect(first.querySelector('.tv-related__subject')).toHaveTextContent('Geography');
    expect(first).toHaveAttribute('href', '/title/r-a');
  });

  it('names the duration for screen readers and keeps the badge text out of the name', () => {
    view(full());
    expect(screen.getByRole('link', { name: /^Related a, 5 minutes/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /5 min\b/ })).toBeNull();
  });

  it('shows no row when nothing is related', () => {
    view(full({ related: [] }));
    expect(screen.queryByRole('heading', { name: 'More like this' })).toBeNull();
  });
});

describe('TitleView', () => {
  it('shows the poster with its text alternative', () => {
    view(detail({}));
    expect(screen.getByRole('img', { name: 'Rivers of Nigeria' })).toBeInTheDocument();
  });

  it('offers Play when nothing was watched', () => {
    view(detail({}));
    expect(screen.getAllByRole('link', { name: 'Play' })[0]).toHaveAttribute('href', '/watch/v1');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('offers Resume with the time left, Start over and a progress bar', () => {
    view(full());
    expect(
      screen.getAllByRole('link', { name: 'Resume, 3 min 38 sec left' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Start over' })).toHaveAttribute(
      'href',
      '/watch/v1?t=0',
    );
  });

  it('offers Watch again for a finished title, starting at zero', () => {
    view(detail({ play: { label: 'watch_again', startSeconds: 0 } }));
    expect(screen.getAllByRole('link', { name: 'Watch again' })[0]).toHaveAttribute(
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

  it('shows the rating group for a signed in adult and for a guest, never for kids or an episode', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    const withUi = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
    const guestView = withUi(
      <TitleView detail={detail({})} inList={false} guest={{ signUpOpen: true }} />,
    );
    expect(screen.getByRole('group', { name: 'Rate this title' })).toBeInTheDocument();
    guestView.unmount();
    const kidsView = withUi(
      <TitleView detail={detail({})} inList={false} guest={{ signUpOpen: true }} kids />,
    );
    expect(screen.queryByRole('group', { name: 'Rate this title' })).toBeNull();
    kidsView.unmount();
    const episode = detail({
      video: { ...video, series: { slug: 's', title: 'S', season: 1, episode: 1 } },
    });
    withUi(<TitleView detail={episode} inList={false} guest={{ signUpOpen: true }} />);
    expect(screen.queryByRole('group', { name: 'Rate this title' })).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('TitleView sponsor card (M48)', () => {
  const sponsor = {
    sponsorId: 's',
    sponsorName: 'Acme',
    creativeId: '0190a000-0000-7000-8000-000000000002',
    slot: 'title_card' as const,
    headline: 'Learn with Acme',
    body: null,
    ctaLabel: 'Visit',
    href: '/s/0190a000-0000-7000-8000-000000000002',
    imageUrl: null,
    wideImageUrl: null,
    altText: null,
    textOnly: true,
    label: 'sponsored' as const,
    newTab: true,
  };
  const withSponsor = (props: { sponsor?: typeof sponsor | null; kids?: boolean }) =>
    render(
      <ToastProvider>
        <TitleView detail={detail({})} inList={false} {...props} />
      </ToastProvider>,
    );
  it('shows the card below the actions when one is given', () => {
    withSponsor({ sponsor });
    expect(screen.getByText('Learn with Acme')).toBeTruthy();
  });
  it('shows nothing without a sponsor', () => {
    withSponsor({ sponsor: null });
    expect(screen.queryByText('Sponsored')).toBeNull();
  });
  it('never draws the card for kids even if one is passed in', () => {
    withSponsor({ sponsor, kids: true });
    expect(screen.queryByText('Learn with Acme')).toBeNull();
  });
});

describe('TitleView maturity badge and Most liked (M44-S05, S13)', () => {
  const show = (patch: Partial<VideoSummary>, labels: string[] | null = null) =>
    render(
      <ToastProvider>
        <MaturityLabelsProvider labels={labels}>
          <TitleView detail={detail({ video: { ...video, ...patch } })} inList={false} />
        </MaturityLabelsProvider>
      </ToastProvider>,
    );

  it('shows the rating label with a spoken Rated form', () => {
    show({ maturityRank: 2 });
    const badge = screen.getByLabelText('Rated 12');
    expect(badge).toHaveTextContent('12');
  });

  it('shows G too, and uses the configured labels', () => {
    show({ maturityRank: 0 }, ['All', '7+', '13+', '16+', '18+']);
    expect(screen.getByLabelText('Rated All')).toBeInTheDocument();
  });

  it('shows nothing for an unrated title', () => {
    show({ maturityRank: null });
    expect(screen.queryByLabelText(/^Rated /)).toBeNull();
  });

  it('shows the Most liked label, never a count', () => {
    show({ mostLiked: true });
    expect(screen.getByText('Most liked')).toBeInTheDocument();
    expect(screen.queryByText(/ratings/)).toBeNull();
  });

  it('shows no Most liked label for a title that has none', () => {
    show({ mostLiked: false });
    expect(screen.queryByText('Most liked')).toBeNull();
  });
});
