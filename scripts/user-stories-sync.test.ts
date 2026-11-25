import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const stories = readFileSync(join(root, 'docs/USER-STORIES.md'), 'utf8');
const modules = readFileSync(join(root, 'docs/MODULES.md'), 'utf8');

describe('M41 stories stay in step with the docs', () => {
  const numbers = [...stories.matchAll(/^### M41-S(\d+) /gm)].map((m) => Number(m[1]));

  it('numbers the stories one to twenty one with no gap', () => {
    expect(numbers).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
  });

  it('shows the same count in the coverage table', () => {
    expect(stories).toMatch(new RegExp(`^\\| M41 \\| ${numbers.length} \\|$`, 'm'));
  });

  it('lists M41 in the module table and gives it a section', () => {
    expect(modules).toMatch(/^\| M41 \| Home hero, rows and sections \|/m);
    expect(modules).toMatch(/^### M41 Home hero, rows and sections/m);
  });

  it('gives every story a priority and the three kinds of case', () => {
    const body = stories.slice(stories.indexOf('## M41 Home hero, rows and sections'));
    const blocks = body.split(/^### M41-S/m).slice(1);
    expect(blocks).toHaveLength(21);
    for (const block of blocks) {
      expect(block).toMatch(/^\d+ .*\((Must|Should|Could)\)/);
      expect(block).toMatch(/- Edge:/);
      expect(block).toMatch(/- Error:/);
      expect(block).toMatch(/- Empty:/);
    }
  });

  it('counts Must, Should and Could the way the total line says', () => {
    const body = stories.slice(stories.indexOf('## M41 Home hero, rows and sections'));
    const count = (p: string) => [...body.matchAll(new RegExp(`^### M41-S\\d+ .*\\(${p}\\)`, 'gm'))].length;
    expect([count('Must'), count('Should'), count('Could')]).toEqual([11, 8, 2]);
  });
});
