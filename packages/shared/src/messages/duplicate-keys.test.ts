import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** A key defined in two catalog files is silently overridden by the later spread, so the first copy never shows. */
describe('message catalog source files', () => {
  it('define each key once across all files', () => {
    const where = new Map<string, string[]>();
    for (const file of readdirSync(__dirname).filter((f) => /messages\.ts$/.test(f))) {
      const text = readFileSync(join(__dirname, file), 'utf8');
      for (const m of text.matchAll(/^ {2}'([a-zA-Z0-9_.-]+)':/gm)) {
        where.set(m[1]!, [...(where.get(m[1]!) ?? []), file]);
      }
    }
    const dupes = [...where].filter(([, files]) => files.length > 1).map(([key, files]) => `${key}: ${files.join(', ')}`);
    expect(dupes).toEqual([]);
  });
});
