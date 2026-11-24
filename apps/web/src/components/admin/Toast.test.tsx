// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastInput } from './Toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Show({ toast }: { toast: ToastInput }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(toast)}>
      go
    </button>
  );
}

describe('Toast', () => {
  it('leaves after 5 seconds by default', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Show toast={{ message: 'Saved.' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByText('Saved.')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(5100));
    expect(screen.queryByText('Saved.')).toBeNull();
  });

  it('an Undo toast stays for its own duration and runs the action', () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Show toast={{ message: 'Trash: 3 done.', actionLabel: 'Undo', onAction, durationMs: 10000 }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    act(() => void vi.advanceTimersByTime(6000));
    expect(screen.getByText('Trash: 3 done.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalled();
    expect(screen.queryByText('Trash: 3 done.')).toBeNull();
  });

  it('the Undo button disappears when the time is up', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Show toast={{ message: 'Done.', actionLabel: 'Undo', onAction: () => {}, durationMs: 10000 }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    act(() => void vi.advanceTimersByTime(10100));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
