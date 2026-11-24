import { describe, expect, it } from 'vitest';
import {
  MAX_EXPANSIONS,
  expansionsFor,
  normalizeTerm,
  parseSynonymGroups,
} from './search-synonyms';

describe('parseSynonymGroups (M45-S08)', () => {
  it('parses one group per line', () => {
    const out = parseSynonymGroups('money, finance, cash\nmaths, math');
    expect(out.errors).toEqual([]);
    expect(out.groups).toEqual([
      ['money', 'finance', 'cash'],
      ['maths', 'math'],
    ]);
  });

  it('rejects groups with a single term and names the line', () => {
    const out = parseSynonymGroups('money, finance\nalone\n\nmaths, math');
    expect(out.errors).toEqual([{ line: 2, message: 'Add at least two different words' }]);
  });

  it('counts a repeated word once', () => {
    expect(parseSynonymGroups('cash, Cash').errors).toEqual([
      { line: 1, message: 'Add at least two different words' },
    ]);
  });

  it('lowercases and unaccents terms', () => {
    expect(parseSynonymGroups('Ọ̀wọ́, Money').groups).toEqual([['owo', 'money']]);
    expect(normalizeTerm('  CAFÉ ')).toBe('cafe');
  });

  it('lists every bad line, not only the first', () => {
    const out = parseSynonymGroups('one\ntwo, 2\nbad<>, ok\nlast');
    expect(out.errors.map((e) => e.line)).toEqual([1, 3, 4]);
  });

  it('refuses a group with more than 20 words and a word over 40 characters', () => {
    const many = Array.from({ length: 21 }, (_, i) => `w${i}`).join(', ');
    expect(parseSynonymGroups(many).errors).toHaveLength(1);
    expect(parseSynonymGroups(`${'x'.repeat(41)}, y`).errors).toHaveLength(1);
  });

  it('allows a phrase of several words as one term', () => {
    expect(parseSynonymGroups('pay slip, payslip').groups).toEqual([['pay slip', 'payslip']]);
  });
});

describe('expansionsFor', () => {
  const groups = [
    ['money', 'finance', 'cash'],
    ['maths', 'math'],
  ];
  it('gives the other words of every group a token is in', () => {
    expect(expansionsFor(groups, ['money'])).toEqual({ money: ['finance', 'cash'] });
  });
  it('gives nothing for a word in no group', () => {
    expect(expansionsFor(groups, ['rivers'])).toEqual({});
  });
  it('caps the total at 8 expansions per query', () => {
    expect(MAX_EXPANSIONS).toBe(8);
    const big = [Array.from({ length: 12 }, (_, i) => `t${i}`)];
    const out = expansionsFor(big, ['t0']);
    expect(Object.values(out).flat()).toHaveLength(8);
  });
});
