// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FailedEncodeRecord } from '@/lib/data/admin/types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('./Toast', () => ({ useToast: () => ({ show: vi.fn() }) }));
const { FailedEncodes } = await import('./FailedEncodes');

const base: FailedEncodeRecord = {
  videoId: 'v1',
  title: 'Staying Safe Online',
  failedAt: '2026-11-17T10:00:00.000Z',
  code: 'encode_failed',
  plain: 'The video could not be converted. Try exporting it again.',
  technical: 'ffmpeg exited with 1: Invalid data',
  stage: 'Making 720p',
  attempts: 3,
  hasOriginal: true,
  originalBytes: 52_428_800,
  canRetry: true,
  leftoverFiles: 4,
  leftoverBytes: 313,
};

function setup(rows: FailedEncodeRecord[], role: 'admin' | 'editor' = 'admin') {
  const retry = vi.fn(async () => ({ ok: true as const }));
  const cleanup = vi.fn(async () => ({ ok: true as const, videos: 1, removedFiles: 4, freedBytes: 313 }));
  const cleanupAll = vi.fn(async () => ({ ok: true as const, videos: 2, removedFiles: 8, freedBytes: 626 }));
  render(
    <FailedEncodes
      rows={rows}
      role={role}
      now={Date.parse('2026-11-18T10:00:00.000Z')}
      retry={retry}
      cleanup={cleanup}
      cleanupAll={cleanupAll}
    />,
  );
  return { retry, cleanup, cleanupAll };
}

describe('FailedEncodes', () => {
  it('shows the plain reason, the attempts and what is left over', () => {
    setup([base]);
    expect(screen.getByText(/could not be converted/)).toBeInTheDocument();
    expect(screen.getByText(/Tried 3 times/)).toBeInTheDocument();
    expect(screen.getByText(/4 leftover files/)).toBeInTheDocument();
  });

  it('keeps technical detail behind a disclosure and only for admins', () => {
    const { unmount } = render(<div />);
    unmount();
    setup([base], 'admin');
    expect(screen.getByText('Technical detail')).toBeInTheDocument();
    expect(screen.getByText(/Invalid data/)).toBeInTheDocument();
  });

  it('hides the technical section from an editor', () => {
    setup([{ ...base, technical: null }], 'editor');
    expect(screen.queryByText('Technical detail')).toBeNull();
  });

  it('retries a video that still has its file', async () => {
    const { retry } = setup([base]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry Staying Safe Online' }));
    await waitFor(() => expect(retry).toHaveBeenCalledWith('v1'));
  });

  it('asks for a new file instead of offering Retry when the original is gone', () => {
    setup([{ ...base, hasOriginal: false, canRetry: false }]);
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
    expect(screen.getByText(/original file was removed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Replace file/ })).toHaveAttribute(
      'href',
      '/admin/videos/upload?replace=v1',
    );
  });

  it('cleans up one video after a confirmation that says the original is kept', async () => {
    const { cleanup } = setup([base]);
    await userEvent.click(screen.getByRole('button', { name: 'Clean up Staying Safe Online' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/original video file is not touched/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clean up' }));
    await waitFor(() => expect(cleanup).toHaveBeenCalledWith('v1'));
  });

  it('offers nothing to clean when there are no leftovers', () => {
    setup([{ ...base, leftoverFiles: 0, leftoverBytes: 0 }]);
    expect(screen.queryByRole('button', { name: /Clean up Staying/ })).toBeNull();
    expect(screen.getByText('No leftover files')).toBeInTheDocument();
  });

  it('cleans every failed video at once', async () => {
    const { cleanupAll } = setup([base, { ...base, videoId: 'v2', title: 'Second' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Clean up all' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clean up all' }));
    await waitFor(() => expect(cleanupAll).toHaveBeenCalled());
  });

  it('shows an empty state with a way back', () => {
    setup([]);
    expect(screen.getByText('No failed encodes.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the encoding queue' })).toHaveAttribute(
      'href',
      '/admin/encoding',
    );
  });
});
