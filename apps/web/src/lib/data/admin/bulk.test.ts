import { describe, expect, it } from 'vitest';
import {
  MAX_BULK_CALL,
  MAX_SELECTION,
  capSelection,
  chunkIds,
  describeOutcome,
  eligibility,
  emptyOutcome,
  mergeOutcomes,
  newBulkId,
  retryableFailures,
} from './bulk';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

describe('bulk helpers', () => {
  it('limits are the documented ones', () => {
    expect(MAX_BULK_CALL).toBe(200);
    expect(MAX_SELECTION).toBe(500);
  });

  it('chunkIds splits 60 ids into chunks of 25, 25 and 10', () => {
    expect(chunkIds(ids(60)).map((c) => c.length)).toEqual([25, 25, 10]);
    expect(chunkIds([])).toEqual([]);
  });

  it('chunkIds never returns a chunk larger than the size asked for', () => {
    expect(chunkIds(ids(7), 3).map((c) => c.length)).toEqual([3, 3, 1]);
  });

  it('mergeOutcomes sums succeeded, failed and skipped', () => {
    const a = { ...emptyOutcome('b1'), succeeded: ['a', 'b'], failed: [{ id: 'c', reason: 'x' }] };
    const b = { ...emptyOutcome('b1'), succeeded: ['d'], skipped: [{ id: 'e', reason: 'y' }] };
    const merged = mergeOutcomes(a, b);
    expect(merged.succeeded).toEqual(['a', 'b', 'd']);
    expect(merged.failed).toEqual([{ id: 'c', reason: 'x' }]);
    expect(merged.skipped).toEqual([{ id: 'e', reason: 'y' }]);
    expect(merged.bulkId).toBe('b1');
  });

  it('mergeOutcomes drops a failure that a later retry fixed', () => {
    const a = { ...emptyOutcome('b1'), failed: [{ id: 'c', reason: 'x' }] };
    const b = { ...emptyOutcome('b1'), succeeded: ['c'] };
    expect(mergeOutcomes(a, b).failed).toEqual([]);
  });

  it('describeOutcome says 9 done, 2 could not be changed, 1 skipped', () => {
    const o = {
      ...emptyOutcome('b'),
      succeeded: ids(9),
      failed: [
        { id: 'f1', reason: 'r' },
        { id: 'f2', reason: 'r' },
      ],
      skipped: [{ id: 's', reason: 'r' }],
    };
    expect(describeOutcome('Publish', o)).toBe('Publish: 9 done, 2 could not be changed, 1 skipped.');
  });

  it('describeOutcome says only what happened when everything worked', () => {
    expect(describeOutcome('Publish', { ...emptyOutcome('b'), succeeded: ids(12) })).toBe('Publish: 12 done.');
    expect(describeOutcome('Publish', { ...emptyOutcome('b'), succeeded: ['a'] })).toBe('Publish: 1 done.');
  });

  it('eligibility keeps the rows a rule accepts and explains each skipped one', () => {
    const rows = [
      { id: 'a', state: 'needs_review' },
      { id: 'b', state: 'failed' },
      { id: 'c', state: 'approved' },
    ];
    const split = eligibility(rows, (r) =>
      r.state === 'needs_review' ? null : r.state === 'failed' ? 'Captions failed.' : 'Already approved.',
    );
    expect(split.eligible.map((r) => r.id)).toEqual(['a']);
    expect(split.skipped).toEqual([
      { id: 'b', reason: 'Captions failed.' },
      { id: 'c', reason: 'Already approved.' },
    ]);
  });

  it('newBulkId is unique per run', () => {
    const seen = new Set(Array.from({ length: 50 }, () => newBulkId()));
    expect(seen.size).toBe(50);
  });

  it('selection beyond MAX_SELECTION is cut and flagged', () => {
    const cut = capSelection(ids(620));
    expect(cut.ids).toHaveLength(500);
    expect(cut.capped).toBe(true);
    expect(cut.total).toBe(620);
    expect(capSelection(ids(10)).capped).toBe(false);
  });

  it('retryableFailures keeps only failures marked retryable', () => {
    const o = {
      ...emptyOutcome('b'),
      failed: [
        { id: 'a', reason: 'Timed out.', retryable: true },
        { id: 'b', reason: 'Not ready.' },
      ],
      skipped: [{ id: 'c', reason: 'Skipped.', retryable: true }],
    };
    expect(retryableFailures(o).map((f) => f.id)).toEqual(['a']);
  });
});
