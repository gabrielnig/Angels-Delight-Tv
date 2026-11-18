// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { RowError } from './RowError';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../app/actions', () => ({
  toggleListAction: vi.fn(),
  restoreContinueAction: vi.fn(),
  removeContinueAction: vi.fn(),
}));

const item = {
  kind: 'video',
  id: 'v1',
  slug: 'v1',
  title: 'Counting money',
  durationSeconds: 300,
  description: '',
} as never;

function setup(load: () => Promise<unknown[]>) {
  return render(
    <ToastProvider>
      <RowError title="My List" kind="list" inList={[]} load={load as never} />
    </ToastProvider>,
  );
}

describe('RowError per row retry (M05-S02)', () => {
  it('retries only this row and shows its cards on success', async () => {
    const load = vi.fn().mockResolvedValue([item]);
    setup(load);
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    await waitFor(() => expect(screen.getAllByText('Counting money').length).toBeGreaterThan(0));
    expect(load).toHaveBeenCalledOnce();
  });

  it('stays an error row when the retry fails again', async () => {
    const load = vi.fn().mockRejectedValue(new Error('x'));
    setup(load);
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /try again|retry/i })).toBeTruthy();
  });

  it('shows nothing when the retried row turns out empty', async () => {
    const load = vi.fn().mockResolvedValue([]);
    const { container } = setup(load);
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    await waitFor(() => expect(container.querySelector('section')).toBeNull());
  });
});
