import type { BulkIssue } from './bulk';
import type { CleanupResult } from './types';

/** Cleans up failed encodes one by one so a bad row never blocks the rest, and totals what was freed. */
export async function runCleanupMany(
  cleanup: (id: string) => Promise<CleanupResult>,
  ids: readonly string[],
): Promise<{ succeeded: string[]; failed: BulkIssue[]; removedFiles: number; freedBytes: number }> {
  const out = { succeeded: [] as string[], failed: [] as BulkIssue[], removedFiles: 0, freedBytes: 0 };
  for (const id of new Set(ids)) {
    try {
      const result = await cleanup(id);
      if (result.ok) {
        out.succeeded.push(id);
        out.removedFiles += result.removedFiles;
        out.freedBytes += result.freedBytes;
      } else out.failed.push({ id, reason: result.error, retryable: false });
    } catch {
      out.failed.push({ id, reason: 'Could not clean up. Try again.', retryable: true });
    }
  }
  return out;
}
