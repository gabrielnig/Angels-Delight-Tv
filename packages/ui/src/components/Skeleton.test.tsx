import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Skeleton, SkeletonCard, SkeletonRegion } from './Skeleton';

describe('SkeletonRegion', () => {
  it('shows nothing for the first 300ms so quick loads never flash', () => {
    vi.useFakeTimers();
    render(<SkeletonRegion label="Loading videos" />);
    expect(screen.queryByText('Loading videos')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.queryByText('Loading videos')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByText('Loading videos')).toBeInTheDocument();
  });

  it('marks the container busy once visible and hides shapes', () => {
    vi.useFakeTimers();
    const { container } = render(
      <SkeletonRegion label="Loading" delayMs={0}>
        <Skeleton height="2rem" />
      </SkeletonRegion>,
    );
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.ad-skeleton')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows immediately when delay is zero', () => {
    render(<SkeletonRegion label="Loading" delayMs={0} />);
    expect(screen.getByText('Loading')).toHaveClass('ad-sr-only');
  });
});

describe('SkeletonCard', () => {
  it('is a 16 by 9 box with two text bars', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll('.ad-skeleton').length).toBe(3);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
