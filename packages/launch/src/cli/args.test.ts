import { describe, expect, it } from 'vitest';
import { parseArgs } from './args';

describe('parseArgs', () => {
  it('reads value flags, boolean flags and the equals form', () => {
    const args = parseArgs(['--config', 'client.json', '--dry-run', '--env-file=.env.production'], {
      values: ['config', 'env-file'],
      booleans: ['dry-run', 'json'],
    });
    expect(args).toEqual({
      ok: true,
      values: { config: 'client.json', 'env-file': '.env.production' },
      flags: { 'dry-run': true, json: false },
    });
  });

  it('rejects an unknown flag and a missing value', () => {
    const spec = { values: ['config'], booleans: [] };
    expect(parseArgs(['--nope'], spec).ok).toBe(false);
    expect(parseArgs(['--config'], spec).ok).toBe(false);
  });

  it('ignores a lone double dash from pnpm', () => {
    const spec = { values: ['config'], booleans: [] };
    expect(parseArgs(['--', '--config', 'a'], spec)).toMatchObject({
      ok: true,
      values: { config: 'a' },
    });
  });
});
