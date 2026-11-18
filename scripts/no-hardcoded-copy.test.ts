import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const eslint = new ESLint({ cwd: root });
const WIRED = 'apps/web/src/components/account/AlwaysAskSetting.tsx';

async function copyHits(code: string, filePath: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath: resolve(root, filePath) });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'ad/no-hardcoded-copy').length;
}

describe('ad/no-hardcoded-copy (M34-S04 AC2)', () => {
  it('flags JSX text, read attributes and sentence strings in a wired file', async () => {
    expect(await copyHits('export const A = () => <p>We could not save that.</p>;\n', WIRED)).toBe(
      1,
    );
    expect(await copyHits('export const A = () => <button aria-label="Close" />;\n', WIRED)).toBe(
      1,
    );
    expect(await copyHits("export const text = 'Something went wrong. Try again.';\n", WIRED)).toBe(
      1,
    );
    expect(
      await copyHits('export const t = (n: number) => `You have ${n} profiles left`;\n', WIRED),
    ).toBe(1);
  });

  it('accepts catalog reads, ids, class names, imports and type literals', async () => {
    const code = [
      "import { msg } from '@ad/shared/messages';",
      "type Kind = 'connection-lost' | 'offline';",
      "export const a = msg('account.saveFailed');",
      'export const b = <p className="acct-muted acct-small" role="alert">{a}</p>;',
      "export const c = 'ad.pickercache.v1';",
      "export const d = 'GET';",
    ].join('\n');
    expect(await copyHits(code, WIRED)).toBe(0);
  });

  it('stays quiet in files that are not wired yet', async () => {
    expect(
      await copyHits(
        'export const A = () => <p>We could not save that.</p>;\n',
        'apps/web/src/components/Other.tsx',
      ),
    ).toBe(0);
  });

  it('keeps every wired file clean', async () => {
    const results = await eslint.lintFiles([
      'apps/web/src/components/account/pages.ts',
      'apps/web/src/components/account/AlwaysAskSetting.tsx',
      'apps/web/src/components/profiles/CachedPicker.tsx',
      'apps/web/src/lib/auth-notices.ts',
      'apps/web/src/server/auth/form-errors.ts',
      'packages/player/src/controller.ts',
      'packages/player/src/ui/Overlays.tsx',
      'packages/player/src/ui/PlayerView.tsx',
    ]);
    const hits = results.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId === 'ad/no-hardcoded-copy')
        .map((m) => `${r.filePath}:${m.line}`),
    );
    expect(hits).toEqual([]);
  });
});
