import { groupName, itemName, type SeriesWords } from '@ad/shared/series-labels';

/**
 * Pure planning for bundling videos into a series (M51-S04, S05): the numbers each picked video gets, and the
 * gaps and duplicates the editor warns about. No words about seasons or episodes live here; the screens add them.
 */

export type BundleOrder = 'picked' | 'title' | 'date';

export interface BundleVideo {
  id: string;
  title: string;
  uploadedAt: string;
}

export interface BundleRow {
  id: string;
  title: string;
  group: number;
  number: number;
}

export interface BundlePlan {
  rows: BundleRow[];
  /** At most one problem, so the screen shows one thing to fix at a time (R39). */
  problem: BundleProblem | null;
  /** True when saving would clash or the start number is not usable. */
  blocked: boolean;
}

const byTitle = (a: BundleVideo, b: BundleVideo) =>
  a.title.localeCompare(b.title, 'en', { numeric: true, sensitivity: 'base' });

export type BundleProblem = { kind: 'start' } | { kind: 'taken'; group: number; number: number };

export function planBundle(input: {
  videos: BundleVideo[];
  order: BundleOrder;
  group: number;
  startAt: number;
  existing: Array<{ group: number; number: number }>;
}): BundlePlan {
  const { group, startAt } = input;
  if (!Number.isInteger(startAt) || startAt < 1 || !Number.isInteger(group) || group < 1) {
    return { rows: [], problem: { kind: 'start' }, blocked: true };
  }
  const ordered = [...input.videos];
  if (input.order === 'title') ordered.sort(byTitle);
  if (input.order === 'date') ordered.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  const rows = ordered.map((video, i) => ({
    id: video.id,
    title: video.title,
    group,
    number: startAt + i,
  }));
  const taken = new Set(input.existing.filter((e) => e.group === group).map((e) => e.number));
  const clash = rows.find((r) => taken.has(r.number));
  return {
    rows,
    problem: clash ? { kind: 'taken', group, number: clash.number } : null,
    blocked: clash !== undefined,
  };
}

export interface NumberIssue {
  group: number;
  kind: 'gap' | 'duplicate';
  /** The number used twice, or where the gap starts. */
  number: number;
  /** Where the gap ends. */
  next?: number;
}

/** Words for a problem or issue in the owner's names, such as "Book 1 skips from Chapter 1 to Chapter 3." */
export function describeIssue(issue: NumberIssue | BundleProblem, words: SeriesWords): string {
  if ('kind' in issue && issue.kind === 'start') return 'Use a whole number from 1.';
  if (issue.kind === 'taken')
    return `${itemName(words, issue.number)} is already used in ${groupName(words, issue.group)}. Choose another start number.`;
  if (issue.kind === 'duplicate')
    return `${groupName(words, issue.group)} uses ${itemName(words, issue.number)} more than once.`;
  return `${groupName(words, issue.group)} skips from ${itemName(words, issue.number)} to ${itemName(words, issue.next ?? 0)}.`;
}

/** One warning per problem, groups in order. A gap is a jump of more than one inside a group. */
export function findNumberIssues(items: Array<{ group: number; number: number }>): NumberIssue[] {
  const groups = [...new Set(items.map((i) => i.group))].sort((a, b) => a - b);
  const issues: NumberIssue[] = [];
  for (const group of groups) {
    const numbers = items
      .filter((i) => i.group === group)
      .map((i) => i.number)
      .sort((a, b) => a - b);
    const dupes = new Set<number>();
    for (let i = 1; i < numbers.length; i++)
      if (numbers[i] === numbers[i - 1]) dupes.add(numbers[i]!);
    for (const n of dupes) issues.push({ group, kind: 'duplicate', number: n });
    const distinct = [...new Set(numbers)];
    for (let i = 1; i < distinct.length; i++)
      if (distinct[i]! - distinct[i - 1]! > 1)
        issues.push({ group, kind: 'gap', number: distinct[i - 1]!, next: distinct[i]! });
  }
  return issues;
}
