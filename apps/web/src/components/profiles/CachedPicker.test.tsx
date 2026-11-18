// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../lib/data';
import { PICKER_CACHE_KEY, savePickerCache } from '../../lib/profiles/picker-cache';
import { CachedPicker } from './CachedPicker';

const p = (id: string, name: string): Profile => ({
  id,
  name,
  kids: false,
  owner: id === 'p1',
  language: 'en',
  autoplayNext: true,
});
const list = [p('p1', 'Adaeze'), p('p2', 'Emeka')];
const NOW = 1_800_000_000_000;

beforeEach(() => localStorage.clear());

const view = (fresh: Profile[] | null | 'loading', extra: Partial<Parameters<typeof CachedPicker>[0]> = {}) =>
  render(
    <CachedPicker
      accountId="acct-1"
      fresh={fresh}
      max={5}
      now={() => NOW}
      onSelect={vi.fn()}
      {...extra}
    />,
  );

describe('CachedPicker (M03-S13)', () => {
  it('shows the fresh list, saves it for the next visit and shows no stale note', () => {
    view(list);
    expect(screen.getByRole('button', { name: 'Switch to Adaeze' })).toBeInTheDocument();
    expect(screen.queryByText('May be out of date')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(PICKER_CACHE_KEY)!);
    expect(saved.accountId).toBe('acct-1');
    expect(saved.profiles.map((x: { name: string }) => x.name)).toEqual(['Adaeze', 'Emeka']);
  });

  it('falls back to the cached list with a small note when the refresh failed', () => {
    savePickerCache(localStorage, 'acct-1', list, NOW - 1000);
    view(null);
    expect(screen.getByRole('button', { name: 'Switch to Emeka' })).toBeInTheDocument();
    expect(screen.getByText('May be out of date')).toBeInTheDocument();
  });

  it('shows the error state with Retry when the refresh failed and nothing is cached', async () => {
    const onRetry = vi.fn();
    view(null, { onRetry });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('ignores a cache older than 7 days', () => {
    savePickerCache(localStorage, 'acct-1', list, NOW - 8 * 24 * 60 * 60 * 1000);
    view(null, { onRetry: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Switch to Adaeze' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not wipe a good cache when the fresh list is null', () => {
    savePickerCache(localStorage, 'acct-1', list, NOW - 1000);
    view(null);
    expect(JSON.parse(localStorage.getItem(PICKER_CACHE_KEY)!).profiles).toHaveLength(2);
  });

  it('draws the cached tiles at once while the server is still answering, without extending the cache', () => {
    const savedAt = NOW - 5 * 24 * 60 * 60 * 1000;
    savePickerCache(localStorage, 'acct-1', list, savedAt);
    view('loading');
    expect(screen.getByRole('button', { name: 'Switch to Adaeze' })).toBeInTheDocument();
    expect(screen.getByText('Updating your profiles')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(PICKER_CACHE_KEY)!).savedAt).toBe(savedAt);
  });

  it('shows the loading skeleton while answering when nothing is cached', () => {
    vi.useFakeTimers();
    view('loading');
    act(() => {
      vi.advanceTimersByTime(301);
    });
    expect(screen.getByText('Loading profiles')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
