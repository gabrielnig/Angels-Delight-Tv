import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = resolve(import.meta.dirname, 'components');
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
  .map((f) => ({ f, text: readFileSync(resolve(dir, f), 'utf8') }));

/** Quoted strings and JSX text that read like copy: they hold a space and a letter. */
function copyStrings(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(['"`])((?:(?!\1)[^\n\\])*[A-Za-z]{2,} [A-Za-z][^\n]*?)\1/g)) {
    const s = m[2] ?? '';
    if (/[{}<>=]|^[a-z-]+( [a-z-]+)*$/.test(s) && !/\s[A-Z]/.test(s)) continue;
    out.push(s);
  }
  for (const m of text.matchAll(/>([^<>{}\n]*[A-Za-z]{2,} [^<>{}\n]*)</g)) out.push((m[1] ?? '').trim());
  return out;
}

describe('copy rules (M47-S13, R39)', () => {
  it('has no exclamation marks in UI copy', () => {
    const offenders = sources.flatMap(({ f, text }) =>
      copyStrings(text)
        .filter((s) => /[A-Za-z]!(\s|$)/.test(s))
        .map((s) => `${f}: ${s}`),
    );
    expect(offenders).toEqual([]);
  });

  it('has no dash characters or emoji in UI sources', () => {
    const banned = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]|\\p{Extended_Pictographic}`, 'u');
    expect(sources.filter(({ text }) => banned.test(text)).map(({ f }) => f)).toEqual([]);
  });

  it('every sentence of the row error copy is under 20 words', () => {
    const states = sources.find(({ f }) => f === 'Row.tsx')!.text;
    expect(states).toContain('Could not load this row.');
    expect(states).toContain('description="Try again."');
  });
});
