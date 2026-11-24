// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListPageSkeleton } from './ListPageSkeleton';

describe('ListPageSkeleton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays empty for 300ms so quick loads never flash', () => {
    const { container } = render(<ListPageSkeleton label="Loading New" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(container.querySelector('.web-grid')).toBeNull();
  });

  it('then shows a labelled busy region with a title bar and a grid of ten card shapes', () => {
    const { container } = render(<ListPageSkeleton label="Loading New" />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading New')).toBeInTheDocument();
    expect(container.querySelector('ul.web-grid')).not.toBeNull();
    expect(container.querySelectorAll('.ad-skelcard')).toHaveLength(10);
  });

  it('reserves its height from the first paint through a class on the region', () => {
    const { container } = render(<ListPageSkeleton label="Loading New" />);
    expect(container.querySelector('.ad-skeleton-region.web-list-skeleton')).not.toBeNull();
  });
});
