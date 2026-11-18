import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeekBar } from './SeekBar';

const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
s1.jpg#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
s1.jpg#xywh=160,0,160,90
`;
const MAP = 'https://m.test/cap/p/sprites/map.vtt';

function bar(extra: Partial<React.ComponentProps<typeof SeekBar>> = {}) {
  const view = render(
    <SeekBar currentTime={0} duration={100} bufferedEnd={0} onSeek={() => {}} {...extra} />,
  );
  const slider = screen.getByRole('slider', { name: 'Seek' });
  slider.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 32, right: 1000, bottom: 32 }) as DOMRect;
  return { ...view, slider };
}

const fetcher = (body = VTT, status = 200) =>
  vi.fn(async () => new Response(body, { status }));

describe('SeekBar preview thumbnails', () => {
  it('downloads nothing until the pointer first moves over the bar', async () => {
    const f = fetcher();
    const { slider } = bar({ spriteUrl: MAP, fetcher: f as never });
    expect(f).not.toHaveBeenCalled();
    fireEvent.pointerMove(slider, { clientX: 100 });
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    fireEvent.pointerMove(slider, { clientX: 200 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('shows the tile for the hovered time above the bar with the time under it', async () => {
    const { slider, container } = bar({ spriteUrl: MAP, fetcher: fetcher() as never });
    fireEvent.pointerMove(slider, { clientX: 70 });
    await waitFor(() => expect(container.querySelector('.adp-seek__preview')).not.toBeNull());
    const preview = container.querySelector<HTMLElement>('.adp-seek__preview-img')!;
    expect(preview.style.backgroundImage).toContain('https://m.test/cap/p/sprites/s1.jpg');
    expect(preview.style.backgroundPosition).toBe('-160px 0px');
    expect(preview.style.width).toBe('160px');
    expect(container.querySelector('.adp-seek__tip')?.textContent).toBe('0:07');
  });

  it('hides the preview when the pointer leaves', async () => {
    const { slider, container } = bar({ spriteUrl: MAP, fetcher: fetcher() as never });
    fireEvent.pointerMove(slider, { clientX: 70 });
    await waitFor(() => expect(container.querySelector('.adp-seek__preview')).not.toBeNull());
    fireEvent.pointerLeave(slider);
    expect(container.querySelector('.adp-seek__preview')).toBeNull();
  });

  it('never fetches with Data saver on, and keeps the time tip', () => {
    const f = fetcher();
    const { slider, container } = bar({ spriteUrl: null, fetcher: f as never });
    fireEvent.pointerMove(slider, { clientX: 70 });
    expect(f).not.toHaveBeenCalled();
    expect(container.querySelector('.adp-seek__tip')?.textContent).toBe('0:07');
    expect(container.querySelector('.adp-seek__preview')).toBeNull();
  });

  it('shows only the time when the map cannot be loaded', async () => {
    const f = fetcher('nope', 404);
    const { slider, container } = bar({ spriteUrl: MAP, fetcher: f as never });
    await act(async () => {
      fireEvent.pointerMove(slider, { clientX: 70 });
    });
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.querySelector('.adp-seek__preview')).toBeNull();
    expect(container.querySelector('.adp-seek__tip')?.textContent).toBe('0:07');
  });

  it('keeps the preview inside the bar near the edges', async () => {
    const { slider, container } = bar({ spriteUrl: MAP, fetcher: fetcher() as never });
    fireEvent.pointerMove(slider, { clientX: 5 });
    await waitFor(() => expect(container.querySelector('.adp-seek__preview')).not.toBeNull());
    expect(container.querySelector<HTMLElement>('.adp-seek__tip')!.style.left).toBe('80px');
  });
});
