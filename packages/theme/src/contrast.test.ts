import { describe, expect, it } from 'vitest';
import {
  bestTextColor,
  contrastRatio,
  formatRatio,
  normalizeHex,
  parseHex,
  relativeLuminance,
} from './contrast';

describe('parseHex and normalizeHex', () => {
  it.each([
    ['#1F6FB5', [31, 111, 181]],
    ['1f6fb5', [31, 111, 181]],
    ['#FFF', [255, 255, 255]],
    ['abc', [170, 187, 204]],
    ['  #000000 ', [0, 0, 0]],
  ])('parses %s', (input, rgb) => {
    expect(parseHex(input)).toEqual(rgb);
  });

  it.each(['', '#12', '#1F6FZ5', '#1234567', 'red', '#12345', null, undefined, 12])(
    'rejects %s',
    (input) => {
      expect(parseHex(input as string)).toBeNull();
      expect(normalizeHex(input as string)).toBeNull();
    },
  );

  it.each([
    ['1f6fb5', '#1F6FB5'],
    ['#abc', '#AABBCC'],
    ['#ffc93c', '#FFC93C'],
  ])('normalizes %s to %s', (input, out) => {
    expect(normalizeHex(input)).toBe(out);
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
  });
});

describe('contrastRatio against the documented defaults (docs/DESIGN-SYSTEM.md 4.1)', () => {
  it.each([
    ['#1A1C22', '#F5F5F2', 15.59],
    ['#1A1C22', '#FFFFFF', 17.03],
    ['#5B606B', '#F5F5F2', 5.77],
    ['#5B606B', '#FFFFFF', 6.31],
    ['#FFFFFF', '#1F6FB5', 5.25],
    ['#1F6FB5', '#F5F5F2', 4.81],
    ['#FFFFFF', '#1B5F9C', 6.64],
    ['#1A1C22', '#FFC93C', 11.09],
    ['#1A1C22', '#F2B84B', 9.52],
    ['#FFC93C', '#F5F5F2', 1.41],
    ['#8A8D94', '#F5F5F2', 3.04],
    ['#FFFFFF', '#17181C', 17.74],
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#FFFFFF', 1],
  ])('%s on %s is %s', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1F6FB5', '#FFFFFF')).toBe(contrastRatio('#FFFFFF', '#1F6FB5'));
  });

  it('returns null for an invalid colour', () => {
    expect(contrastRatio('#1F6FZ5', '#FFFFFF')).toBeNull();
  });

  it('matches the mockup values for the low contrast states', () => {
    expect(contrastRatio('#FFFFFF', '#7FB8E6')).toBeCloseTo(2.12, 1);
    expect(contrastRatio('#FFFFFF', '#C9E3F7')).toBeCloseTo(1.33, 1);
  });
});

describe('formatRatio', () => {
  it.each([
    [15.5934, '15.59:1'],
    [4.5, '4.50:1'],
    [1, '1.00:1'],
    [null, 'Not checked'],
  ])('formats %s', (value, text) => {
    expect(formatRatio(value)).toBe(text);
  });

  it('truncates rather than rounds up across a threshold', () => {
    expect(formatRatio(4.4999)).toBe('4.49:1');
  });
});

describe('bestTextColor', () => {
  const WHITE = '#FFFFFF';
  const INK = '#1A1C22';
  it.each([
    ['#1F6FB5', WHITE],
    ['#FFC93C', INK],
    ['#000000', WHITE],
    ['#FFFFFF', INK],
    ['#7FB8E6', INK],
  ])('on %s picks %s', (bg, expected) => {
    expect(bestTextColor(bg, [WHITE, INK]).color).toBe(expected);
  });

  it('reports the winning ratio and whether it passes 4.5', () => {
    const result = bestTextColor('#7F7F7F', [WHITE, INK]);
    expect(result.ratio).toBeGreaterThan(3);
    expect(result.passes).toBe(result.ratio >= 4.5);
  });

  it('prefers the first candidate on a tie', () => {
    expect(bestTextColor('#FFFFFF', ['#000000', '#000000']).color).toBe('#000000');
  });
});
