import type { ManifestRow } from './manifest';

export type PosterOutcome = 'none' | 'attached' | 'unchanged' | 'pending';

export interface ImportPorts {
  /** SHA-256 of the file as lowercase hex. `file` is the manifest path. */
  hash(file: string): Promise<string>;
  /** A video that already holds this content, and whether its upload finished. */
  findImported(sha: string): Promise<{ videoId: string; complete: boolean } | null>;
  /** Registers the file through the upload service path and uploads what is missing. */
  importFile(
    row: ManifestRow,
    sha: string,
    onProgress: (done: number, total: number) => void,
  ): Promise<{ videoId: string; resumed: boolean }>;
  /** Poster step, repeated on every run until the picture is attached. */
  attachPoster(row: ManifestRow, videoId: string): Promise<PosterOutcome>;
}

export type ImportStatus =
  'imported' | 'resumed' | 'skipped' | 'failed' | 'would_import' | 'would_resume' | 'would_skip';

export interface ImportResult {
  line: number;
  file: string;
  status: ImportStatus;
  videoId?: string;
  poster?: PosterOutcome;
  message?: string;
}

export type ImportEvent =
  | { type: 'start'; file: string; index: number; total: number }
  | { type: 'progress'; file: string; done: number; total: number }
  | { type: 'done'; file: string; result: ImportResult };

export interface ImportReport {
  ok: boolean;
  dryRun: boolean;
  results: ImportResult[];
  counts: Record<ImportStatus, number>;
}

const STATUSES: ImportStatus[] = [
  'imported',
  'resumed',
  'skipped',
  'failed',
  'would_import',
  'would_resume',
  'would_skip',
];

/**
 * Imports the rows one at a time. A failure is recorded and the run continues, so one bad file does not stop the rest.
 * Idempotent: a file whose content already belongs to a finished video is skipped, and an unfinished upload resumes.
 */
export async function runImport(
  rows: ManifestRow[],
  ports: ImportPorts,
  options: { dryRun: boolean; onEvent?: (event: ImportEvent) => void },
): Promise<ImportReport> {
  const results: ImportResult[] = [];
  const seenInThisRun = new Map<string, number>();
  const emit = options.onEvent ?? (() => undefined);

  for (const [index, row] of rows.entries()) {
    emit({ type: 'start', file: row.file, index: index + 1, total: rows.length });
    let result: ImportResult;
    try {
      const sha = await ports.hash(row.file);
      const known = await ports.findImported(sha);
      const duplicateLine = seenInThisRun.get(sha);
      if (!seenInThisRun.has(sha)) seenInThisRun.set(sha, row.line);

      if (known?.complete || (options.dryRun && duplicateLine !== undefined)) {
        result = {
          line: row.line,
          file: row.file,
          status: options.dryRun ? 'would_skip' : 'skipped',
          videoId: known?.videoId,
          message:
            known?.complete || duplicateLine === undefined
              ? 'already imported'
              : `same content as line ${duplicateLine}`,
        };
        if (!options.dryRun && known?.videoId) {
          result.poster = await ports.attachPoster(row, known.videoId);
        }
      } else if (options.dryRun) {
        result = {
          line: row.line,
          file: row.file,
          status: known ? 'would_resume' : 'would_import',
          videoId: known?.videoId,
        };
      } else {
        const imported = await ports.importFile(row, sha, (done, total) =>
          emit({ type: 'progress', file: row.file, done, total }),
        );
        result = {
          line: row.line,
          file: row.file,
          status: imported.resumed ? 'resumed' : 'imported',
          videoId: imported.videoId,
          poster: await ports.attachPoster(row, imported.videoId),
        };
      }
    } catch (error) {
      result = {
        line: row.line,
        file: row.file,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    results.push(result);
    emit({ type: 'done', file: row.file, result });
  }

  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
    ImportStatus,
    number
  >;
  for (const result of results) counts[result.status]++;
  return { ok: counts.failed === 0, dryRun: options.dryRun, results, counts };
}

/**
 * Posters are processed by the worker, so right after an import they are usually still pending. Waits (up to
 * `timeoutMs`) and attaches them as they become ready. Whatever is still pending is attached by the next run.
 */
export async function settlePosters(
  report: ImportReport,
  rows: ManifestRow[],
  ports: Pick<ImportPorts, 'attachPoster'>,
  options: {
    timeoutMs: number;
    intervalMs: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  },
): Promise<void> {
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const started = now();
  const byFile = new Map(rows.map((row) => [row.file, row]));
  for (;;) {
    const pending = report.results.filter(
      (result) => result.poster === 'pending' && result.videoId,
    );
    if (pending.length === 0 || now() - started >= options.timeoutMs) return;
    await sleep(options.intervalMs);
    for (const result of pending) {
      const row = byFile.get(result.file);
      if (!row) continue;
      try {
        result.poster = await ports.attachPoster(row, result.videoId!);
      } catch (error) {
        result.poster = 'pending';
        result.message = error instanceof Error ? error.message : 'poster failed';
      }
    }
  }
}
