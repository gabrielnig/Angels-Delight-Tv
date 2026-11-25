// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PreviewBackfillOutcome } from '@/lib/data/admin/video-commands';
import { PreviewBackfillCard } from './PreviewBackfillCard';

afterEach(cleanup);

const show = (
  action = vi.fn<() => Promise<PreviewBackfillOutcome>>(async () => ({ ok: true, queued: 10, current: 0 })),
  canRun = true,
) => {
  render(<PreviewBackfillCard canRun={canRun} onRun={action} />);
  return action;
};

describe('PreviewBackfillCard', () => {
  it('explains what the button does and offers it', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Hero clips' })).toBeTruthy();
    expect(screen.getByText(/published video/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate previews for all videos' })).toBeTruthy();
  });

  it('queues the clips and says how many, and that they appear as the worker finishes', async () => {
    const action = show();
    fireEvent.click(screen.getByRole('button', { name: 'Generate previews for all videos' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Queued 10 videos/));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toMatch(/0 already have a current clip/);
    expect(screen.getByRole('status').textContent).toMatch(/Press it again any time/);
  });

  it('uses the singular for one video', async () => {
    show(vi.fn<() => Promise<PreviewBackfillOutcome>>(async () => ({ ok: true, queued: 1, current: 4 })));
    fireEvent.click(screen.getByRole('button', { name: 'Generate previews for all videos' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Queued 1 video\./));
  });

  it('says when nothing needed queuing', async () => {
    show(vi.fn<() => Promise<PreviewBackfillOutcome>>(async () => ({ ok: true, queued: 0, current: 10 })));
    fireEvent.click(screen.getByRole('button', { name: 'Generate previews for all videos' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Nothing to queue. 10 videos already have a current clip/));
  });

  it('shows the error in an alert and keeps the button usable', async () => {
    show(
      vi.fn<() => Promise<PreviewBackfillOutcome>>(async () => ({
        ok: false,
        error: 'That did not work. Nothing was queued. Try again.',
      })),
    );
    const button = screen.getByRole('button', { name: 'Generate previews for all videos' });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Nothing was queued/));
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('is disabled with a reason for anyone below admin', () => {
    const action = show(undefined, false);
    const button = screen.getByRole('button', { name: 'Generate previews for all videos' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Only admins can do this/)).toBeTruthy();
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
  });
});
