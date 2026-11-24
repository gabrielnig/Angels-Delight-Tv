import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEYS_MIGRATIONS, MAIN_MIGRATIONS } from './migrate';

interface Entry {
  idx: number;
  tag: string;
  when: number;
}

const read = (folder: string) => ({
  entries: (
    JSON.parse(readFileSync(resolve(folder, 'meta/_journal.json'), 'utf8')) as { entries: Entry[] }
  ).entries,
  files: readdirSync(folder)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.slice(0, -4))
    .sort(),
});

describe.each([
  ['main', MAIN_MIGRATIONS],
  ['keys', KEYS_MIGRATIONS],
])('%s migration journal', (_name, folder) => {
  const { entries, files } = read(folder);

  it('lists every sql file and no file that is missing', () => {
    expect(entries.map((e) => e.tag)).toEqual(files);
  });

  it('numbers entries 0000 upward with no gap or repeat, in the same order as idx', () => {
    entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
      expect(entry.tag.slice(0, 4)).toBe(String(index).padStart(4, '0'));
    });
  });

  it('has strictly increasing when values, because drizzle skips any migration not newer than the last applied one', () => {
    const backwards = entries
      .filter((entry, index) => index > 0 && entry.when <= entries[index - 1]!.when)
      .map((entry) => entry.tag);
    expect(backwards).toEqual([]);
  });
});
