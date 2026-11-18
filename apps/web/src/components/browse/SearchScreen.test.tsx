// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let resolveNav: () => void = () => {};
const replace = vi.fn(() => new Promise<void>((resolve) => (resolveNav = resolve)));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('../../app/actions', () => ({ suggestAction: vi.fn(async () => []) }));

import { SearchScreen } from './SearchScreen';

afterEach(() => vi.useRealTimers());

describe('SearchScreen while a new search loads (M06-S09)', () => {
  it('shows the progress line from the live query until the navigation settles', async () => {
    vi.useFakeTimers();
    render(<SearchScreen initialValue="farm" />);
    expect(screen.queryByRole('progressbar', { name: 'Loading results' })).toBeNull();
    const input = screen.getByRole('combobox');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(input, { target: { value: 'farming' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(replace).toHaveBeenCalledWith('/search?q=farming');
    expect(screen.getByRole('progressbar', { name: 'Loading results' })).toBeInTheDocument();
    await act(async () => {
      resolveNav();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.queryByRole('progressbar', { name: 'Loading results' })).toBeNull();
  });
});
