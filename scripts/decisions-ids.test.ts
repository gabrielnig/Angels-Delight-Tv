import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const text = readFileSync(resolve(root, 'docs/DECISIONS.md'), 'utf8');

/** Ids that already appear twice from parallel lanes. Never renumber them (D-168 style citations exist). */
const KNOWN_DUPLICATES: Record<string, string[]> = {
  'D-108': ['M2', 'M3'],
  'D-109': ['M2', 'M3'],
  'D-123': ['M2', 'a3'],
  'D-124': ['M2', 'a3'],
};

type Heading = { id: string; n: number; lane: string | null; title: string };

function headings(): Heading[] {
  const out: Heading[] = [];
  for (const line of text.split('\n')) {
    const m = /^## (D-(\d+)) (.+)$/.exec(line);
    if (!m) continue;
    const lane = /\(lane ([^)]+)\)\s*$/.exec(m[3] ?? '');
    out.push({ id: m[1] ?? '', n: Number(m[2]), lane: lane?.[1]?.split(',')[0]?.trim() ?? null, title: m[3] ?? '' });
  }
  return out;
}

function registerRows(): { id: string; lane: string }[] {
  const start = text.indexOf('## Duplicate id register');
  if (start < 0) return [];
  const rest = text.slice(start + 1);
  const end = rest.indexOf('\n## ');
  const block = rest.slice(0, end < 0 ? undefined : end);
  const rows: { id: string; lane: string }[] = [];
  for (const line of block.split('\n')) {
    const m = /^\| (D-\d+) \| ([^|]+) \|/.exec(line);
    if (m) rows.push({ id: m[1] ?? '', lane: (m[2] ?? '').trim() });
  }
  return rows;
}

describe('decision ids (M47-S15 AC2)', () => {
  it('ids are unique except the four registered pairs', () => {
    const seen = new Map<string, number>();
    for (const h of headings()) seen.set(h.id, (seen.get(h.id) ?? 0) + 1);
    const dupes = [...seen].filter(([, c]) => c > 1).map(([id]) => id);
    expect(dupes.sort()).toEqual(Object.keys(KNOWN_DUPLICATES).sort());
    for (const id of dupes) expect(seen.get(id)).toBe(2);
  });

  it('every registered duplicate has two headings and a lane suffix', () => {
    for (const [id, lanes] of Object.entries(KNOWN_DUPLICATES)) {
      const found = headings().filter((h) => h.id === id);
      expect(found.map((h) => h.lane).sort()).toEqual([...lanes].sort());
    }
  });

  it('the register lists exactly the known pairs and no row lacks a heading', () => {
    const rows = registerRows();
    const expected = Object.entries(KNOWN_DUPLICATES).flatMap(([id, lanes]) =>
      lanes.map((lane) => `${id} ${lane}`),
    );
    expect(rows.map((r) => `${r.id} ${r.lane}`).sort()).toEqual(expected.sort());
    for (const r of rows) {
      expect(headings().some((h) => h.id === r.id && h.lane === r.lane)).toBe(true);
    }
  });

  it('the ambiguous code citation names its lane', () => {
    const src = readFileSync(
      resolve(root, 'apps/web/src/features/player/preferences.ts'),
      'utf8',
    );
    expect(src).toContain('D-108 (M2)');
  });
});
