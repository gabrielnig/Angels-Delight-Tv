// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BulkOutcome } from '@/lib/data/admin/bulk';
import { emptyOutcome } from '@/lib/data/admin/bulk';
import { useBulkRun } from './useBulkRun';

afterEach(cleanup);

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);
const ok = (chunk: string[], bulkId: string): BulkOutcome => ({ ...emptyOutcome(bulkId), succeeded: chunk });

describe('useBulkRun', () => {
  it('runs chunks in order and reports progress', async () => {
    const calls: string[][] = [];
    const run = vi.fn(async (chunk: string[], bulkId: string) => {
      calls.push(chunk);
      return ok(chunk, bulkId);
    });
    const { result } = renderHook(() => useBulkRun(run, { chunkSize: 25 }));
    let outcome!: BulkOutcome;
    await act(async () => {
      outcome = await result.current.start(ids(60));
    });
    expect(calls.map((c) => c.length)).toEqual([25, 25, 10]);
    expect(outcome.succeeded).toHaveLength(60);
    expect(result.current.progress).toEqual({ done: 60, total: 60 });
    expect(result.current.running).toBe(false);
  });

  it('every chunk carries the same bulk id', async () => {
    const seen = new Set<string>();
    const run = vi.fn(async (chunk: string[], bulkId: string) => {
      seen.add(bulkId);
      return ok(chunk, bulkId);
    });
    const { result } = renderHook(() => useBulkRun(run, { chunkSize: 2 }));
    await act(async () => {
      await result.current.start(ids(5));
    });
    expect(seen.size).toBe(1);
  });

  it('cancel stops after the current chunk', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let n = 0;
    const run = vi.fn(async (chunk: string[], bulkId: string) => {
      n += 1;
      if (n === 1) await gate;
      return ok(chunk, bulkId);
    });
    const { result } = renderHook(() => useBulkRun(run, { chunkSize: 25 }));
    let pending!: Promise<BulkOutcome>;
    act(() => {
      pending = result.current.start(ids(75));
    });
    act(() => result.current.cancel());
    release();
    let outcome!: BulkOutcome;
    await act(async () => {
      outcome = await pending;
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome.succeeded).toHaveLength(25);
    expect(outcome.interrupted).toEqual({ done: 25, total: 75 });
  });

  it('pauses while offline and resumes online', async () => {
    const run = vi.fn(async (chunk: string[], bulkId: string) => ok(chunk, bulkId));
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const { result } = renderHook(() => useBulkRun(run, { chunkSize: 25 }));
    let pending!: Promise<BulkOutcome>;
    act(() => {
      pending = result.current.start(ids(30));
    });
    await waitFor(() => expect(result.current.offline).toBe(true));
    expect(run).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await pending;
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.current.offline).toBe(false);
    online.mockRestore();
  });

  it('a thrown chunk becomes an interrupted outcome with the done count', async () => {
    let n = 0;
    const run = vi.fn(async (chunk: string[], bulkId: string) => {
      n += 1;
      if (n === 2) throw new Error('network');
      return ok(chunk, bulkId);
    });
    const { result } = renderHook(() => useBulkRun(run, { chunkSize: 25 }));
    let outcome!: BulkOutcome;
    await act(async () => {
      outcome = await result.current.start(ids(60));
    });
    expect(outcome.succeeded).toHaveLength(25);
    expect(outcome.interrupted).toEqual({ done: 25, total: 60 });
    expect(run).toHaveBeenCalledTimes(2);
  });
});
