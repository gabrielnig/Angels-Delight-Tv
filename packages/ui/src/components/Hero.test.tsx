import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Hero, HERO_ROTATE_MS, type HeroItem } from './Hero';

const items: HeroItem[] = [
  {
    id: 'a',
    title: 'Start a small business',
    description: 'Learn the first five steps to open your shop.',
    meta: 'Money, 6 min',
    image: { src: '/h/a.webp', alt: 'A shop owner at a market stall' },
    playHref: '/watch/a',
    infoHref: '/title/a',
  },
  {
    id: 'b',
    title: 'Stay healthy',
    description: 'Simple habits for every day.',
    meta: 'Health, 4 min',
    image: { src: '/h/b.webp', alt: '' },
    playHref: '/watch/b',
    infoHref: '/title/b',
    resumeLabel: '12 min left',
  },
];

const plain = items.map(({ image: _image, ...rest }) => rest);

describe('Hero share (L15a)', () => {
  it('shows a 44 px Share button named for the slide when a handler is given, and not otherwise', async () => {
    const onShare = vi.fn();
    const { unmount } = render(<Hero items={plain} label="Featured" onShare={onShare} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share Start a small business' }));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    unmount();
    render(<Hero items={plain} label="Featured" />);
    expect(screen.queryByRole('button', { name: /Share/ })).toBeNull();
  });
});

describe('Hero', () => {
  it('is a labelled carousel region showing one slide', () => {
    render(<Hero items={items} label="Featured" />);
    expect(screen.getByRole('region', { name: 'Featured' })).toHaveAttribute(
      'aria-roledescription',
      'carousel',
    );
    expect(screen.getByRole('heading', { name: 'Start a small business' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stay healthy' })).toBeNull();
  });

  it('shows Play and More info as links', () => {
    render(<Hero items={items} label="Featured" />);
    expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/watch/a');
    expect(screen.getByRole('link', { name: 'More info' })).toHaveAttribute('href', '/title/a');
  });

  it('turns Play into Continue with time left when progress exists', async () => {
    const user = userEvent.setup();
    render(<Hero items={items} label="Featured" />);
    await user.click(screen.getByRole('button', { name: 'Show slide 2: Stay healthy' }));
    expect(screen.getByRole('link', { name: 'Continue, 12 min left' })).toHaveAttribute(
      'href',
      '/watch/b',
    );
  });

  it('marks the current dot with aria-current', async () => {
    const user = userEvent.setup();
    render(<Hero items={items} label="Featured" />);
    const first = screen.getByRole('button', { name: 'Show slide 1: Start a small business' });
    expect(first).toHaveAttribute('aria-current', 'true');
    await user.click(screen.getByRole('button', { name: 'Show slide 2: Stay healthy' }));
    expect(first).not.toHaveAttribute('aria-current');
  });

  it('has no dots for a single item', () => {
    render(<Hero items={[items[0]!]} label="Featured" />);
    expect(screen.queryByRole('button', { name: /Show slide/ })).toBeNull();
  });

  it('prioritises the first image and does not autoplay anything', () => {
    const { container } = render(<Hero items={items} label="Featured" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('alt', 'A shop owner at a market stall');
    expect(container.querySelector('video')).toBeNull();
  });

  it('swipes between slides on touch', () => {
    render(<Hero items={items} label="Featured" />);
    const region = screen.getByRole('region', { name: 'Featured' });
    fireEvent.touchStart(region, { touches: [{ clientX: 300, clientY: 10 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 100, clientY: 12 }] });
    expect(screen.getByRole('heading', { name: 'Stay healthy' })).toBeInTheDocument();
  });

  it('rotates only when asked and offers a pause control', async () => {
    vi.useFakeTimers();
    render(<Hero items={plain} label="Featured" intervalMs={7000} />);
    act(() => {
      vi.advanceTimersByTime(7100);
    });
    expect(screen.getByRole('heading', { name: 'Stay healthy' })).toBeInTheDocument();
    act(() => {
      screen.getByRole('button', { name: 'Pause rotation' }).click();
    });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByRole('heading', { name: 'Stay healthy' })).toBeInTheDocument();
  });

  it('shares one rotation constant of 20 seconds', () => {
    expect(HERO_ROTATE_MS).toBe(20000);
  });

  it('crossfades: the leaving slide stays for the fade then is removed', () => {
    vi.useFakeTimers();
    const { container } = render(
      <Hero items={plain} label="Featured" intervalMs={HERO_ROTATE_MS} />,
    );
    act(() => {
      vi.advanceTimersByTime(HERO_ROTATE_MS + 50);
    });
    expect(container.querySelectorAll('.ad-hero__slide')).toHaveLength(2);
    const leaving = container.querySelector('.ad-hero__slide--leaving');
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(
      container.querySelector('.ad-hero__slide:not(.ad-hero__slide--leaving)'),
    ).toHaveAttribute('data-fade', 'true');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelectorAll('.ad-hero__slide')).toHaveLength(1);
  });

  it('skips the crossfade under reduced motion', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    try {
      const { container } = render(
        <Hero items={items} label="Featured" intervalMs={HERO_ROTATE_MS} />,
      );
      act(() => {
        screen.getByRole('button', { name: 'Next slide' }).click();
      });
      expect(container.querySelectorAll('.ad-hero__slide')).toHaveLength(1);
    } finally {
      window.matchMedia = original;
    }
  });

  it('shows a skeleton while loading', () => {
    render(<Hero items={[]} label="Featured" state="loading" skeletonDelayMs={0} />);
    expect(screen.getByText('Loading Featured')).toBeInTheDocument();
  });

  it('falls back to a primary panel with live text on error', () => {
    render(<Hero items={[]} label="Featured" state="error" fallbackTitle="Angels Delight TV" />);
    expect(screen.getByRole('heading', { name: 'Angels Delight TV' })).toBeInTheDocument();
  });
});

describe('Hero clip and button label', () => {
  const withClip: HeroItem[] = [
    { ...items[0]!, previewSrc: '/clip-a.mp4', playLabel: 'Start learning' },
    { ...items[1]!, previewSrc: '/clip-b.mp4' },
  ];

  it('uses the editor button label for Play', () => {
    render(<Hero items={withClip} label="Featured" />);
    expect(screen.getByRole('link', { name: /Start learning/ })).toBeTruthy();
  });

  it('puts no video in the page unless previews are allowed', () => {
    const { container } = render(<Hero items={withClip} label="Featured" />);
    expect(container.querySelector('video')).toBeNull();
  });

  it('mounts one clip, for the active slide only, when allowed', () => {
    const { container } = render(<Hero items={withClip} label="Featured" previewAllowed />);
    const clips = container.querySelectorAll('video');
    expect(clips.length).toBe(1);
  });

  it('draws no clip for a slide without one', () => {
    const { container } = render(
      <Hero items={[{ ...items[0]! }, { ...items[1]! }]} label="Featured" previewAllowed />,
    );
    expect(container.querySelector('video')).toBeNull();
  });
});
