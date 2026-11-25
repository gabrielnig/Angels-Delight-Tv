import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** Files changed against a base (the branch point with origin/main) plus anything uncommitted, repo relative. */
export async function changedFiles(base = 'origin/main'): Promise<string[]> {
  const run = async (args: string[]) =>
    (await exec('git', args)).stdout.split('\n').filter(Boolean);
  const committed = await run(['diff', '--name-only', `${base}...HEAD`]).catch(() =>
    run(['diff', '--name-only', base]),
  );
  const dirty = (await run(['status', '--porcelain'])).map((l) =>
    l.slice(3).replace(/^.* -> /, ''),
  );
  return [...new Set([...committed, ...dirty])].sort();
}
