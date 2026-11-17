// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  it('shows the offline banner, then a back online toast and syncs once', () => {
    const sync = vi.fn();
    render(<ConnectionStatus onBackOnline={sync} />);
    expect(screen.queryByText(/You are offline/)).toBeNull();
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByText('You are offline. Check your data or Wi-Fi.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.getByText('You are back online')).toBeInTheDocument();
    expect(screen.queryByText(/You are offline/)).toBeNull();
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on an online event when it was never offline', () => {
    const sync = vi.fn();
    render(<ConnectionStatus onBackOnline={sync} />);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByText('You are back online')).toBeNull();
    expect(sync).not.toHaveBeenCalled();
  });
});
