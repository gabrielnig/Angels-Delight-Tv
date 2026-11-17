import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressReporter, ProgressSinkError, type ProgressSink } from './progress';

function setup(extra: Partial<ConstructorParameters<typeof ProgressReporter>[0]> = {}) {
  const save = vi.fn<ProgressSink['save']>().mockResolvedValue(undefined);
  const onUnauthorized = vi.fn();
  const onForbidden = vi.fn();
  const reporter = new ProgressReporter({
    sink: { save },
    videoId: 'v1',
    profileId: 'p1',
    onUnauthorized,
    onForbidden,
    ...extra,
  });
  return { save, reporter, onUnauthorized, onForbidden };
}

describe('ProgressReporter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports every 15 seconds while playing', async () => {
    const { save, reporter } = setup();
    reporter.update(10, 300);
    reporter.setPlaying(true);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(save).not.toHaveBeenCalled();
    reporter.update(25, 300);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(
      { videoId: 'v1', profileId: 'p1', positionSeconds: 25, durationSeconds: 300, ended: false },
      undefined,
    );
    reporter.update(40, 300);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(save).toHaveBeenCalledTimes(2);
    reporter.dispose();
  });

  it('stops the interval when paused', async () => {
    const { save, reporter } = setup();
    reporter.update(10, 300);
    reporter.setPlaying(true);
    reporter.setPlaying(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).not.toHaveBeenCalled();
    reporter.dispose();
  });

  it('flushes at once on pause, seek and hidden', async () => {
    const { save, reporter } = setup();
    reporter.update(12, 300);
    await reporter.flush('pause');
    reporter.update(80, 300);
    await reporter.flush('seek');
    reporter.update(81, 300);
    await reporter.flush('hidden');
    expect(save).toHaveBeenCalledTimes(3);
    reporter.dispose();
  });

  it('does not resend an unchanged position', async () => {
    const { save, reporter } = setup();
    reporter.update(12, 300);
    await reporter.flush('pause');
    await reporter.flush('hidden');
    expect(save).toHaveBeenCalledTimes(1);
    reporter.dispose();
  });

  it('marks the final write as ended', async () => {
    const { save, reporter } = setup();
    reporter.update(299, 300);
    await reporter.flush('ended');
    expect(save.mock.calls[0]?.[0]).toMatchObject({ positionSeconds: 300, ended: true });
    reporter.dispose();
  });

  it('skips writes until the duration is known', async () => {
    const { save, reporter } = setup();
    reporter.update(5, Number.NaN);
    await reporter.flush('pause');
    expect(save).not.toHaveBeenCalled();
    reporter.dispose();
  });

  it('sends a beacon write on page hide', () => {
    const { save, reporter } = setup();
    reporter.update(33, 300);
    reporter.beacon();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ positionSeconds: 33 }), {
      beacon: true,
    });
    reporter.dispose();
  });

  it('keeps only the newest write when the network fails, and sends it on retry', async () => {
    const { save, reporter } = setup();
    save.mockRejectedValue(new ProgressSinkError(0, 'offline'));
    reporter.update(20, 300);
    await reporter.flush('pause');
    reporter.update(45, 300);
    await reporter.flush('pause');
    expect(reporter.hasPending).toBe(true);
    save.mockResolvedValue(undefined);
    await reporter.retryPending();
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ positionSeconds: 45 }),
      undefined,
    );
    expect(reporter.hasPending).toBe(false);
    reporter.dispose();
  });

  it('does not write while offline and queues the newest position', async () => {
    let online = false;
    const { save, reporter } = setup({ isOnline: () => online });
    reporter.update(20, 300);
    await reporter.flush('pause');
    expect(save).not.toHaveBeenCalled();
    expect(reporter.hasPending).toBe(true);
    online = true;
    await reporter.retryPending();
    expect(save).toHaveBeenCalledTimes(1);
    reporter.dispose();
  });

  it('reports 401 and 403 to the host and drops the pending write', async () => {
    const a = setup();
    a.save.mockRejectedValue(new ProgressSinkError(401));
    a.reporter.update(20, 300);
    await a.reporter.flush('pause');
    expect(a.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(a.reporter.hasPending).toBe(false);

    const b = setup();
    b.save.mockRejectedValue(new ProgressSinkError(403));
    b.reporter.update(20, 300);
    await b.reporter.flush('pause');
    expect(b.onForbidden).toHaveBeenCalledTimes(1);
  });
});
