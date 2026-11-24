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
    render(<Hero items={items} label="Featured" autoRotateMs={7000} />);
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

  it('shares one rotation constant of 10 seconds', () => {
    expect(HERO_ROTATE_MS).toBe(10000);
  });

  it('crossfades: the leaving slide stays for the fade then is removed', () => {
    vi.useFakeTimers();
    const { container } = render(
      <Hero items={items} label="Featured" autoRotateMs={HERO_ROTATE_MS} />,
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
        <Hero items={items} label="Featured" autoRotateMs={HERO_ROTATE_MS} />,
      );
      act(() => {
        screen.getByRole('button', { name: 'Next slide' }).click();
      });
      expect(container.querySelectorAll('.ad-hero__slide')).toHaveLength(1);
    } finally {
      window.matchMedia = original;
    }
  });

  it('stops rotating after two loops', () => {
    vi.useFakeTimers();
    render(<Hero items={items} label="Featured" autoRotateMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    const at = screen.getByRole('heading').textContent;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole('heading').textContent).toBe(at);
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
