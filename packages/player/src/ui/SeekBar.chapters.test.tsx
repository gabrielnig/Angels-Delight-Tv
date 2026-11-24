import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeekBar } from './SeekBar';

const chapters = [
  { start: 0, title: 'Welcome' },
  { start: 25, title: 'Mixing colours' },
  { start: 75, title: 'A very long chapter title that should be clipped nicely at the edge' },
];

function bar(extra: Partial<React.ComponentProps<typeof SeekBar>> = {}, currentTime = 0) {
  const view = render(
    <SeekBar currentTime={currentTime} duration={100} bufferedEnd={0} onSeek={() => {}} {...extra} />,
  );
  const slider = screen.getByRole('slider', { name: 'Seek' });
  slider.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 44, right: 1000, bottom: 44 }) as DOMRect;
  return { ...view, slider };
}

describe('SeekBar chapters', () => {
  it('draws one tick per chapter start after the first', () => {
    const { container } = bar({ chapters });
    const ticks = container.querySelectorAll<HTMLElement>('.adp-seek__tick');
    expect([...ticks].map((t) => t.style.left)).toEqual(['25%', '75%']);
  });

  it('draws no ticks without chapters', () => {
    const { container } = bar();
    expect(container.querySelectorAll('.adp-seek__tick')).toHaveLength(0);
  });

  it('shows the chapter title above the time on hover', () => {
    const { slider, container } = bar({ chapters });
    fireEvent.pointerMove(slider, { clientX: 300 });
    const tip = container.querySelector('.adp-seek__tip')!;
    expect(tip.querySelector('.adp-seek__tip-chapter')?.textContent).toBe('Mixing colours');
    expect(tip.textContent).toContain('0:30');
  });

  it('shows only the time when no chapter applies', () => {
    const { slider, container } = bar();
    fireEvent.pointerMove(slider, { clientX: 300 });
    expect(container.querySelector('.adp-seek__tip-chapter')).toBeNull();
  });

  it('adds the chapter to aria-valuetext', () => {
    bar({ chapters }, 30);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe(
      '30 seconds of 1 minute 40 seconds, chapter Mixing colours',
    );
  });

  it('keeps aria-valuetext unchanged without chapters', () => {
    bar({}, 30);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).not.toMatch(/chapter/);
  });

  it('clamps the tooltip inside the bar near the edges and limits the title width in CSS', () => {
    const { slider, container } = bar({ chapters });
    fireEvent.pointerMove(slider, { clientX: 990 });
    const tip = container.querySelector<HTMLElement>('.adp-seek__tip')!;
    const left = Number.parseFloat(tip.style.left);
    expect(left).toBeLessThanOrEqual(1000 - 80);
    expect(left).toBeGreaterThanOrEqual(80);
  });
});
