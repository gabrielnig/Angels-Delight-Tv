import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverCard, useHoverCard } from './HoverCard';

let hoverCapable = true;
let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  hoverCapable = true;
  reduced = false;
  window.matchMedia = ((q: string) => ({
    matches: q.includes('hover: hover') ? hoverCapable : q.includes('prefers-reduced-motion') ? reduced : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
});
afterEach(() => vi.useRealTimers());

function Tile({ id, left = 100, width = 200 }: { id: string; left?: number; width?: number }) {
  const hover = useHoverCard();
  return (
    <div className="ad-row">
      <article
        data-testid={id}
        ref={(el) => {
          if (el)
            el.getBoundingClientRect = () =>
              ({ left, right: left + width, top: 50, bottom: 160, width, height: 110 }) as DOMRect;
          hover.anchorRef.current = el;
        }}
        {...hover.anchorProps}
      >
        <a href="/x" onFocus={() => undefined}>
          {id}
        </a>
      </article>
      {hover.open ? (
        <HoverCard {...hover.cardProps} label={`${id} details`}>
          <p>{id} body</p>
        </HoverCard>
      ) : null}
    </div>
  );
}

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const enter = (id: string, type: string = 'mouse') =>
  fireEvent.pointerEnter(screen.getByTestId(id), { pointerType: type });
const leave = (id: string) => fireEvent.pointerLeave(screen.getByTestId(id), { pointerType: 'mouse' });

describe('HoverCard', () => {
  it('opens after 300 ms of pointer rest', () => {
    render(<Tile id="a" />);
    enter('a');
    wait(299);
    expect(screen.queryByText('a body')).toBeNull();
    wait(1);
    expect(screen.getByText('a body')).toBeTruthy();
  });

  it('never opens for a pass under 300 ms', () => {
    render(<Tile id="a" />);
    enter('a');
    wait(200);
    leave('a');
    wait(500);
    expect(screen.queryByText('a body')).toBeNull();
  });

  it('never opens for touch or pen, without hover capability, or on keyboard focus', () => {
    render(<Tile id="a" />);
    enter('a', 'touch');
    wait(500);
    expect(screen.queryByText('a body')).toBeNull();
    enter('a', 'pen');
    wait(500);
    expect(screen.queryByText('a body')).toBeNull();
    fireEvent.focus(screen.getByRole('link'));
    wait(500);
    expect(screen.queryByText('a body')).toBeNull();
    hoverCapable = false;
    enter('a');
    wait(500);
    expect(screen.queryByText('a body')).toBeNull();
  });

  it('renders in a portal at the card position, scaled 1.25 from the centre by default', () => {
    render(<Tile id="a" left={400} />);
    enter('a');
    wait(300);
    const card = screen.getByRole('dialog', { name: 'a details' });
    expect(card.parentElement).toBe(document.body);
    expect(card.style.left).toBe('400px');
    expect(card.style.top).toBe('50px');
    expect(card.style.width).toBe('200px');
    expect(card.dataset.origin).toBe('center');
    expect(card.style.transform).toBe('scale(1.25)');
  });

  it('grows rightwards for the first card and leftwards for the last', () => {
    window.innerWidth = 1000;
    const first = render(<Tile id="a" left={8} />);
    enter('a');
    wait(300);
    expect(screen.getByRole('dialog').dataset.origin).toBe('left');
    first.unmount();
    render(<Tile id="b" left={792} />);
    enter('b');
    wait(300);
    expect(screen.getByRole('dialog').dataset.origin).toBe('right');
  });

  it('closes on Escape', () => {
    render(<Tile id="a" />);
    enter('a');
    wait(300);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('a body')).toBeNull();
  });

  it('closes 100 ms after the pointer leaves, and stays when it moves onto the hover card', () => {
    render(<Tile id="a" />);
    enter('a');
    wait(300);
    leave('a');
    wait(50);
    fireEvent.pointerEnter(screen.getByRole('dialog'), { pointerType: 'mouse' });
    wait(500);
    expect(screen.getByText('a body')).toBeTruthy();
    fireEvent.pointerLeave(screen.getByRole('dialog'), { pointerType: 'mouse' });
    wait(99);
    expect(screen.getByText('a body')).toBeTruthy();
    wait(1);
    expect(screen.queryByText('a body')).toBeNull();
  });

  it('keeps only one open at a time', () => {
    render(
      <>
        <Tile id="a" />
        <Tile id="b" />
      </>,
    );
    enter('a');
    wait(300);
    enter('b');
    wait(300);
    expect(screen.queryByText('a body')).toBeNull();
    expect(screen.getByText('b body')).toBeTruthy();
  });

  it('draws no scale and no transition under reduced motion, and never a video', () => {
    reduced = true;
    render(<Tile id="a" />);
    enter('a');
    wait(300);
    const card = screen.getByRole('dialog');
    expect(card.style.transform).toBe('');
    expect(card.dataset.motion).toBe('reduced');
    expect(card.querySelector('video')).toBeNull();
  });
});
