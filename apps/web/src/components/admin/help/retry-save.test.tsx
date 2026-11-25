// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../Toast';
import { SAVE_FAILED_MESSAGE, useSaveQueue } from './retry-save';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let queue: ReturnType<typeof useSaveQueue>;
function Probe() {
  queue = useSaveQueue();
  return null;
}
const setup = () =>
  render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );

describe('useSaveQueue (S198 progress save toast)', () => {
  it('stays quiet when the save works', async () => {
    setup();
    const task = vi.fn(async () => ({ ok: true }));
    await act(async () => {
      expect(await queue.save('done:D02', task)).toBe(true);
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('shows one quiet toast when a save fails and retries when the connection returns', async () => {
    setup();
    const task = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });
    await act(async () => {
      expect(await queue.save('done:D02', task)).toBe(false);
    });
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent(SAVE_FAILED_MESSAGE);
    expect(SAVE_FAILED_MESSAGE).toBe(
      'We could not save your progress. We will try again when you are online.',
    );
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(task).toHaveBeenCalledTimes(2);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('retries by itself on a timer and a newer save for the same item replaces the old one', async () => {
    vi.useFakeTimers();
    setup();
    const first = vi.fn(async () => ({ ok: false }));
    const second = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });
    await act(async () => {
      await queue.save('done:D02', first);
      await queue.save('done:D02', second);
    });
    await act(async () => {
      vi.advanceTimersByTime(21_000);
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('counts a thrown save as a failure', async () => {
    setup();
    await act(async () => {
      expect(
        await queue.save('x', async () => {
          throw new Error('offline');
        }),
      ).toBe(false);
    });
    expect(screen.getByRole('status')).toHaveTextContent(SAVE_FAILED_MESSAGE);
  });
});
