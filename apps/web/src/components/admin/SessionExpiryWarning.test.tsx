// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ path: '/admin' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
import { SessionExpiryWarning, countdownLabel } from './SessionExpiryWarning';

beforeEach(() => {
  nav.path = '/admin';
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const MIN = 60_000;

describe('countdownLabel', () => {
  it('shows minutes and seconds', () => {
    expect(countdownLabel(125_000)).toBe('2:05');
    expect(countdownLabel(59_001)).toBe('1:00');
    expect(countdownLabel(0)).toBe('0:00');
    expect(countdownLabel(-5)).toBe('0:00');
  });
});

describe('SessionExpiryWarning', () => {
  const setup = (remainingMs: number, extend = vi.fn()) => {
    render(
      <SessionExpiryWarning
        remainingMs={remainingMs}
        idleMs={30 * MIN}
        absoluteMs={8 * 60 * MIN}
        warnMs={2 * MIN}
        extend={extend}
        signInHref="/admin/login?expired=1"
      />,
    );
    return extend;
  };

  it('stays quiet while there is plenty of time', () => {
    setup(20 * MIN);
    act(() => void vi.advanceTimersByTime(10 * MIN));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('warns two minutes before the end with a countdown', () => {
    setup(5 * MIN);
    act(() => void vi.advanceTimersByTime(3 * MIN + 1000));
    expect(
      screen.getByRole('heading', { name: 'You will be signed out soon' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1:59')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(9000));
    expect(screen.getByText('1:50')).toBeInTheDocument();
  });

  it('opens straight away when little time is left', () => {
    setup(90_000);
    act(() => void vi.advanceTimersByTime(1000));
    expect(
      screen.getByRole('heading', { name: 'You will be signed out soon' }),
    ).toBeInTheDocument();
  });

  it('stays signed in and starts a new countdown', async () => {
    const extend = vi.fn().mockResolvedValue({ remainingMs: 30 * MIN });
    setup(90_000, extend);
    act(() => void vi.advanceTimersByTime(1000));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
    });
    expect(extend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'You will be signed out soon' })).toBeNull();
    act(() => void vi.advanceTimersByTime(20 * MIN));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says the session ended when time runs out, with a way back in', () => {
    setup(90_000);
    act(() => void vi.advanceTimersByTime(91_000));
    expect(screen.getByRole('heading', { name: 'You were signed out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
      'href',
      '/admin/login?expired=1',
    );
  });

  it('says so when staying signed in fails because the session already ended', async () => {
    const extend = vi.fn().mockResolvedValue(null);
    setup(90_000, extend);
    act(() => void vi.advanceTimersByTime(1000));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
    });
    expect(screen.getByRole('heading', { name: 'You were signed out' })).toBeInTheDocument();
  });

  it('starts again when the server sends a new remaining time (a page change)', () => {
    const { rerender } = render(
      <SessionExpiryWarning
        remainingMs={90_000}
        idleMs={30 * MIN}
        absoluteMs={8 * 60 * MIN}
        warnMs={2 * MIN}
        extend={vi.fn()}
        signInHref="/x"
      />,
    );
    act(() => void vi.advanceTimersByTime(1000));
    expect(
      screen.getByRole('heading', { name: 'You will be signed out soon' }),
    ).toBeInTheDocument();
    rerender(
      <SessionExpiryWarning
        key="fresh"
        remainingMs={30 * MIN}
        idleMs={30 * MIN}
        absoluteMs={8 * 60 * MIN}
        warnMs={2 * MIN}
        extend={vi.fn()}
        signInHref="/x"
      />,
    );
    expect(screen.queryByRole('heading', { name: 'You will be signed out soon' })).toBeNull();
  });

  it('counts moving to another page as activity', () => {
    const view = render(
      <SessionExpiryWarning
        remainingMs={5 * MIN}
        idleMs={30 * MIN}
        absoluteMs={8 * 60 * MIN}
        warnMs={2 * MIN}
        extend={vi.fn()}
        signInHref="/x"
      />,
    );
    act(() => void vi.advanceTimersByTime(4 * MIN));
    nav.path = '/admin/videos';
    view.rerender(
      <SessionExpiryWarning
        remainingMs={5 * MIN}
        idleMs={30 * MIN}
        absoluteMs={8 * 60 * MIN}
        warnMs={2 * MIN}
        extend={vi.fn()}
        signInHref="/x"
      />,
    );
    act(() => void vi.advanceTimersByTime(10 * MIN));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never extends past the daily limit', async () => {
    const extend = vi.fn().mockResolvedValue({ remainingMs: 30 * MIN });
    render(
      <SessionExpiryWarning
        remainingMs={90_000}
        idleMs={30 * MIN}
        absoluteMs={5 * MIN}
        warnMs={2 * MIN}
        extend={extend}
        signInHref="/x"
      />,
    );
    act(() => void vi.advanceTimersByTime(1000));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
    });
    act(() => void vi.advanceTimersByTime(3 * MIN + 30_000));
    expect(
      screen.getByRole('heading', { name: 'You will be signed out soon' }),
    ).toBeInTheDocument();
  });
});
