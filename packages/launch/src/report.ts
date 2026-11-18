import type { ApplyReport } from './apply';

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
