import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('design doc documents --font-mono (L10 plan 12.1, R38)', () => {
  const ds = read('docs/DESIGN-SYSTEM.md');

  it('has a type family tokens table with the fixed mono row', () => {
    expect(ds).toContain('### 3.3 Type family tokens');
    expect(ds).toMatch(
      /\| `--font-mono` \| `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` \| Fixed \|/,
    );
    expect(ds).toMatch(/\| `--font-sans` \|.*Themeable/);
    expect(ds).toMatch(/\| `--font-display` \|.*Themeable/);
  });

  it('names the editor row and the code element rules', () => {
    expect(ds).toMatch(/\| Mono family \| Not editable \| `--font-mono` \|/);
    expect(ds).toMatch(
      /weight 600, `letter-spacing: \.08em`, 17px or larger, and `user-select: all`/,
    );
  });

  it('lists --font-mono under Fixed in the theme editor group list', () => {
    expect(ds).toMatch(/Fixed, not editable: .*`--font-mono`/);
  });

  it('the stylesheet follows the doc for recovery codes', () => {
    const css = read('apps/web/src/components/account/account.css');
    const block = /\.acct-code \{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(block).toContain('font-family: var(--font-mono)');
    expect(block).toContain('font-weight: 600');
    expect(block).toContain('letter-spacing: 0.08em');
    expect(block).toContain('user-select: all');
  });
});

describe('design system documents the Google button exception (plan 12.2, R38)', () => {
  const ds = read('docs/DESIGN-SYSTEM.md');

  it('lists the four mark colours and the three button values', () => {
    for (const hex of [
      '#EA4335',
      '#4285F4',
      '#FBBC05',
      '#34A853',
      '#FFFFFF',
      '#747775',
      '#1F1F1F',
    ]) {
      expect(ds).toContain(hex);
    }
    expect(ds).toContain('Continue with Google');
    expect(ds).toContain('Sign up with Google');
  });

  it('the skill greps ignore only the Google files', () => {
    const skill = read('.claude/skills/angels-delight-design-system/SKILL.md');
    expect(skill).toContain("grep -v -e 'components/auth/GoogleMark.tsx'");
    expect(skill).toContain('Any other Google brand colour in a component is a Blocker.');
  });

  it('the mark file holds exactly the four brand colours', () => {
    const mark = read('apps/web/src/components/auth/GoogleMark.tsx');
    expect((mark.match(/#[0-9A-Fa-f]{6}/g) ?? []).sort()).toEqual(
      ['#34A853', '#4285F4', '#EA4335', '#FBBC05'].sort(),
    );
  });
});
