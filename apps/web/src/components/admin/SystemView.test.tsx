// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureQuality, storageBudget } from '@/lib/data/admin/system-rules';
import { getStore } from '@/lib/data/admin/store';
import { SystemView } from './SystemView';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const s = structuredClone(getStore());
function view(jobs = s.jobs, canAct = true) {
  const actions = {
    retry: vi.fn().mockResolvedValue({ ok: true }),
    discard: vi.fn().mockResolvedValue({ ok: true }),
  };
  render(
    <ToastProvider>
      <SystemView
        jobs={jobs}
        storage={s.storage}
        quality={fixtureQuality()}
        now={Date.now()}
        canAct={canAct}
        actions={actions}
      />
    </ToastProvider>,
  );
  return actions;
}

describe('SystemView', () => {
  it('lists failed jobs with the state in words and retries one', async () => {
    const a = view();
    expect(screen.getByText('Gave up')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Retry Encoding for/ }));
    await waitFor(() => expect(a.retry).toHaveBeenCalledWith('job_1'));
  });
  it('asks for a reason before discarding', async () => {
    const a = view();
    fireEvent.click(screen.getByRole('button', { name: /Discard Encoding for/ }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Source deleted' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard job' }));
    await waitFor(() => expect(a.discard).toHaveBeenCalledWith('job_1', 'Source deleted'));
  });
  it('has an empty state with no jobs', () => {
    view([]);
    expect(screen.getByText('No failed jobs.')).toBeTruthy();
  });
  it('switches to storage and player quality tabs', () => {
    view();
    fireEvent.click(screen.getByRole('tab', { name: 'Storage' }));
    expect(screen.getByText(/Storage used:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Player quality' }));
    expect(screen.getByRole('group', { name: 'Slow start time' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Playback errors by code' })).toBeTruthy();
  });
  it('locks actions without rights', () => {
    view(s.jobs, false);
    expect(
      (screen.getAllByRole('button', { name: /Retry/ })[0] as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('hides the Jobs tab from an admin and starts on Storage (M30-S03 is Super admin only)', () => {
    render(
      <ToastProvider>
        <SystemView
          jobs={[]}
          storage={s.storage}
          quality={fixtureQuality()}
          now={Date.now()}
          canAct={false}
          showJobs={false}
          actions={{ retry: vi.fn(), discard: vi.fn() }}
        />
      </ToastProvider>,
    );
    expect(screen.queryByRole('tab', { name: /Jobs/ })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Storage', selected: true })).toBeTruthy();
  });
});

describe('storage budget (M22-S03)', () => {
  const GB = 1024 ** 3;
  function storageTab(budget: ReturnType<typeof storageBudget> | null) {
    render(
      <ToastProvider>
        <SystemView
          jobs={[]}
          storage={s.storage}
          budget={budget}
          quality={fixtureQuality()}
          now={Date.now()}
          canAct={false}
          showJobs={false}
          actions={{ retry: vi.fn(), discard: vi.fn() }}
        />
      </ToastProvider>,
    );
  }
  it('shows the estimate and stays quiet under 80 percent', () => {
    storageTab(storageBudget({ usedBytes: 10 * GB, growth30Bytes: 5 * GB, capBytes: 100 * GB }));
    expect(screen.getByText(/Estimated in 30 days/)).toBeTruthy();
    expect(screen.queryByText(/80 percent of your storage budget/)).toBeNull();
    expect(screen.getByRole('progressbar', { name: /of your storage budget/ })).toBeTruthy();
  });
  it('warns in words with an icon at 80 percent', () => {
    storageTab(storageBudget({ usedBytes: 82 * GB, growth30Bytes: 1 * GB, capBytes: 100 * GB }));
    expect(screen.getByText(/80 percent of your storage budget/)).toBeTruthy();
  });
  it('says Not available when the usage query failed', () => {
    storageTab(null);
    expect(screen.getByText(/Not available/)).toBeTruthy();
  });
});
