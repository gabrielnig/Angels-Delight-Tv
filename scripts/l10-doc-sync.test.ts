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

describe('M49 docs are in step with the build (L10 slice 11)', () => {
  it('has the M49 stories, including the not now ones', () => {
    const us = read('docs/USER-STORIES.md');
    expect(us).toContain('## M49 Account security, activity and reach');
    for (const id of ['M49-S01', 'M49-S05', 'M49-S09', 'M49-S15', 'M49-S18', 'M49-S19'])
      expect(us).toContain(`### ${id} `);
  });

  it('lists M49 as a module with its needs from the client', () => {
    const modules = read('docs/MODULES.md');
    expect(modules).toMatch(/\| M49 \| Account security, activity and reach \|/);
    expect(modules).toContain('### M49 Account security, activity and reach [READY]');
    expect(read('docs/BUILD-PLAN.md')).toMatch(/L10 Account and reach \(M49\)/);
  });

  it('documents the Google keys for the client and the secret for security', () => {
    const client = read('docs/CLIENT-INPUTS.md');
    expect(client).toContain('GOOGLE_CLIENT_ID');
    expect(client).toContain('GOOGLE_CLIENT_SECRET');
    expect(client).toContain('/api/auth/google/callback');
    const sec = read('docs/SECURITY.md');
    expect(sec).toContain('GOOGLE_CLIENT_SECRET');
    expect(sec).toMatch(/optional TOTP/);
    expect(sec).toMatch(/login events/i);
  });

  it('adds the M49 screens and records offline downloads and passkeys as not now', () => {
    const screens = read('docs/SCREEN-ARCHITECTURE.md');
    expect(screens).toContain('### Screens 170 to 179. Account security, activity and reach (M49)');
    expect(screens).toContain('/account/activity');
    expect(screens).toContain('/sign-in/link-google');
    expect(read('docs/MODULES.md')).toMatch(/Not now: offline downloads/);
    expect(read('docs/MODULES.md')).toMatch(/Not now: passkeys/);
  });

  it('logs the lane decisions', () => {
    const d = read('docs/DECISIONS.md');
    for (const t of [
      'Account activity and security use server actions',
      'Passkeys are not now',
      'Viewing activity is the watch progress table',
      'Offline downloads are not now',
      'TV sign in by code is not built',
    ])
      expect(d).toContain(t);
  });

  it('replaces the no social login line in ARCHITECTURE', () => {
    const a = read('docs/ARCHITECTURE.md');
    expect(a).not.toContain('no social login is needed at launch');
    expect(a).toContain('Google sign in is optional');
  });
});
