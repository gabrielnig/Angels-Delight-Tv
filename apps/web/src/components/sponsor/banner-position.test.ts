import { describe, expect, it } from 'vitest';
import { bannerIndex } from './banner-position';

describe('bannerIndex', () => {
  it('puts the banner after the chosen row', () => {
    expect(bannerIndex(6, 3)).toBe(3);
  });
  it('never puts it above the second row', () => {
    expect(bannerIndex(6, 1)).toBe(2);
  });
  it('shows no banner when there are not enough rows to come after', () => {
    expect(bannerIndex(2, 3)).toBe(-1);
    expect(bannerIndex(1, 1)).toBe(-1);
    expect(bannerIndex(0, 3)).toBe(-1);
  });
  it('shows it after the last row when the position equals the row count', () => {
    expect(bannerIndex(3, 3)).toBe(3);
  });
  it('survives odd input', () => {
    expect(bannerIndex(5, Number.NaN)).toBe(3);
    expect(bannerIndex(5, -4)).toBe(2);
  });
});
