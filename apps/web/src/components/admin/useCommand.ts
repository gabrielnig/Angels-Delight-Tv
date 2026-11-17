'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { useToast } from './Toast';

/** Runs a server action, then shows a toast and refreshes. Returns true on success. */
export function useCommand() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(work: () => Promise<CommandResult>, done: string): Promise<CommandResult> {
    setBusy(true);
    try {
      const result = await work();
      toast.show(
        result.ok ? { tone: 'success', message: done } : { tone: 'danger', message: result.error },
      );
      if (result.ok) router.refresh();
      return result;
    } catch {
      const error = 'That did not work. Nothing was changed. Try again.';
      toast.show({ tone: 'danger', message: error });
      return { ok: false, error };
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}
