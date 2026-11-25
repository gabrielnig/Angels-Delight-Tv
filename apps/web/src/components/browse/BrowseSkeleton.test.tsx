// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowseSkeleton } from './BrowseSkeleton';

afterEach(() => vi.useRealTimers());

describe('BrowseSkeleton (L11 slice 3)', () => {
  it('waits 300 ms so quick loads never flash, then shows ten card shapes in the real grid', () => {
    vi.useFakeTimers();
    const { container } = render(<BrowseSkeleton label="Loading videos" />);
    expect(container.querySelector('.web-grid')).toBeNull();
    act(() => void vi.advanceTimersByTime(300));
    expect(container.querySelectorAll('.web-grid > li')).toHaveLength(10);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading videos')).toBeInTheDocument();
  });

  it('reserves the height before and after the shapes appear', () => {
    const { container } = render(<BrowseSkeleton label="Loading videos" />);
    expect(container.querySelector('.web-browse-skeleton')).not.toBeNull();
  });
});
