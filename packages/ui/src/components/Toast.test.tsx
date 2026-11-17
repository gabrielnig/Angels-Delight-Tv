import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function Trigger({
  message,
  variant,
  action,
}: {
  message: string;
  variant?: 'success' | 'error' | 'info' | 'warning';
  action?: { label: string; onClick: () => void };
}) {
  const toast = useToast();
  return <button onClick={() => toast.show({ message, variant, action })}>fire {message}</button>;
}

describe('Toast', () => {
  it('announces in a polite live region with an icon and text', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger message="Added to My List." variant="success" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /fire/ }));
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Added to My List.');
    expect(toast.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('auto dismisses success toasts after 5 seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger message="Saved." variant="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: /fire/ }).click();
    });
    expect(screen.getByText('Saved.')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.queryByText('Saved.')).toBeNull();
  });

  it('keeps error toasts until dismissed and uses role alert', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger message="Could not save." variant="error" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /fire/ }));
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Could not save.')).toBeNull();
  });

  it('runs the action such as Undo and then dismisses', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger message="Removed." action={{ label: 'Undo', onClick: onUndo }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: /fire/ }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
    expect(screen.queryByText('Removed.')).toBeNull();
  });

  it('shows one toast at a time and queues the rest', async () => {
    const user = userEvent.setup();
    function Two() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast.show({ message: 'First.' });
            toast.show({ message: 'Second.' });
          }}
        >
          fire two
        </button>
      );
    }
    render(
      <ToastProvider>
        <Two />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'fire two' }));
    expect(screen.getByText('First.')).toBeInTheDocument();
    expect(screen.queryByText('Second.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByText('Second.')).toBeInTheDocument();
  });

  it('pauses the timer while the pointer is over the toast', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger message="Hold on." variant="info" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: /fire/ }).click();
    });
    const toast = screen.getByText('Hold on.').closest('.ad-toast') as HTMLElement;
    act(() => {
      toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('Hold on.')).toBeInTheDocument();
  });
});
