'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BULK_CHUNK,
  chunkIds,
  emptyOutcome,
  mergeOutcomes,
  newBulkId,
  type BulkOutcome,
} from '@/lib/data/admin/bulk';

export type RunChunk = (ids: string[], bulkId: string) => Promise<BulkOutcome>;

/**
 * Runs a server action over chunks of ids, one after another. It tracks progress, can be cancelled between
 * chunks, waits while the browser is offline, and turns a thrown chunk into an interrupted outcome that says
 * how many ids were done so the person can continue.
 */
export function useBulkRun(runChunk: RunChunk, options: { chunkSize?: number } = {}) {
  const size = options.chunkSize ?? BULK_CHUNK;
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [offline, setOffline] = useState(false);
  const cancelled = useRef(false);
  const waiters = useRef<Array<() => void>>([]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      for (const wake of waiters.current.splice(0)) wake();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const waitOnline = useCallback(async () => {
    if (typeof navigator === 'undefined' || navigator.onLine) return;
    setOffline(true);
    await new Promise<void>((resolve) => waiters.current.push(resolve));
  }, []);

  const start = useCallback(
    async (
      ids: string[],
      bulkId: string = newBulkId(),
      chunkSizeOverride?: number,
    ): Promise<BulkOutcome> => {
      cancelled.current = false;
      setRunning(true);
      setProgress({ done: 0, total: ids.length });
      let outcome = emptyOutcome(bulkId);
      let done = 0;
      try {
        for (const chunk of chunkIds(ids, chunkSizeOverride ?? size)) {
          if (cancelled.current) break;
          await waitOnline();
          try {
            outcome = mergeOutcomes(outcome, await runChunk(chunk, bulkId));
          } catch {
            outcome = { ...outcome, interrupted: { done, total: ids.length } };
            return outcome;
          }
          done += chunk.length;
          setProgress({ done, total: ids.length });
        }
        if (done < ids.length) outcome = { ...outcome, interrupted: { done, total: ids.length } };
        return outcome;
      } finally {
        setRunning(false);
      }
    },
    [runChunk, size, waitOnline],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return { start, cancel, progress, running, offline };
}
