'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '../Toast';

type Saved = { ok: boolean };

export const SAVE_FAILED_MESSAGE =
  'We could not save your progress. We will try again when you are online.';

const RETRY_MS = 20_000;
const MAX_TRIES = 5;

/**
 * Saves that retry by themselves (S198). A failed save shows one quiet toast, the screen keeps the state the person
 * chose, and the save runs again when the browser comes back online and every 20 seconds, up to five tries. A newer
 * save for the same key replaces the older one. Nothing is stored: a closed tab drops the queue.
 */
export function useSaveQueue() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const pending = useRef(new Map<string, { task: () => Promise<Saved>; tries: number }>());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushing = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    for (const [key, item] of [...pending.current]) {
      let ok = false;
      try {
        ok = (await item.task()).ok;
      } catch {
        ok = false;
      }
      const current = pending.current.get(key);
      if (current !== item) continue;
      item.tries += 1;
      if (ok || item.tries >= MAX_TRIES) pending.current.delete(key);
    }
    flushing.current = false;
    if (pending.current.size === 0) stop();
  }, [stop]);

  useEffect(() => {
    const on = () => void flush();
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('online', on);
      stop();
    };
  }, [flush, stop]);

  const save = useCallback(
    async (key: string, task: () => Promise<Saved>): Promise<boolean> => {
      pending.current.delete(key);
      let ok = false;
      try {
        ok = (await task()).ok;
      } catch {
        ok = false;
      }
      if (ok) return true;
      pending.current.set(key, { task, tries: 0 });
      toastRef.current.show({ message: SAVE_FAILED_MESSAGE, tone: 'info', durationMs: 8000 });
      if (!timer.current) timer.current = setInterval(() => void flush(), RETRY_MS);
      return false;
    },
    [flush],
  );

  return { save };
}
