import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preload = resolve(import.meta.dirname, 'fixed-clock.cjs');
const run = (code: string, env: Record<string, string> = {}) =>
  spawnSync(process.execPath, ['-r', preload, '-e', code], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });

describe('server clock preload', () => {
  it('does nothing without KB_DEMO_NOW', () => {
    const out = run(
      'console.log(Math.abs(Date.now() - new Date().getTime()) < 50 && Date.now() > 1.7e12)',
    );
    expect(out.stdout.trim()).toBe('true');
  });

  it('freezes Date.now and new Date() at the demo time, in the past', () => {
    const out = run(
      'const a = Date.now(); const b = new Date().toISOString(); setTimeout(() => console.log(a, b, Date.now(), new Date(2020, 0, 1).getFullYear(), typeof Date.UTC(2020,0,1)), 30)',
      { KB_DEMO_NOW: '2026-03-10T09:00:00.000Z' },
    );
    const [a, b, c, year, utc] = out.stdout.trim().split(' ');
    expect(Number(a)).toBe(Date.parse('2026-03-10T09:00:00.000Z'));
    expect(b).toBe('2026-03-10T09:00:00.000Z');
    expect(c).toBe(a);
    expect(year).toBe('2020');
    expect(utc).toBe('number');
  });

  it('rejects a value that is not a date', () => {
    const out = run('console.log(1)', { KB_DEMO_NOW: 'tomorrow' });
    expect(out.status).not.toBe(0);
    expect(out.stderr).toMatch(/KB_DEMO_NOW/);
  });
});
