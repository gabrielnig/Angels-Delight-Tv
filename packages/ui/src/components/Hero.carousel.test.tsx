import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hero, type HeroItem } from './Hero';

const items: HeroItem[] = ['a', 'b', 'c'].map((id) => ({
  id,
  title: `Title ${id}`,
  description: `About ${id}`,
  playHref: `/watch/${id}`,
  infoHref: `/title/${id}`,
}));

type Listener = (event: { matches: boolean }) => void;
let reduceListeners: Listener[] = [];
let reduced = false;

function mockMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? reduced : false,
    media: query,
    addEventListener: (_: string, fn: Listener) => {
      if (query === '(prefers-reduced-motion: reduce)') reduceListeners.push(fn);
    },
    removeEventListener: (_: string, fn: Listener) => {
      reduceListeners = reduceListeners.filter((item) => item !== fn);
    },
  })) as unknown as typeof window.matchMedia;
}

const heading = () => screen.getByRole('heading').textContent;
/** Fires timers in small steps so React flushes between slide changes, like a browser does. */
const tick = (ms: number) => {
  for (let spent = 0; spent < ms; spent += 50) {
    act(() => {
      vi.advanceTimersByTime(Math.min(50, ms - spent));
    });
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  reduceListeners = [];
  mockMatchMedia();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Hero timer (M41-S02)', () => {
  it('advances at the interval', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    tick(9900);
    expect(heading()).toBe('Title a');
    tick(200);
    expect(heading()).toBe('Title b');
  });

  it('restarts the timer when a dot is used', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    tick(9000);
    fireEvent.click(screen.getByRole('button', { name: 'Show slide 3: Title c' }));
    tick(9000);
    expect(heading()).toBe('Title c');
    tick(1100);
    expect(heading()).toBe('Title a');
  });

  it('restarts the timer when an arrow is used', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    tick(9000);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    tick(9000);
    expect(heading()).toBe('Title b');
  });

  it('holds on hover and keeps the time already spent when it lets go', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    const region = screen.getByRole('region', { name: 'Featured' });
    tick(6000);
    fireEvent.mouseEnter(region);
    tick(30000);
    expect(heading()).toBe('Title a');
    fireEvent.mouseLeave(region);
    tick(3900);
    expect(heading()).toBe('Title a');
    tick(200);
    expect(heading()).toBe('Title b');
  });

  it('holds while focus is inside the carousel', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    fireEvent.focus(screen.getByRole('link', { name: 'Play' }));
    tick(30000);
    expect(heading()).toBe('Title a');
    fireEvent.blur(screen.getByRole('link', { name: 'Play' }));
    tick(10100);
    expect(heading()).toBe('Title b');
  });

  it('holds while the tab is hidden', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    tick(30000);
    expect(heading()).toBe('Title a');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    tick(10100);
    expect(heading()).toBe('Title b');
  });

  it('never starts under reduced motion and shows no Pause', () => {
    reduced = true;
    mockMatchMedia();
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    tick(60000);
    expect(heading()).toBe('Title a');
    expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeInTheDocument();
  });

  it('stops when reduced motion turns on while the page is open', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    expect(screen.getByRole('button', { name: 'Pause rotation' })).toBeInTheDocument();
    reduced = true;
    act(() => {
      reduceListeners.forEach((fn) => fn({ matches: true }));
    });
    tick(60000);
    expect(heading()).toBe('Title a');
    expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
  });

  it('stops on the first slide after the loop limit and removes Pause', () => {
    render(<Hero items={items} label="Featured" intervalMs={1000} maxLoops={2} />);
    tick(5100);
    expect(heading()).toBe('Title c');
    tick(1000);
    expect(heading()).toBe('Title a');
    tick(20000);
    expect(heading()).toBe('Title a');
    expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(heading()).toBe('Title b');
    tick(20000);
    expect(heading()).toBe('Title b');
  });

  it('never stops when maxLoops is 0', () => {
    render(<Hero items={items} label="Featured" intervalMs={1000} maxLoops={0} />);
    tick(30100);
    expect(heading()).toBe('Title a');
    expect(screen.getByRole('button', { name: 'Pause rotation' })).toBeInTheDocument();
  });

  it('starts the clock when the artwork has loaded', () => {
    const withArt = items.map((item) => ({ ...item, image: { src: `/${item.id}.webp`, alt: '' } }));
    const { container } = render(<Hero items={withArt} label="Featured" intervalMs={10000} />);
    fireEvent.load(container.querySelector('img')!);
    tick(9900);
    expect(heading()).toBe('Title a');
    tick(200);
    expect(heading()).toBe('Title b');
  });

  it('starts the clock after 1.5 seconds even when the artwork is slow', () => {
    const withArt = items.map((item) => ({ ...item, image: { src: `/${item.id}.webp`, alt: '' } }));
    render(<Hero items={withArt} label="Featured" intervalMs={10000} />);
    tick(10100);
    expect(heading()).toBe('Title a');
    tick(1500);
    expect(heading()).toBe('Title b');
  });
});

describe('Hero controls and live region', () => {
  it('is live off while rotating and polite when paused', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    const region = screen.getByRole('region', { name: 'Featured' });
    expect(region).toHaveAttribute('aria-live', 'off');
    fireEvent.click(screen.getByRole('button', { name: 'Pause rotation' }));
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Resume rotation' })).toBeInTheDocument();
  });

  it('is polite when focus is inside', () => {
    render(<Hero items={items} label="Featured" intervalMs={10000} />);
    fireEvent.focus(screen.getByRole('link', { name: 'Play' }));
    expect(screen.getByRole('region', { name: 'Featured' })).toHaveAttribute('aria-live', 'polite');
  });

  it('shows the visible words Pause and Resume rotation beside the arrows', () => {
    const { container } = render(<Hero items={items} label="Featured" intervalMs={10000} />);
    const pause = screen.getByRole('button', { name: 'Pause rotation' });
    expect(pause).toHaveTextContent('Pause');
    const cluster = pause.parentElement!;
    expect(cluster.querySelector('[aria-label="Previous slide"]')).not.toBeNull();
    expect(cluster.querySelector('[aria-label="Next slide"]')).not.toBeNull();
    fireEvent.click(pause);
    expect(screen.getByRole('button', { name: 'Resume rotation' })).toHaveTextContent(
      'Resume rotation',
    );
    expect(container.querySelector('.ad-hero__cluster')).toBe(cluster);
  });

  it('draws the progress fill only on the current dot and freezes it when paused', () => {
    const { container } = render(<Hero items={items} label="Featured" intervalMs={10000} />);
    const fills = container.querySelectorAll('.ad-hero__fill');
    expect(fills).toHaveLength(1);
    expect(fills[0]!.closest('button')).toHaveAttribute('aria-current', 'true');
    expect(fills[0]).toHaveAttribute('data-running', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Pause rotation' }));
    expect(container.querySelector('.ad-hero__fill')).toHaveAttribute('data-running', 'false');
  });

  it('draws no fill when rotation cannot run', () => {
    const { container } = render(<Hero items={items} label="Featured" />);
    expect(container.querySelector('.ad-hero__fill')).toBeNull();
    expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
  });

  it('renders no controls for a single item', () => {
    const { container } = render(
      <Hero items={[items[0]!]} label="Featured" intervalMs={10000} />,
    );
    expect(container.querySelector('.ad-hero__controls')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('art directs the image with picture and mobileSrc', () => {
    const art = [
      {
        ...items[0]!,
        image: { src: '/wide.webp', mobileSrc: '/tall.webp', alt: '' },
      },
    ];
    const { container } = render(<Hero items={art} label="Featured" />);
    const source = container.querySelector('picture source');
    expect(source).toHaveAttribute('srcset', '/tall.webp');
    expect(source).toHaveAttribute('media', '(max-width: 959px)');
    expect(container.querySelector('picture img')).toHaveAttribute('src', '/wide.webp');
  });

  it('uses a plain img when there is no mobile crop', () => {
    const art = [{ ...items[0]!, image: { src: '/wide.webp', alt: '' } }];
    const { container } = render(<Hero items={art} label="Featured" />);
    expect(container.querySelector('picture')).toBeNull();
  });
});
