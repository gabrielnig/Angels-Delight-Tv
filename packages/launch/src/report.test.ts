import { describe, expect, it } from 'vitest';
import { formatApplyReport, formatImportReport } from './report';

describe('formatApplyReport', () => {
  it('prints one line per step with a status marker and a summary', () => {
    const text = formatApplyReport({
      ok: true,
      dryRun: true,
      steps: [
        { name: 'settings', status: 'changed', details: ['platform.name', 'platform.tagline'] },
        { name: 'theme', status: 'unchanged', details: [] },
        { name: 'env', status: 'skipped', details: ['no env file given'] },
      ],
    });
    expect(text).toContain('DRY RUN');
    expect(text).toContain('settings');
    expect(text).toContain('changed (platform.name, platform.tagline)');
    expect(text).toContain('1 changed, 1 unchanged, 1 skipped, 0 errors');
  });

  it('marks failure', () => {
    const text = formatApplyReport({
      ok: false,
      dryRun: false,
      steps: [{ name: 'theme', status: 'error', details: ['Text would be too hard to read'] }],
    });
    expect(text).toContain('FAILED');
    expect(text).toContain('Text would be too hard to read');
  });
});

describe('formatImportReport', () => {
  it('prints a line per file and totals, flags pending posters and failures', () => {
    const text = formatImportReport({
      ok: false,
      dryRun: false,
      counts: {
        imported: 1,
        resumed: 0,
        skipped: 1,
        failed: 1,
        would_import: 0,
        would_resume: 0,
        would_skip: 0,
      },
      results: [
        { line: 2, file: 'a.mp4', status: 'imported', videoId: 'v1', poster: 'pending' },
        { line: 3, file: 'b.mp4', status: 'skipped', videoId: 'v2', message: 'already imported' },
        { line: 4, file: 'c.mp4', status: 'failed', message: 'storage unavailable' },
      ],
    });
    expect(text).toContain('a.mp4');
    expect(text).toContain('imported');
    expect(text).toContain('poster pending');
    expect(text).toContain('storage unavailable');
    expect(text).toContain('1 imported, 0 resumed, 1 skipped, 1 failed');
    expect(text).toContain('Run the same command again');
  });

  it('labels a dry run', () => {
    const text = formatImportReport({
      ok: true,
      dryRun: true,
      counts: {
        imported: 0,
        resumed: 0,
        skipped: 0,
        failed: 0,
        would_import: 2,
        would_resume: 0,
        would_skip: 1,
      },
      results: [],
    });
    expect(text).toContain('DRY RUN');
    expect(text).toContain('2 would import');
  });
});
