import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContinueCard, SeriesCard, VideoCard } from './Cards';

beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('hover: hover'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
});
afterEach(() => vi.useRealTimers());

/** Rests a mouse on the first card for 300 ms and returns the hover card. */
function hoverOpen() {
  vi.useFakeTimers();
  fireEvent.pointerEnter(document.querySelector('article.ad-card')!, { pointerType: 'mouse' });
  act(() => void vi.advanceTimersByTime(300));
  return screen.getByRole('dialog');
}

const base = {
  title: 'How to save money on data',
  href: '/title/save-data',
  durationSeconds: 252,
  thumbnail: {
    src: '/t/save-data-480.webp',
    srcSet: '/t/save-data-320.webp 320w, /t/save-data-480.webp 480w',
  },
};

describe('card links name from their visible text (WCAG 2.5.3)', () => {
  it('has no aria-label that could drift from the visible title', () => {
    const { container } = render(
      <>
        <VideoCard {...base} />
        <ContinueCard {...base} progressPercent={20} timeLeftLabel="3 min left" />
        <SeriesCard title="Farming basics" href="/series/farming" itemsText="8 episodes" />
      </>,
    );
    for (const link of container.querySelectorAll('a.ad-card__link')) {
      expect(link.hasAttribute('aria-label')).toBe(false);
    }
  });

  it('names the continue card with the title first, then length, progress and time left', () => {
    render(<ContinueCard {...base} progressPercent={20} timeLeftLabel="3 min left" />);
    expect(
      screen.getByRole('link', {
        name: 'How to save money on data, 4 minutes, 20 percent watched, 3 min left',
      }),
    ).toBeInTheDocument();
  });

  it('does not read the progress bar before the title', () => {
    render(<ContinueCard {...base} progressPercent={20} timeLeftLabel="3 min left" />);
    const name = screen.getByRole('link').textContent ?? '';
    expect(name.indexOf('How to save money')).toBeLessThan(name.indexOf('percent watched'));
    expect(name.match(/percent watched/g)).toHaveLength(1);
  });
});

describe('VideoCard', () => {
  it('is one link named with title and length', () => {
    render(<VideoCard {...base} />);
    const link = screen.getByRole('link', { name: 'How to save money on data, 4 minutes' });
    expect(link).toHaveAttribute('href', '/title/save-data');
  });

  it('shows the duration badge with a spoken form and a lazy decorative image', () => {
    const { container } = render(<VideoCard {...base} />);
    expect(screen.getAllByText('4:12').length).toBeGreaterThan(0);
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
    const bar = screen.getByRole('progressbar', { hidden: true });
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByRole('link').textContent).toContain('60 percent watched');
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
    render(<SeriesCard title="Farming basics" href="/series/farming" itemsText="8 episodes" />);
    expect(screen.getByRole('link', { name: 'Farming basics, 8 episodes' })).toHaveAttribute(
      'href',
      '/series/farming',
    );
    expect(screen.getByText('8 episodes')).toBeInTheDocument();
  });

  it('says 1 episode for a single episode', () => {
    render(<SeriesCard title="Short" href="/series/short" itemsText="1 episode" />);
    expect(screen.getByText('1 episode')).toBeInTheDocument();
  });
});

describe('SeriesCard My List', () => {
  it('has a pressed My List button when a handler is given', async () => {
    const onToggleList = vi.fn();
    render(
      <SeriesCard
        title="Science"
        href="/series/s"
        itemsText="3 episodes"
        inList
        onToggleList={onToggleList}
      />,
    );
    const button = screen.getByRole('button', { name: 'Remove Science from My List' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    button.click();
    expect(onToggleList).toHaveBeenCalled();
  });

  it('has no My List button without a handler', () => {
    render(<SeriesCard title="Science" href="/series/s" itemsText="3 episodes" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Thumb formats', () => {
  it('offers webp in a source and jpeg on the image', () => {
    const { container } = render(
      <VideoCard
        {...base}
        thumbnail={{
          src: 'a.webp',
          srcSet: 'a.webp 320w',
          fallbackSrc: 'a.jpg',
          fallbackSrcSet: 'a.jpg 320w',
        }}
      />,
    );
    expect(container.querySelector('picture source')).toHaveAttribute('type', 'image/webp');
    expect(container.querySelector('picture img')).toHaveAttribute('src', 'a.jpg');
  });
});

describe('VideoCard hover card', () => {
  it('has no inline peek on the card itself', () => {
    const { container } = render(<VideoCard {...base} description="Learn to budget your data." />);
    expect(container.querySelector('.ad-card__peek')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens after the pointer rests, with the description and a Play link', () => {
    render(
      <VideoCard {...base} description="Learn to budget your data." playHref="/watch/save-data" />,
    );
    const card = hoverOpen();
    expect(card).toHaveTextContent('Learn to budget your data.');
    expect(within(card).getByRole('link', { name: /Play/ })).toHaveAttribute('href', '/watch/save-data');
  });

  it('shows title, length, subject, More info and Play', () => {
    render(<VideoCard {...base} subject="Money" description="Learn to budget your data." />);
    const card = hoverOpen();
    expect(card).toHaveTextContent(base.title);
    expect(card).toHaveTextContent('Money');
    expect(card).toHaveTextContent('4:12');
    expect(within(card).getByRole('link', { name: /More info/ })).toHaveAttribute('href', base.href);
    expect(card.querySelector('video')).toBeNull();
  });

  it('leaves out the description and subject when there are none', () => {
    render(<VideoCard {...base} />);
    const card = hoverOpen();
    expect(card.querySelector('.ad-hovercard__text')).toBeNull();
    expect(card.querySelector('.ad-hovercard__subject')).toBeNull();
  });

  it('keeps the My List toggle working inside the hover card', () => {
    const onToggleList = vi.fn();
    render(<VideoCard {...base} inList={false} onToggleList={onToggleList} />);
    const card = hoverOpen();
    fireEvent.click(within(card).getByRole('button', { name: `Add ${base.title} to My List` }));
    expect(onToggleList).toHaveBeenCalledTimes(1);
  });
});

describe('card share entry points (L15a)', () => {
  it('puts a Share button in the hover card only when a share handler is given', () => {
    const onShare = vi.fn();
    const { unmount } = render(<VideoCard {...base} onShare={onShare} />);
    const card = hoverOpen();
    fireEvent.click(within(card).getByRole('button', { name: `Share ${base.title}` }));
    expect(onShare).toHaveBeenCalledTimes(1);
    unmount();
    render(<VideoCard {...base} />);
    expect(within(hoverOpen()).queryByRole('button', { name: /Share/ })).toBeNull();
  });

  it('adds Share to the Continue menu between Go to title and Remove, when given', async () => {
    const onShare = vi.fn();
    render(
      <ContinueCard
        {...base}
        onRemove={() => {}}
        onShare={onShare}
        titleHref="/title/save-data"
        menuLabels={{ more: 'More for {title}', remove: 'Remove from row', goToTitle: 'Go to title page', share: 'Share' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /More for/ }));
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items).toEqual(['Remove from row', 'Go to title page', 'Share']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('leaves Share out of the Continue menu without a handler', async () => {
    render(
      <ContinueCard
        {...base}
        onRemove={() => {}}
        titleHref="/title/save-data"
        menuLabels={{ more: 'More for {title}', remove: 'Remove from row', goToTitle: 'Go to title page', share: 'Share' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /More for/ }));
    expect(screen.queryByRole('menuitem', { name: 'Share' })).toBeNull();
  });
});

describe('card artwork placeholder and fade in (M36-S02, M08-S27)', () => {
  const blur = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4';
  const withBlur = { ...base.thumbnail, placeholderBlur: blur, placeholderColor: '#3366cc' };

  it('draws the stored blur behind the image and keeps the image hidden until it loads', () => {
    const { container } = render(<VideoCard {...base} thumbnail={withBlur} />);
    const layer = container.querySelector<HTMLElement>('.ad-card__blur');
    expect(layer).not.toBeNull();
    expect(layer!.style.backgroundImage).toContain(blur);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('data-loaded')).toBe('false');
    fireEvent.load(img);
    expect(img.getAttribute('data-loaded')).toBe('true');
  });

  it('falls back to the placeholder colour when there is no blur', () => {
    const { container } = render(
      <VideoCard {...base} thumbnail={{ ...base.thumbnail, placeholderColor: '#3366cc' }} />,
    );
    expect(container.querySelector('.ad-card__blur')).toBeNull();
    const thumb = container.querySelector<HTMLElement>('.ad-card__thumb')!;
    expect(thumb.style.backgroundColor).not.toBe('');
  });

  it('leaves the image visible when there is no placeholder at all', () => {
    const { container } = render(<VideoCard {...base} />);
    expect(container.querySelector('.ad-card__blur')).toBeNull();
    expect(container.querySelector('img')!.hasAttribute('data-loaded')).toBe(false);
  });

  it('swaps to the fallback tile when the image fails', () => {
    const { container } = render(<VideoCard {...base} thumbnail={withBlur} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.ad-card__fallback')).not.toBeNull();
  });
});

describe('card rating cluster and Most liked (M44-S03, S05)', () => {
  const labels = { group: 'Rate', notForMe: 'Not for me', like: 'I like this', love: 'Love this' };

  it('has no rating group without a handler', () => {
    render(<VideoCard {...base} />);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('names the group after the title and keeps every level a named toggle button', () => {
    render(<VideoCard {...base} rating={{ value: 2, onChange: () => {}, labels }} />);
    const group = screen.getByRole('group', { name: `Rate ${base.title}` });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Love this',
      'Not for me',
      'I like this',
    ]);
    expect(within(group).getByRole('button', { name: 'Love this' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'I like this' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('puts the chip first in tab order: the current level, or Like when unrated', () => {
    render(<VideoCard {...base} rating={{ value: null, onChange: () => {}, labels }} />);
    const first = within(screen.getByRole('group')).getAllByRole('button')[0]!;
    expect(first).toHaveAttribute('aria-label', 'I like this');
    expect(first).toHaveAttribute('data-chip', 'true');
  });

  it('sets a level, and clears it when the pressed level is chosen again', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<VideoCard {...base} rating={{ value: null, onChange, labels }} />);
    await user.click(screen.getByRole('button', { name: 'Love this' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
    rerender(<VideoCard {...base} rating={{ value: 2, onChange, labels }} />);
    await user.click(screen.getByRole('button', { name: 'Love this' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps My List a sibling of the group in the same cluster', () => {
    render(
      <VideoCard
        {...base}
        inList={false}
        onToggleList={() => {}}
        rating={{ value: null, onChange: () => {}, labels }}
      />,
    );
    const cluster = screen.getByRole('group').closest('.ad-card__actions')!;
    expect(within(cluster as HTMLElement).getByRole('button', { name: /to My List/ })).toBeTruthy();
  });

  it('puts the rating cluster on a series card too', () => {
    render(
      <SeriesCard
        title="Money 101"
        href="/series/m"
        itemsText="4 episodes"
        rating={{ value: 1, onChange: () => {}, labels }}
      />,
    );
    expect(screen.getByRole('button', { name: 'I like this' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('says Most liked and the profile rating to screen readers, never a count', () => {
    render(<VideoCard {...base} mostLiked rating={{ value: 2, onChange: () => {}, labels }} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAccessibleName(/Most liked/);
    expect(link).toHaveAccessibleName(/Your rating: Love this/);
    expect(link.textContent).not.toMatch(/\d+ (ratings|likes)/);
    expect(within(hoverOpen()).getByText('Most liked')).toBeInTheDocument();
  });

  it('shows no Most liked text when the title is not labelled', () => {
    render(<VideoCard {...base} />);
    expect(screen.queryByText(/Most liked/)).toBeNull();
  });
});

describe('card maturity chip (M44-S13)', () => {
  it('draws the chip in the hover card and speaks Rated in the link name', () => {
    render(<VideoCard {...base} maturity="15" />);
    expect(screen.getByRole('link')).toHaveAccessibleName(/Rated 15/);
    expect(within(hoverOpen()).getByTestId('card-rated')).toHaveTextContent('15');
  });

  it('draws nothing without a maturity label', () => {
    render(<VideoCard {...base} />);
    expect(screen.queryByTestId('card-rated')).toBeNull();
  });

  it('puts the chip and Most liked on one line that wraps together', () => {
    render(<VideoCard {...base} maturity="18" mostLiked />);
    hoverOpen();
    const facts = screen.getByTestId('card-rated').parentElement!;
    expect(facts).toHaveClass('ad-hovercard__facts');
    expect(within(facts).getByText('Most liked')).toBeInTheDocument();
  });

  it('says Rated on a series card too', () => {
    render(<SeriesCard title="Money 101" href="/series/m" itemsText="4 episodes" maturity="12" />);
    expect(screen.getByRole('link')).toHaveAccessibleName(/Rated 12/);
  });
});

describe('ContinueCard polish (M44-S15)', () => {
  it('shows a Next badge and no progress bar for a next-up episode', () => {
    const { container } = render(
      <ContinueCard {...base} nextLabel="Next: E4" timeLeftLabel="Starts at the beginning" />,
    );
    expect(screen.getAllByText('Next: E4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Starts at the beginning').length).toBeGreaterThan(0);
    expect(container.querySelector('.ad-card__progress')).toBeNull();
  });

  it('opens a menu with Remove from row and Go to title page, with a 44px kebab', async () => {
    const onRemove = vi.fn();
    render(
      <ContinueCard
        {...base}
        progressPercent={20}
        onRemove={onRemove}
        titleHref="/title/save-data"
        menuLabels={{ more: 'More for {title}', remove: 'Remove from row', goToTitle: 'Go to title page' }}
      />,
    );
    const kebab = screen.getByRole('button', { name: 'More for How to save money on data' });
    expect(kebab).toHaveAttribute('aria-haspopup', 'menu');
    expect(kebab).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(kebab);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Go to title page' })).toHaveAttribute(
      'href',
      '/title/save-data',
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from row' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('moves with arrow keys, closes on Escape and returns focus to the kebab', async () => {
    render(
      <ContinueCard
        {...base}
        onRemove={() => {}}
        titleHref="/title/save-data"
        menuLabels={{ more: 'More for {title}', remove: 'Remove from row', goToTitle: 'Go to title page' }}
      />,
    );
    const kebab = screen.getByRole('button', { name: /More for/ });
    kebab.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Remove from row' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Go to title page' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Remove from row' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(kebab).toHaveFocus();
  });
});

describe('card rank for a Top 10 row (M44-S09)', () => {
  it('starts the link name with Number 3,', () => {
    render(<VideoCard {...base} rank={3} />);
    expect(screen.getByRole('link')).toHaveAccessibleName(/^Number 3,\s?How to save money on data/);
  });

  it('does the same on a series card', () => {
    render(<SeriesCard title="Money 101" href="/series/m" itemsText="4 episodes" rank={10} />);
    expect(screen.getByRole('link')).toHaveAccessibleName(/^Number 10,\s?Money 101/);
  });

  it('adds nothing without a rank', () => {
    render(<VideoCard {...base} />);
    expect(screen.getByRole('link')).not.toHaveAccessibleName(/Number/);
  });
});
