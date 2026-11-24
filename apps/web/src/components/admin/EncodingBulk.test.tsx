// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FailedEncodeRecord, VideoRecord } from '@/lib/data/admin/types';
import { seedStore } from '@/lib/data/admin/store';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const { EncodingQueue } = await import('./EncodingQueue');
const { FailedEncodes } = await import('./FailedEncodes');
const { ToastProvider } = await import('./Toast');

const NOW = Date.parse('2026-11-17T09:00:00Z');
const base = seedStore(NOW).videos[0]!;
const job = (id: string, status: VideoRecord['status']): VideoRecord => ({
  ...base,
  id,
  title: `Job ${id}`,
  status,
  progress: 40,
  failure: status === 'failed' ? { stage: 'Encoding', reason: 'Bad frame.' } : null,
});

const outcome = (over = {}) => ({ bulkId: 'b', succeeded: [], failed: [], skipped: [], ...over });

function queue(jobs: VideoRecord[], retryMany = vi.fn(async (ids: string[]) => outcome({ succeeded: ids }))) {
  const ui = (list: VideoRecord[]) => (
    <ToastProvider>
      <EncodingQueue jobs={list} now={NOW} retry={vi.fn()} retryMany={retryMany} />
    </ToastProvider>
  );
  const view = render(ui(jobs));
  return { retryMany, rerender: (list: VideoRecord[]) => view.rerender(ui(list)) };
}
const tick = (title: string) =>
  userEvent.click(screen.getByRole('checkbox', { name: `Select ${title}` }));

describe('EncodingQueue bulk retry', () => {
  it('gives checkboxes to failed rows only', () => {
    queue([job('a', 'failed'), job('b', 'encoding'), job('c', 'validating')]);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('shows Retry with the count, says the jobs run one after another, then retries the selection', async () => {
    const { retryMany } = queue([job('a', 'failed'), job('b', 'failed'), job('c', 'encoding')]);
    await tick('Job a');
    await tick('Job b');
    await userEvent.click(screen.getByRole('button', { name: 'Retry 2 failed' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/one after another/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry 2' }));
    await waitFor(() => expect(retryMany).toHaveBeenCalledWith(['a', 'b'], expect.any(String)));
  });

  it('keeps the selection through a live refresh and drops rows that were retried', async () => {
    const { rerender } = queue([job('a', 'failed'), job('b', 'failed')]);
    await tick('Job a');
    await tick('Job b');
    rerender([job('a', 'failed'), job('b', 'failed')]);
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('2 selected');
    rerender([job('a', 'failed'), job('b', 'encoding')]);
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('1 selected');
  });

  it('lists skipped rows in the result', async () => {
    const retryMany = vi.fn(async () =>
      outcome({ succeeded: ['a'], skipped: [{ id: 'b', reason: 'The original file was removed. Replace the file instead.' }] }),
    );
    queue([job('a', 'failed'), job('b', 'failed')], retryMany);
    await tick('Job a');
    await tick('Job b');
    await userEvent.click(screen.getByRole('button', { name: 'Retry 2 failed' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retry 2' }));
    expect(await screen.findByText(/original file was removed/)).toBeInTheDocument();
  });
});

const failedRow = (id: string, over: Partial<FailedEncodeRecord> = {}): FailedEncodeRecord => ({
  videoId: id,
  title: `Failed ${id}`,
  failedAt: '2026-11-16T10:00:00.000Z',
  code: null,
  plain: 'Could not convert.',
  technical: null,
  stage: null,
  attempts: 3,
  hasOriginal: true,
  originalBytes: 1000,
  canRetry: true,
  leftoverFiles: 2,
  leftoverBytes: 50,
  ...over,
});

function failed(rows: FailedEncodeRecord[]) {
  const retryMany = vi.fn(async (ids: string[]) => outcome({ succeeded: ids }));
  const cleanupMany = vi.fn(async (ids: string[]) => outcome({ succeeded: ids }));
  const cleanupAll = vi.fn(async () => ({ ok: true as const, videos: 2, removedFiles: 4, freedBytes: 100 }));
  render(
    <ToastProvider>
      <FailedEncodes
        rows={rows}
        role="admin"
        now={NOW}
        retry={vi.fn()}
        cleanup={vi.fn()}
        cleanupAll={cleanupAll}
        retryMany={retryMany}
        cleanupMany={cleanupMany}
      />
    </ToastProvider>,
  );
  return { retryMany, cleanupMany, cleanupAll };
}

describe('FailedEncodes bulk', () => {
  it('Retry and Clean up work on the selection', async () => {
    const { retryMany, cleanupMany } = failed([failedRow('a'), failedRow('b')]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Failed a' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Failed b' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clean up 2' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clean up 2' }));
    await waitFor(() => expect(cleanupMany).toHaveBeenCalledWith(['a', 'b'], expect.any(String)));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Failed a' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry 1' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retry 1' }));
    await waitFor(() => expect(retryMany).toHaveBeenCalledWith(['a'], expect.any(String)));
  });

  it('Clean up all still works with nothing selected', async () => {
    const { cleanupAll } = failed([failedRow('a')]);
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Clean up all' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clean up all' }));
    await waitFor(() => expect(cleanupAll).toHaveBeenCalled());
  });

  it('counts only retryable rows in the Retry button and says how many have leftover files', async () => {
    failed([failedRow('a'), failedRow('b', { canRetry: false, hasOriginal: false, leftoverFiles: 0, leftoverBytes: 0 })]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Failed a' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Failed b' }));
    expect(screen.getByRole('button', { name: 'Retry 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clean up 1' })).toBeInTheDocument();
    expect(screen.getByText('1 cannot be retried')).toBeInTheDocument();
  });
});
