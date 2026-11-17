// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageLoading } from './PageLoading';

describe('PageLoading', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing for the first 300ms, then a busy region with its label', () => {
    const { container } = render(<PageLoading label="Loading Browse" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByText('Loading Browse')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading Browse')).toBeInTheDocument();
  });
});
