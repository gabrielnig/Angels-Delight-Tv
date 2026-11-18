// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlowDown } from './SlowDown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SlowDown (M06-S10)', () => {
  it('counts down the wait and then asks the page to try again', () => {
    const onReady = vi.fn();
    render(<SlowDown seconds={3} onReady={onReady} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Slow down a little. Try again in 3 seconds.',
    );
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status')).toHaveTextContent('Try again in 2 seconds.');
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status')).toHaveTextContent('Try again in 1 second.');
    expect(onReady).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1000));
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('never waits less than one second or more than a minute on screen', () => {
    const { rerender } = render(<SlowDown seconds={0} onReady={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Try again in 1 second.');
    rerender(<SlowDown seconds={900} onReady={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Try again in 60 seconds.');
  });
});
