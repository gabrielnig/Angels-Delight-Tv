import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const eslint = new ESLint({ cwd: root });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(root, filePath) });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

describe('eslint config', () => {
  it('bans console.log in app code', async () => {
    expect(await ruleIds("console.log('hi');\n", 'apps/worker/src/example.ts')).toContain(
      'no-console',
    );
  });

  it('bans console.error and console.warn in app code too', async () => {
    expect(
      await ruleIds("console.error('x');\nconsole.warn('y');\n", 'apps/web/src/lib/example.ts'),
    ).toEqual(['no-console', 'no-console']);
  });

  it('allows the logger in app code', async () => {
    const code = "import { createLogger } from '@ad/shared';\ncreateLogger().info('hi');\n";
    expect(await ruleIds(code, 'apps/worker/src/example.ts')).toEqual([]);
  });

  it('keeps routes away from @ad/db so they go through repositories', async () => {
    const code = "import { accounts } from '@ad/db';\nexport const table = accounts;\n";
    expect(await ruleIds(code, 'apps/web/src/app/example/route.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('lets server code import @ad/db', async () => {
    const code = "import { accounts } from '@ad/db';\nexport const table = accounts;\n";
    expect(await ruleIds(code, 'apps/web/src/server/example.ts')).toEqual([]);
  });

  it('stops packages from importing apps', async () => {
    const code = "import { bootWorker } from '@ad/worker';\nexport const boot = bootWorker;\n";
    expect(await ruleIds(code, 'packages/shared/src/example.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('stops apps from importing each other', async () => {
    const code = "import { bootWorker } from '@ad/worker';\nexport const boot = bootWorker;\n";
    expect(await ruleIds(code, 'apps/web/src/server/example.ts')).toContain(
      'no-restricted-imports',
    );
    const reverse = "import type { WebEnv } from '@ad/web';\nexport type T = WebEnv;\n";
    expect(await ruleIds(reverse, 'apps/worker/src/example.ts')).toContain('no-restricted-imports');
  });
});
