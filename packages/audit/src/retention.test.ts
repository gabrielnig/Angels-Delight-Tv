import { describe, expect, it } from 'vitest';
import { retentionCutoff } from './retention';

describe('retentionCutoff', () => {
  it('goes back the given number of months', () => {
    expect(retentionCutoff(new Date('2026-11-17T00:00:00Z'), 24).toISOString()).toBe(
      '2024-11-17T00:00:00.000Z',
    );
    expect(retentionCutoff(new Date('2026-03-15T08:00:00Z'), 1).toISOString()).toBe(
      '2026-02-15T08:00:00.000Z',
    );
  });
});
