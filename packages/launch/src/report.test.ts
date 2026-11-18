import { describe, expect, it } from 'vitest';
import { formatApplyReport } from './report';

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
