import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const SHARED = 'components/PasswordToggle.tsx';
/** The only components that may be given type="password": each renders the shared eye toggle itself. */
const FIELDS = new Set(['TextField', 'AcctField', 'AuthField']);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

describe('every password input has the show and hide eye button (owner feedback, D-397)', () => {
  const files = sources(ROOT).map((path) => ({
    name: relative(ROOT, path).replaceAll('\\', '/'),
    text: readFileSync(path, 'utf8'),
  }));

  it('has no raw input of type password outside the shared component', () => {
    const raw = files
      .filter((file) => file.name !== SHARED)
      .filter((file) =>
        /<input\b[^<>]*?\btype=(?:"password"|\{[^}]*password[^}]*\})/s.test(file.text),
      )
      .map((file) => file.name);
    expect(raw).toEqual([]);
  });

  it('only gives type password to the field components that render the toggle', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const match of file.text.matchAll(
        /<([A-Za-z][\w.]*)\b[^<>]*?\btype=(?:"password"|\{[^}]*'password'[^}]*\})/gs,
      )) {
        if (!FIELDS.has(match[1]!) && file.name !== SHARED) offenders.push(`${file.name}: <${match[1]}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('finds the password inputs it is meant to guard', () => {
    const using = files.filter((file) => /type=(?:"password"|\{[^}]*'password')/.test(file.text));
    expect(using.length).toBeGreaterThan(8);
  });
});
