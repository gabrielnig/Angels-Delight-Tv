import { describe, expect, it } from 'vitest';
import { MATURITY_DEFAULT_LABELS } from './enums';
import { clampMaturityRank, maturityLabel, parseMaturityLabels } from './maturity';

describe('maturityLabel', () => {
  it('falls back to the default labels and clamps unknown ranks', () => {
    expect(MATURITY_DEFAULT_LABELS).toEqual(['G', 'PG', '12', '15', '18']);
    expect(maturityLabel(0)).toBe('G');
    expect(maturityLabel(3)).toBe('15');
    expect(maturityLabel(9)).toBe('18');
    expect(maturityLabel(-2)).toBe('G');
    expect(maturityLabel(1.7)).toBe('PG');
    expect(maturityLabel(Number.NaN)).toBe('18');
  });

  it('uses configured labels and falls back per slot when a label is unusable', () => {
    const labels = ['All ages', '7+', '13+', '16+', '18+'];
    expect(maturityLabel(1, labels)).toBe('7+');
    expect(maturityLabel(2, ['G', 'PG', '', '15', '18'])).toBe('12');
    expect(maturityLabel(2, ['G'])).toBe('12');
  });
});

describe('parseMaturityLabels', () => {
  it('accepts five short labels and trims them', () => {
    expect(parseMaturityLabels(' G , PG,12,15,18 ')).toEqual(['G', 'PG', '12', '15', '18']);
    expect(parseMaturityLabels('All,7+,13+,16+,18+')).toEqual(['All', '7+', '13+', '16+', '18+']);
  });

  it('rejects wrong counts, empty slots, long labels, duplicates and dashes', () => {
    expect(parseMaturityLabels('G,PG,12,15')).toBeNull();
    expect(parseMaturityLabels('G,,12,15,18')).toBeNull();
    expect(parseMaturityLabels('G,PG,12,15,ADULT')).toBeNull();
    expect(parseMaturityLabels('G,PG,PG,15,18')).toBeNull();
    expect(parseMaturityLabels('G,PG,12,15,–18')).toBeNull();
  });
});

describe('clampMaturityRank', () => {
  it('returns an integer from 0 to 4 and treats junk as the most restrictive value for a limit', () => {
    expect(clampMaturityRank(2)).toBe(2);
    expect(clampMaturityRank(7)).toBe(4);
    expect(clampMaturityRank(-1)).toBe(0);
    expect(clampMaturityRank('x', 2)).toBe(2);
  });
});
