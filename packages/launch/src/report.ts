import type { ApplyReport } from './apply';
import type { ImportReport } from './import/runner';

/** Plain text report for the terminal. Contains field names and counts only. */
export function formatApplyReport(report: ApplyReport): string {
  const lines = [report.dryRun ? 'DRY RUN: nothing was written' : 'Applied', ''];
  for (const step of report.steps) {
    const detail = step.details.length ? ` (${step.details.join(', ')})` : '';
    lines.push(`  ${step.name.padEnd(10)} ${step.status}${detail}`);
  }
  const count = (status: string) => report.steps.filter((step) => step.status === status).length;
  lines.push(
    '',
    `${count('changed')} changed, ${count('unchanged')} unchanged, ${count('skipped')} skipped, ${count('error')} errors`,
    report.ok ? 'OK' : 'FAILED: fix the errors above and run again, nothing was half applied',
  );
  return lines.join('\n');
}

export function formatImportReport(report: ImportReport): string {
  const lines = [report.dryRun ? 'DRY RUN: nothing was imported' : 'Import finished', ''];
  for (const result of report.results) {
    const parts = [result.status.replace('_', ' ')];
    if (result.message) parts.push(result.message);
    if (result.poster === 'pending') parts.push('poster pending');
    else if (result.poster === 'attached') parts.push('poster attached');
    lines.push(`  line ${String(result.line).padEnd(4)} ${result.file}: ${parts.join(', ')}`);
  }
  const c = report.counts;
  lines.push('');
  lines.push(
    report.dryRun
      ? `${c.would_import} would import, ${c.would_resume} would resume, ${c.would_skip} would skip`
      : `${c.imported} imported, ${c.resumed} resumed, ${c.skipped} skipped, ${c.failed} failed`,
  );
  const pendingPosters = report.results.filter((result) => result.poster === 'pending').length;
  if (pendingPosters > 0)
    lines.push(
      `${pendingPosters} poster(s) are still being processed. Run the same command again to attach them.`,
    );
  if (!report.ok)
    lines.push(
      'Some files failed. Run the same command again: finished files are skipped and unfinished ones resume.',
    );
  return lines.join('\n');
}
