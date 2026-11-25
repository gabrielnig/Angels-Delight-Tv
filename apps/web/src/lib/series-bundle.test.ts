import { describe, expect, it } from 'vitest';
import { resolveSeriesLabels } from '@ad/shared/series-labels';
import { describeIssue, findNumberIssues, planBundle } from './series-bundle';

const v = (id: string, title: string, uploadedAt: string) => ({ id, title, uploadedAt });
const picked = [
  v('c', 'Chapter 10', '2026-03-01'),
  v('a', 'Chapter 2', '2026-01-01'),
  v('b', 'Chapter 1', '2026-02-01'),
];

describe('planBundle (M51-S04)', () => {
  it('numbers in the order picked from the start number', () => {
    const plan = planBundle({
      videos: picked,
      order: 'picked',
      group: 1,
      startAt: 1,
      existing: [],
    });
    expect(plan.rows.map((r) => [r.id, r.group, r.number])).toEqual([
      ['c', 1, 1],
      ['a', 1, 2],
      ['b', 1, 3],
    ]);
    expect(plan.problem).toBeNull();
  });

  it('orders by title with numbers inside the title read as numbers', () => {
    const plan = planBundle({ videos: picked, order: 'title', group: 2, startAt: 5, existing: [] });
    expect(plan.rows.map((r) => [r.id, r.number])).toEqual([
      ['b', 5],
      ['a', 6],
      ['c', 7],
    ]);
  });

  it('orders by upload date, oldest first', () => {
    const plan = planBundle({ videos: picked, order: 'date', group: 1, startAt: 1, existing: [] });
    expect(plan.rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('warns about a number already taken in the group and names it', () => {
    const plan = planBundle({
      videos: picked,
      order: 'picked',
      group: 1,
      startAt: 2,
      existing: [{ group: 1, number: 3 }],
    });
    expect(plan.problem).toEqual({ kind: 'taken', group: 1, number: 3 });
    expect(
      describeIssue(plan.problem!, resolveSeriesLabels({ preset: 'book_chapter' }, null)),
    ).toBe('Chapter 3 is already used in Book 1. Choose another start number.');
    expect(plan.blocked).toBe(true);
  });

  it('is not blocked when the numbers are free in another group', () => {
    const plan = planBundle({
      videos: picked,
      order: 'picked',
      group: 2,
      startAt: 1,
      existing: [{ group: 1, number: 1 }],
    });
    expect(plan.blocked).toBe(false);
  });

  it('refuses a start number below 1', () => {
    const plan = planBundle({
      videos: picked,
      order: 'picked',
      group: 1,
      startAt: 0,
      existing: [],
    });
    expect(plan.blocked).toBe(true);
    expect(describeIssue(plan.problem!, resolveSeriesLabels(undefined, null))).toMatch(
      /whole number from 1/,
    );
  });
});

describe('findNumberIssues', () => {
  it('reports a gap and a duplicate once each, per group', () => {
    const issues = findNumberIssues([
      { group: 1, number: 1 },
      { group: 1, number: 3 },
      { group: 2, number: 1 },
      { group: 2, number: 1 },
    ]);
    expect(issues).toEqual([
      { group: 1, kind: 'gap', number: 1, next: 3 },
      { group: 2, kind: 'duplicate', number: 1 },
    ]);
    const w = resolveSeriesLabels({ preset: 'part_lesson' }, null);
    expect(issues.map((i) => describeIssue(i, w))).toEqual([
      'Part 1 skips from Lesson 1 to Lesson 3.',
      'Part 2 uses Lesson 1 more than once.',
    ]);
  });

  it('is empty for a clean series', () => {
    expect(
      findNumberIssues([
        { group: 1, number: 1 },
        { group: 1, number: 2 },
      ]),
    ).toEqual([]);
  });
});
